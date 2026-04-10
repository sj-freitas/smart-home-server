import { StatePersistenceService } from "./state.persistence.service";
import { DeviceState, HomeState } from "./types.zod";
import { HomeConfig } from "../../config/home.zod";

/**
 * Updates a current state or creates a new one from the config if none is present.
 * It'll add the device changes to the state.
 *
 * @param homeConfig The base config to read and update the state from.
 * @param homeState The current state to use as a base if exists.
 * @param allDeviceChanges All the changes to consolidate.
 *
 * @returns The new state fully consolidated.
 */
function alterHomeState(
  homeConfig: HomeConfig,
  homeState: HomeState | null,
  allDeviceChanges: Iterable<DeviceState>,
) {
  const currHomeState =
    homeState !== null
      ? homeState
      : {
          name: homeConfig.name,
          pageTitle: homeConfig.pageTitle,
          logo: homeConfig.iconUrl,
          faviconUrl: homeConfig.faviconUrl,
          subTitle: homeConfig.subTitle,
          rooms: [],
        };

  // const home = this.configService.getConfig().home;
  const rooms = homeConfig.rooms.map((configRoom) => {
    const matchingRoomInState = currHomeState.rooms.find(
      (t) => t.id === configRoom.id,
    );

    if (!matchingRoomInState) {
      return {
        roomInfo: {
          ...configRoom.roomInfo,
        },
        id: configRoom.id,
        name: configRoom.name,
        icon: configRoom.icon,
        temperature: null,
        humidity: null,
        devices: [],
      };
    }

    return {
      roomInfo: {
        ...configRoom.roomInfo,
      },
      id: matchingRoomInState.id,
      name: matchingRoomInState.name,
      icon: matchingRoomInState.icon,
      temperature: matchingRoomInState.temperature ?? null,
      humidity: matchingRoomInState.humidity ?? null,
      devices: matchingRoomInState.devices,
    };
  });

  const mappedDevices = new Map(
    Array.from(allDeviceChanges).map((t) => [`${t.roomId}/${t.id}`, t]),
  );
  // Update rooms infos (Temperatures and Humidity)
  for (const currRoom of rooms) {
    const humidityDevice = mappedDevices.get(
      currRoom.roomInfo.humidityDeviceId,
    );
    if (
      humidityDevice &&
      humidityDevice.humidity !== null &&
      humidityDevice.humidity !== undefined
    ) {
      currRoom.humidity = humidityDevice.humidity ?? null;
    }
    const temperatureDevice = mappedDevices.get(
      currRoom.roomInfo.temperatureDeviceId,
    );
    if (
      temperatureDevice &&
      temperatureDevice.temperature !== null &&
      temperatureDevice.temperature !== undefined
    ) {
      currRoom.temperature = temperatureDevice.temperature ?? null;
    }
  }

  for (const currDevice of allDeviceChanges) {
    const currRoom = rooms.find((t) => t.id === currDevice.roomId);
    if (!currRoom) {
      // Device is probably a bug, this flow should never happen.
      console.warn(`Impossible device that does not belong to existing room!`, {
        deviceId: currDevice.id,
        roomId: currDevice.roomId,
      });
      continue;
    }

    // Instead of push we can replace perhaps?
    const existingDevice = currRoom.devices.find((t) => t.id === currDevice.id);
    if (existingDevice) {
      // Squash existing device
      existingDevice.name = currDevice.name ?? existingDevice.name;
      existingDevice.icon = currDevice.icon ?? existingDevice.icon;
      existingDevice.type = currDevice.type ?? existingDevice.type;
      existingDevice.actions = currDevice.actions ?? existingDevice.actions;
      existingDevice.state = currDevice.state ?? existingDevice.state;
      existingDevice.online = currDevice.online ?? existingDevice.online;
    } else {
      // It's a new device. Not sure how this flow should work ? Maybe do not support it.
      currRoom.devices.push({
        id: currDevice.id,
        name: currDevice.name,
        icon: currDevice.icon,
        type: currDevice.type,
        actions: currDevice.actions,
        state: currDevice.state,
        online: currDevice.online,
      });
    }
  }

  return {
    ...currHomeState,
    rooms: rooms.map((t) => ({
      id: t.id,
      name: t.name,
      icon: t.icon,
      temperature: t.temperature,
      humidity: t.humidity,
      devices: t.devices,
    })),
  };
}

export interface TupleKeyDeviceState {
  key: string;
  value: DeviceState;
}

export class StateService {
  constructor(
    private readonly homeConfig: HomeConfig,
    private readonly statePersistenceService: StatePersistenceService,
  ) {}

  public async addToState(currentChanges: DeviceState[]): Promise<HomeState> {
    const currState = await this.statePersistenceService.getHomeState(
      this.homeConfig.name,
    );
    const newState = alterHomeState(this.homeConfig, currState, currentChanges);

    await this.statePersistenceService.storeHomeState(newState);

    return newState;
  }
}
