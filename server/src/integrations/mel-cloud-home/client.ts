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
 * MEL Cloud Home is noticeably buggy and sometimes all devices can show as OFFLINE. This can manifest either
 * as an empty `buildings` array, or (more insidiously) as a normal-looking response where every device is
 * marked `isConnected: false`. Both are usually caused by the auth cookie having silently expired without
 * MELCloud returning a 401 for it, so we treat either shape as a signal to force a token refresh and retry.
 */
function isStaleTokenResponse(jsonResponse: {
  buildings: { airToAirUnits: AirToAirUnit[] }[];
}): boolean {
  if (jsonResponse.buildings.length === 0) return true;
  const units = jsonResponse.buildings[0]?.airToAirUnits ?? [];
  return units.length > 0 && units.every((unit) => !unit.isConnected);
}

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

  private async fetchAuthenticated(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const makeRequest = async () => {
      const authCookie = await this.authenticationCookies.retrieveAuthCookies();
      if (!authCookie) {
        throw new Error(`Unexpected missing auth cookie for MelCloud`);
      }
      return fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "x-csrf": "1",
          Cookie: authCookie,
        },
      });
    };

    const response = await makeRequest();
    if (response.status !== 401) {
      return response;
    }

    this.logger.warn(
      { url },
      "MelCloud: received 401, refreshing token and retrying",
    );
    await this.callForceRefresh();
    return makeRequest();
  }

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
      throw new Error(
        `Unexpected missing auth cookie for MelCloud after refresh`,
      );
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
    if (isStaleTokenResponse(jsonResponse)) {
      throw new Error(
        `MelCloud still reports devices as offline/disconnected after token refresh`,
      );
    }
    return jsonResponse;
  }

  async getContext(): Promise<RoomDevice[]> {
    const response = await this.fetchAuthenticated(
      `${this.apiUrl}/user/context`,
      {
        method: "GET",
      },
    );

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

    if (isStaleTokenResponse(jsonResponse)) {
      if (!this.forceRefresh) {
        this.logger.warn(
          "MelCloud: empty buildings or all devices disconnected, and no forceRefresh available, returning empty state",
        );
        return [];
      }

      this.logger.warn(
        "MelCloud: empty buildings or all devices disconnected, triggering token refresh and retrying",
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
    const response = await this.fetchAuthenticated(
      `${this.apiUrl}/ataunit/${deviceId}`,
      {
        method: "GET",
      },
    );

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
    this.logger.debug(
      { deviceId, stateChange },
      "MelCloud: sending state change to device",
    );

    const response = await this.fetchAuthenticated(
      `${this.apiUrl}/ataunit/${deviceId}`,
      {
        method: "PUT",
        body: JSON.stringify(stateChange),
      },
    );

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
