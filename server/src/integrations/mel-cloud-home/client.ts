import { MelCloudAuthCookiesPersistenceService } from "./auth-cookies.persistence.service";
import { AirToAirUnit, AirToAirUnitStateChange } from "./types.zod";

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
  constructor(
    private readonly authenticationCookies: MelCloudAuthCookiesPersistenceService,
    private readonly apiUrl: string,
  ) {}

  async getContext(): Promise<RoomDevice[]> {
    const authCookie = await this.authenticationCookies.retrieveAuthCookies();
    if (!authCookie) {
      throw new Error(`Unexpected missing Auth cookie for MelCloud`);
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
      console.warn(`MelCloudError`, await response.text());
      return [];
    }

    const jsonResponse = await response.json() as { buildings: { airToAirUnits: AirToAirUnit[] }[] };
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

    return devices;
  }

  async getDevice(deviceId: string): Promise<AirToAirUnit | null> {
    const authCookie = await this.authenticationCookies.retrieveAuthCookies();
    if (!authCookie) {
      throw new Error(`Unexpected missing Auth cookie for MelCloud`);
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
      console.warn(`MelCloudError getting device ${deviceId}:`, await response.text());
      return null;
    }

    return await response.json() as AirToAirUnit;
  }

  async putAtAUnit(deviceId: string, stateChange: AirToAirUnitStateChange) {
    const authCookie = await this.authenticationCookies.retrieveAuthCookies();
    if (!authCookie) {
      throw new Error(`Unexpected missing Auth cookie for MelCloud`);
    }

    await fetch(`${this.apiUrl}/ataunit/${deviceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-csrf": "1",
        Cookie: authCookie,
      },
      body: JSON.stringify(stateChange),
    });
    return true;
  }
}
