import { forwardRef, Module } from "@nestjs/common";
import { ConfigModule } from "../config/module";
import { ServicesModule } from "../services/module";
import { IntegrationsModule } from "../integrations/module";
import { SocketsModule } from "../sockets/module";
import { ConfigService } from "../config/config-service";
import { IntegrationsService } from "../integrations/integrations-service";
import { StateService } from "../services/state/state.service";
import { HomeStateGateway } from "../sockets/home.state.gateway";
import { ActionRunnerService } from "./action-runner.service";
import { OnActionsService } from "./on-actions/on-actions-service";
import { OnActionsModule } from "./on-actions/module";
import { MetricsPersistenceService } from "../metrics/metrics.persistence.service";

const ActionRunnerServiceProvider = {
  provide: ActionRunnerService,
  inject: [
    IntegrationsService,
    StateService,
    HomeStateGateway,
    OnActionsService,
    ConfigService,
    MetricsPersistenceService,
  ],
  useFactory: (
    integrations: IntegrationsService,
    stateService: StateService,
    homeStateGateway: HomeStateGateway,
    onActions: OnActionsService,
    configService: ConfigService,
    metricsPersistenceService: MetricsPersistenceService,
  ) =>
    new ActionRunnerService(
      integrations,
      stateService,
      homeStateGateway,
      onActions,
      configService,
      metricsPersistenceService,
    ),
};

@Module({
  imports: [
    ConfigModule,
    ServicesModule,
    IntegrationsModule,
    SocketsModule,
    forwardRef(() => OnActionsModule),
  ],
  providers: [ActionRunnerServiceProvider],
  exports: [ActionRunnerService],
})
export class ActionsModule {}
