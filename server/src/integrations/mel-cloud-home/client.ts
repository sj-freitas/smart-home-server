import { MelCloudAuthCookiesPersistenceService } from "./auth-cookies.persistence.service";
import { AirToAirUnit, AirToAirUnitStateChange } from "./types.zod";
import { withRetries } from "../../helpers/retry";
import { PinoLogger } from "nestjs-pino";

const MEL_CLOUD_CONTEXT_RETRIES = 1;

export interface RoomDevice {
  id: string;
  room: {
    name: string;
    temperature: number;
  };
  mode: string;
  power: boolean;
  isConnected: boolean;
  isInError: boolean;
  settings: Record<string, string>;
}

/**
 * MEL Cloud Home is noticeably buggy and sometimes all devices can show as OFFLINE and the API response
 * on the Context becomes an empty object. In these cases, there's not much we can do, but we should address
 * this state somehow.
 */
export class MelCloudHomeClient {
  // Deduplicates concurrent Puppeteer sessions: if a refresh is already in
  // flight, new callers await the same promise instead of launching their own.
  private refreshInFlight: Promise<void> | null = null;

  constructor(
    private readonly authenticationCookies: MelCloudAuthCookiesPersistenceService,
    private readonly forceRefresh: (() => Promise<void>) | null,
    private readonly apiUrl: string,
    private readonly logger: PinoLogger,
  ) {}

  private callForceRefresh(): Promise<void> {
    if (!this.forceRefresh) return Promise.resolve();
    if (!this.refreshInFlight) {
      this.logger.info("MelCloud: initiating force token refresh");
      this.refreshInFlight = this.forceRefresh().finally(() => {
        this.refreshInFlight = null;
        this.logger.info("MelCloud: force token refresh complete");
      });
    } else {
      this.logger.debug(
        "MelCloud: token refresh already in progress, awaiting existing refresh",
      );
    }
    return this.refreshInFlight;
  }

  private async fetchContextAfterTokenRefresh(): Promise<{
    buildings: { airToAirUnits: AirToAirUnit[] }[];
  }> {
    await this.callForceRefresh();
    const authCookie = await this.authenticationCookies.retrieveAuthCookies();
    if (!authCookie) {
      throw new Error(`Unexpected missing auth cookie for MelCloud after refresh`);
    }
    const response = await fetch(`${this.apiUrl}/user/context`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-csrf": "1",
        Cookie: authCookie,
      },
    });
    if (response.status !== 200) {
      throw new Error(
        `MelCloud context request failed with status ${response.status}`,
      );
    }
    const jsonResponse = (await response.json()) as {
      buildings: { airToAirUnits: AirToAirUnit[] }[];
    };
    if (jsonResponse.buildings.length === 0) {
      throw new Error(`MelCloud returned empty buildings after token refresh`);
    }
    return jsonResponse;
  }

  async getContext(): Promise<RoomDevice[]> {
    const authCookie = await this.authenticationCookies.retrieveAuthCookies();
    if (!authCookie) {
      throw new Error(`Unexpected missing auth cookie for MelCloud`);
    }

    const response = await fetch(`${this.apiUrl}/user/context`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-csrf": "1",
        Cookie: authCookie,
      },
    });

    if (response.status !== 200) {
      const body = await response.text();
      this.logger.warn(
        { status: response.status, body },
        "MelCloud: context request failed",
      );
      return [];
    }

    let jsonResponse = (await response.json()) as {
      buildings: { airToAirUnits: AirToAirUnit[] }[];
    };

    if (jsonResponse.buildings.length === 0) {
      if (!this.forceRefresh) {
        this.logger.warn(
          "MelCloud: empty buildings returned and no forceRefresh available, returning empty state",
        );
        return [];
      }

      this.logger.warn(
        "MelCloud: empty buildings returned, triggering token refresh and retrying",
      );

      try {
        jsonResponse = await withRetries(
          () => this.fetchContextAfterTokenRefresh(),
          MEL_CLOUD_CONTEXT_RETRIES,
          0,
          false,
          (attempt, maxAttempts, err) => {
            this.logger.warn(
              { attempt, maxAttempts, err },
              "MelCloud: context fetch after token refresh failed, retrying",
            );
          },
        )();
      } catch (err) {
        this.logger.error(
          { err, attempts: MEL_CLOUD_CONTEXT_RETRIES + 1 },
          "MelCloud: context fetch exhausted all retries after token refresh",
        );
        return [];
      }
    }

    const airToAirUnits: AirToAirUnit[] =
      jsonResponse.buildings[0]?.airToAirUnits ?? [];
    const devices = airToAirUnits.map((device) => ({
      id: device.id,
      room: {
        name: device.givenDisplayName,
        temperature:
          Number.parseFloat(
            device.settings.find(
              (currSetting) => currSetting.name === "RoomTemperature",
            )?.value ?? "NaN",
          ) ?? NaN,
      },
      power:
        device.settings.find((currSetting) => currSetting.name === "Power")
          ?.value === "True"
          ? true
          : false,
      isConnected: device.isConnected,
      isInError: device.isInError,
      mode:
        device.settings.find(
          (currSetting) => currSetting.name === "OperationMode",
        )?.value ?? "off",
      settings: device.settings.reduce(
        (acc, setting) => ({
          ...acc,
          [setting.name]: setting.value,
        }),
        {},
      ),
    }));

    this.logger.debug(
      { deviceCount: devices.length },
      "MelCloud: context fetched successfully",
    );

    return devices;
  }

  async getDevice(deviceId: string): Promise<AirToAirUnit | null> {
    const authCookie = await this.authenticationCookies.retrieveAuthCookies();
    if (!authCookie) {
      throw new Error(`Unexpected missing auth cookie for MelCloud`);
    }

    const response = await fetch(`${this.apiUrl}/ataunit/${deviceId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-csrf": "1",
        Cookie: authCookie,
      },
    });

    if (response.status !== 200) {
      const body = await response.text();
      this.logger.warn(
        { deviceId, status: response.status, body },
        "MelCloud: getDevice request failed",
      );
      return null;
    }

    return (await response.json()) as AirToAirUnit;
  }

  async putAtAUnit(deviceId: string, stateChange: AirToAirUnitStateChange) {
    const authCookie = await this.authenticationCookies.retrieveAuthCookies();
    if (!authCookie) {
      throw new Error(`Unexpected missing auth cookie for MelCloud`);
    }

    this.logger.debug(
      { deviceId, stateChange },
      "MelCloud: sending state change to device",
    );

    const response = await fetch(`${this.apiUrl}/ataunit/${deviceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-csrf": "1",
        Cookie: authCookie,
      },
      body: JSON.stringify(stateChange),
    });

    if (response.status !== 200) {
      const body = await response.text();
      this.logger.warn(
        { deviceId, status: response.status, body },
        "MelCloud: putAtAUnit request failed",
      );
    }

    return true;
  }
}
