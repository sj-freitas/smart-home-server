import { DeviceAction } from "../config/home.zod";
import { DeviceHelper } from "../helpers/device-helpers";
import { IntegrationsService, TryRunActionResult } from "../integrations/integrations-service";
import { HomeStateGateway } from "../sockets/home.state.gateway";
import { ConfigService } from "../config/config-service";
import { StateService } from "../services/state/state.service";
import { OnActionsService } from "./on-actions/on-actions-service";

export type ActionRunResult =
  | { found: false; message: string }
  | { found: true; actionResult: TryRunActionResult; action: DeviceAction };

export class ActionRunnerService {
  private readonly deviceHelper: DeviceHelper;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly stateService: StateService,
    private readonly homeStateGateway: HomeStateGateway,
    private readonly onActions: OnActionsService,
    configService: ConfigService,
  ) {
    this.deviceHelper = new DeviceHelper(configService.getConfig().home);
  }

  public async run(
    roomId: string,
    deviceId: string,
    actionId: string,
  ): Promise<ActionRunResult> {
    const deviceInfo = this.deviceHelper.getDevice(`${roomId}/${deviceId}`);
    if (!deviceInfo) {
      return { found: false, message: `Device with id ${deviceId} not found` };
    }

    const action = deviceInfo.actions.find((a) => a.id === actionId);
    if (!action) {
      return { found: false, message: `Action ${actionId} not found` };
    }

    const integrationService = this.integrations.getIntegrationService(
      deviceInfo.integration.name,
    );
    const actionResult = await integrationService.tryRunAction(
      deviceInfo.integration,
      deviceInfo.type,
      action,
    );

    const newState = await this.stateService.addToState([
      { id: deviceId, roomId, state: actionId },
    ]);
    if (this.homeStateGateway.isInitialized) {
      this.homeStateGateway.updateState(newState);
    }

    await Promise.all((action.onAction ?? []).map((onAction) => this.onActions.handleOnAction(onAction)));

    return { found: true, actionResult, action };
  }
}
