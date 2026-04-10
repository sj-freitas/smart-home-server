import { DeviceAction, RoomDeviceTypes } from "../../config/home.zod";
import { MelCloudHomeIntegrationDevice } from "../../config/integration.zod";
import {
  DeviceState,
  IntegratedDeviceConfig,
  IntegrationService,
  TryRunActionResult,
} from "../integrations-service";
import { MelCloudAuthCookiesPersistenceService } from "./auth-cookies.persistence.service";
import { MelCloudHomeClient } from "./client";
import {
  AirToAirUnitStateChange,
  AirToAirUnitStateChangeZod,
} from "./types.zod";

// Order the fields by the relevance for matching. Score a match by the number of fields that match, but
// each field has a different weight based on its relevance.
const FIELDS_ORDERED_BY_RELEVANCE: (keyof AirToAirUnitStateChange)[] = [
  "power",
  "operationMode",
  "setTemperature",
  "setFanSpeed",
  "vaneHorizontalDirection",
  "vaneVerticalDirection",
];
const WEIGHTED_FIELDS_BY_RELEVANCE = FIELDS_ORDERED_BY_RELEVANCE.reverse()
  .map(
    (field: keyof AirToAirUnitStateChange, index: number) =>
      [2 ** index, field] as [number, keyof AirToAirUnitStateChange],
  )
  .reverse();

const fanSpeedSettingsToParametersMap: Record<string, string> = {
  "0": "Auto",
  "1": "One",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
};

function mapSettingsRecordToParameters(
  settings: Record<string, string>,
): AirToAirUnitStateChange {
  return AirToAirUnitStateChangeZod.parse({
    power: settings["Power"] === "True",
    operationMode: settings["OperationMode"],
    setFanSpeed:
      fanSpeedSettingsToParametersMap[settings["SetFanSpeed"]] ?? "Auto",
    vaneHorizontalDirection: settings["VaneHorizontalDirection"],
    vaneVerticalDirection: settings["VaneVerticalDirection"],
    setTemperature: Number.parseFloat(settings["SetTemperature"]),
  } as AirToAirUnitStateChange);
}

function tryFindBestMatchingAction(
  currentDeviceState: AirToAirUnitStateChange,
  possibleDeviceActions: Map<string, AirToAirUnitStateChange>,
): string {
  const scoresForEachAction = Array.from(possibleDeviceActions.entries()).map(
    ([actionId, actionParameters]) => {
      let score = 0;
      for (const [weight, field] of WEIGHTED_FIELDS_BY_RELEVANCE) {
        if (currentDeviceState[field] === actionParameters[field]) {
          score += weight;
        }
      }
      return { actionId, score };
    },
  );

  // Find the action with the highest score
  const bestMatch = scoresForEachAction.reduce(
    (best, current) => {
      return current.score > best.score ? current : best;
    },
    { actionId: "off", score: 0 },
  );

  return bestMatch.actionId;
}

export class MelCloudHomeIntegrationService implements IntegrationService<MelCloudHomeIntegrationDevice> {
  constructor(
    private readonly melCloudHomeClient: MelCloudHomeClient,
    private readonly authenticationCookies: MelCloudAuthCookiesPersistenceService,
  ) {}

  public name: "mel_cloud_home" = "mel_cloud_home";

  public async consolidateDeviceStates(
    devices: IntegratedDeviceConfig<MelCloudHomeIntegrationDevice>[],
  ): Promise<DeviceState[]> {
    const authCookies = await this.authenticationCookies.retrieveAuthCookies();
    if (authCookies === null) {
      // This happens when MELCloud is offline most likely, the application needs to be resilient.
      return devices.map((currDevice) => ({
        online: false,
        state: "off",
        temperature: null,
        humidity: null,
      }));
    }

    const context = await this.melCloudHomeClient.getContext();

    return devices.map((currDevice) => {
      if (currDevice.type !== "air_conditioner") {
        console.warn(
          `Unsupported device type ${currDevice.type} for MelCloudHome`,
        );
        return {
          online: false,
          state: "off",
          temperature: null,
          humidity: null,
        };
      }

      const matchingDevice = context.find(
        (t) => t.id === currDevice.info.deviceId,
      );
      if (!matchingDevice) {
        console.warn(
          `MelCloudHome Device ${currDevice.info.deviceId} wasn't found - device not associated with home.`,
        );
        return {
          online: false,
          state: "off",
          temperature: null,
          humidity: null,
        };
      }

      const currentDeviceState = mapSettingsRecordToParameters(
        matchingDevice.settings,
      );
      const actionParametersMap = new Map(
        currDevice.actions.map(
          (t) =>
            [t.id, AirToAirUnitStateChangeZod.parse(t.parameters)] as [
              string,
              AirToAirUnitStateChange,
            ],
        ),
      );

      const action = tryFindBestMatchingAction(
        currentDeviceState,
        actionParametersMap,
      );

      return {
        online: true,
        state: action,
        temperature: matchingDevice.room.temperature,
        humidity: null,
      };
    });
  }

  async tryRunAction(
    deviceInfo: MelCloudHomeIntegrationDevice,
    deviceType: RoomDeviceTypes,
    actionDescription: DeviceAction,
  ): Promise<TryRunActionResult> {
    try {
      // Only supported type for MEL Cloud Home are Air Conditioners
      if (deviceType === "air_conditioner") {
        // This is the only time we can verify that the config is correctly formed.
        // However, this should have been caught earlier in the process.
        const parsedParameters = AirToAirUnitStateChangeZod.parse(
          actionDescription.parameters,
        );

        await this.melCloudHomeClient.putAtAUnit(
          deviceInfo.deviceId,
          parsedParameters,
        );

        return true;
      }
    } catch (error: unknown) {
      console.error(error);
      return "There was an error performing the action.";
    }

    return `Integrations for actions for MelHomeCloud devices do not support ${deviceType}. This could be a config issue.`;
  }
}
