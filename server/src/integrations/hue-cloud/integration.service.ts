import { HueCloudIntegrationDevice } from "../../config/integration.zod";
import {
  DeviceState,
  IntegratedDeviceConfig,
  IntegrationService,
  TryRunActionResult,
} from "../integrations-service";
import { DeviceAction, RoomDeviceTypes } from "../../config/home.zod";
import { HueClient } from "./hue.client";
import { LightState, LightStateZod } from "./hue.types.zod";

function normalizeDeviceIds(deviceId: string | string[]): string[] {
  if (Array.isArray(deviceId)) {
    return deviceId;
  }
  return [deviceId];
}

// Order the fields by the relevance for matching. Score a match by the number of fields that match, but
// each field has a different weight based on its relevance.
const FIELDS_ORDERED_BY_RELEVANCE: (keyof LightState)[] = [
  "on",
  "hue",
  "sat",
  "bri",
];
const WEIGHTED_FIELDS_BY_RELEVANCE = FIELDS_ORDERED_BY_RELEVANCE.reverse()
  .map(
    (field: keyof LightState, index: number) =>
      [2 ** index, field] as [number, keyof LightState],
  )
  .reverse();

const MAX_MARGIN_OF_SIMILARITY = 15;
function areFieldsMatched(field1: unknown, field2: unknown) {
  if (typeof field1 === "boolean") {
    return field1 === field2;
  }
  if (typeof field1 === "number" && typeof field2 === "number") {
    return Math.abs(field1 - field2) <= MAX_MARGIN_OF_SIMILARITY;
  }

  // Unsupported comparison (for now)
  return false;
}

function tryFindBestMatchingAction(
  currentDeviceState: LightState,
  possibleDeviceActions: Map<string, LightState>,
): string {
  const scoresForEachAction = Array.from(possibleDeviceActions.entries()).map(
    ([actionId, actionParameters]) => {
      let score = 0;
      for (const [weight, field] of WEIGHTED_FIELDS_BY_RELEVANCE) {
        if (
          areFieldsMatched(currentDeviceState[field], actionParameters[field])
        ) {
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

export class HueCloudIntegrationService implements IntegrationService<HueCloudIntegrationDevice> {
  public name: "hue_cloud" = "hue_cloud";

  constructor(private readonly hueClient: HueClient) {}

  public async consolidateDeviceStates(
    devices: IntegratedDeviceConfig<HueCloudIntegrationDevice>[],
  ): Promise<DeviceState[]> {
    const hueDevices = await this.hueClient.getLights();

    if (hueDevices === null) {
      // This usually means that the bridge is not reachable.
      // We return all devices as offline in this case.
      return devices.map(() => ({
        online: false,
        state: "off",
        temperature: null,
        humidity: null,
      }));
    }

    return devices.map((currDevice) => {
      const [firstId] = normalizeDeviceIds(currDevice.info.id);
      const matchingDevice = hueDevices[firstId];
      if (!matchingDevice) {
        console.warn(
          `MelCloudHome Device ${currDevice.info.id} wasn't found - device not associated with home.`,
        );
        return {
          online: false,
          state: "off",
          temperature: null,
          humidity: null,
        };
      }

      if (currDevice.type === "smart_light") {
        // Find the matching action for this color combination
        const actionParametersMap = new Map(
          currDevice.actions.map(
            (t) =>
              [t.id, LightStateZod.parse(t.parameters)] as [string, LightState],
          ),
        );

        const currentDeviceState = matchingDevice.state;
        const action = tryFindBestMatchingAction(
          currentDeviceState,
          actionParametersMap,
        );

        return {
          state: action,
          online: matchingDevice.state.reachable ?? false,
          temperature: null,
          humidity: null,
        };
      }
      if (currDevice.type === "smart_switch") {
        return {
          state: matchingDevice.state.on ? "on" : "off",
          online: matchingDevice.state.reachable ?? false,
          temperature: null,
          humidity: null,
        };
      }

      console.warn(
        `Unsupported device type ${currDevice.type} for Philips Hue`,
      );
      return {
        online: false,
        state: "off",
        temperature: null,
        humidity: null,
      };
    });
  }

  async tryRunAction(
    deviceInfo: HueCloudIntegrationDevice,
    deviceType: RoomDeviceTypes,
    action: DeviceAction,
  ): Promise<TryRunActionResult> {
    const deviceIds = normalizeDeviceIds(deviceInfo.id);
    if (deviceType === "smart_light") {
      const state = LightStateZod.parse(action.parameters);

      try {
        const results = await Promise.all(
          deviceIds.map(async (currId) =>
            this.hueClient.setLightState(currId, state),
          ),
        );
        const allValid = results
          .flatMap((t) => t)
          .every((t) => Boolean(t.success));

        return allValid ? true : `Failed to perform some of the actions`;
      } catch (error: any) {
        return `Failed to set action ${action.id} on device ${deviceInfo.id}: ${error.message}`;
      }
    }

    if (deviceType === "smart_switch") {
      const newState = {
        on: action.id === "on",
      };

      try {
        const results = await Promise.all(
          deviceIds.map(async (currId) =>
            this.hueClient.setLightState(currId, newState),
          ),
        );
        const allValid = results
          .flatMap((t) => t)
          .every((t) => Boolean(t.success));

        return allValid ? true : `Failed to perform some of the actions`;
      } catch (error: any) {
        return `Failed to set action ${action.id} on device ${deviceInfo.id}: ${error.message}`;
      }
    }

    return `Failed, unsupported device type for Hue`;
  }
}
