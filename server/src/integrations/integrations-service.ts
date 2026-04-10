import { DeviceAction, HomeConfig, RoomDeviceTypes } from "../config/home.zod";
import { IntegrationTypeNames } from "../config/integration.zod";

export type TryRunActionResult = true | string;

export interface DeviceState {
  online: boolean;
  state: "off" | string;
  temperature: number | null;
  humidity: number | null;
}

export interface IntegratedDeviceConfig<T> {
  info: T;
  type: RoomDeviceTypes;
  actions: DeviceAction[];
}

export interface LoadedDeviceConfig<T> {
  path: string;
  type: RoomDeviceTypes;
  info: T;
  state: DeviceState;
}

export interface IntegrationService<T> {
  readonly name: IntegrationTypeNames;

  consolidateDeviceStates(
    devices: IntegratedDeviceConfig<T>[],
  ): Promise<DeviceState[]>;

  tryRunAction(
    deviceInfo: T,
    deviceType: RoomDeviceTypes,
    action: DeviceAction,
  ): Promise<TryRunActionResult>;
}

// POINT here remove everything except context.
export class IntegrationServiceWithContext<T> {
  constructor(
    private readonly service: IntegrationService<T>,
    public readonly context: LoadedDeviceConfig<T>,
  ) {}

  public async tryRunAction(action: DeviceAction) {
    return this.service.tryRunAction(
      this.context.info,
      this.context.type,
      action,
    );
  }
}

export class IntegrationsService {
  constructor(
    private readonly homeConfig: HomeConfig,
    private readonly integrations: IntegrationService<unknown>[],
  ) {}

  getIntegrationService(
    integrationName: IntegrationTypeNames,
  ): IntegrationService<unknown> {
    const found = this.integrations.find(
      (t) => t.name === integrationName,
    );
    if (!found) {
      throw new Error(`Integration ${integrationName} not supported.`);
    }
    
    return found;
  }

  public async getAllDevices(): Promise<
    IntegrationServiceWithContext<unknown>[]
  > {
    const allDeviceConfigs = this.homeConfig.rooms
      .map((currRoom) =>
        currRoom.devices.map((currDevice) => ({
          path: `${currRoom.id}/${currDevice.id}`,
          device: currDevice,
        })),
      )
      .flatMap((t) => t);

    const allDevices = await Promise.all(
      this.integrations.map(async (currIntegration) => {
        const deviceConfigsOfIntegration = allDeviceConfigs
          .filter((t) => t.device.integration.name === currIntegration.name)
          .map((t) => ({
            path: t.path,
            info: t.device.integration,
            type: t.device.type,
            actions: [...t.device.actions],
          }));

        const data = await currIntegration.consolidateDeviceStates(
          deviceConfigsOfIntegration,
        );

        // Merge both
        const merged = data.map((t, idx) => ({
          state: t,
          config: deviceConfigsOfIntegration[idx],
        }));

        return merged.map(
          (t) =>
            new IntegrationServiceWithContext(currIntegration, {
              path: t.config.path,
              type: t.config.type,
              info: t.config.info,
              state: t.state,
            }),
        );
      }),
    );

    return allDevices.flatMap((t) => t);
  }
}
