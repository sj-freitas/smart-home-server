import { Module, Scope } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { MelCloudHomeIntegrationService } from "./integration.service";
import { ConfigModule } from "../../config/module";
import { ConfigService } from "../../config/config-service";
import { MelCloudHomeClient } from "./client";
import {
  InMemoryMelCloudAuthCookiesPersistenceService,
  MelCloudAuthCookiesPersistenceService,
} from "./auth-cookies.persistence.service";
import { spinCookieRefresher } from "./cookie-refresher";
import { MelCLoudHomeController } from "./controllers/mel-cloud-home.controller";
import { updateStateForDevicesOfIntegration } from "../../helpers/state-updater.helper";
import { StateService } from "../../services/state/state.service";
import { HomeStateGateway } from "../../sockets/home.state.gateway";
import { ServicesModule } from "../../services/module";
import { SocketsModule } from "../../sockets/module";
import { startScheduler } from "../../helpers/scheduler";

export const MEL_CLOUD_AUTHENTICATION_COOKIES =
  "MelCloudHomeAuthenticationCookies";
const MelCloudAuthCookiesPersistenceServiceProvider = {
  provide: MEL_CLOUD_AUTHENTICATION_COOKIES,
  scope: Scope.DEFAULT,
  useFactory: () => new InMemoryMelCloudAuthCookiesPersistenceService(),
};

export const MEL_CLOUD_HOME_STATE_POLLING = "MelCloudHomeStatePolling";
const MelCloudHomePollingProvider = {
  provide: MEL_CLOUD_HOME_STATE_POLLING,
  inject: [
    ConfigService,
    MelCloudHomeIntegrationService,
    StateService,
    HomeStateGateway,
    PinoLogger,
  ],
  useFactory: async (
    config: ConfigService,
    melCLoudHomeIntegration: MelCloudHomeIntegrationService,
    stateService: StateService,
    homeStateGateway: HomeStateGateway,
    logger: PinoLogger,
  ) => {
    const homeConfig = config.getConfig().home;

    await startScheduler(async () => {
      logger.debug(
        { source: "background", task: "state-poll" },
        "MelCloud: polling device state",
      );
      await updateStateForDevicesOfIntegration(
        homeConfig,
        melCLoudHomeIntegration,
        stateService,
        homeStateGateway,
      );
    }, 120_000);
  },
};

const MelCloudHomeClientProvider = {
  provide: MelCloudHomeClient,
  inject: [MEL_CLOUD_AUTHENTICATION_COOKIES, ConfigService, PinoLogger],
  useFactory: async (
    melCloudAuthCookiesPersistenceService: MelCloudAuthCookiesPersistenceService,
    config: ConfigService,
    logger: PinoLogger,
  ) => {
    const melCloudHomeConfig = config
      .getConfig()
      .integrations.find((t) => t.name === "mel_cloud_home");
    if (!melCloudHomeConfig) {
      throw new Error("MelCloudHome integration config not found");
    }

    const forceRefresh = await spinCookieRefresher(
      config,
      melCloudAuthCookiesPersistenceService,
      logger,
    );

    return new MelCloudHomeClient(
      melCloudAuthCookiesPersistenceService,
      forceRefresh,
      melCloudHomeConfig.apiUrl,
      logger,
    );
  },
};

const MelCloudHomeIntegrationServiceProvider = {
  provide: MelCloudHomeIntegrationService,
  inject: [MelCloudHomeClient, MEL_CLOUD_AUTHENTICATION_COOKIES, PinoLogger],
  useFactory: async (
    client: MelCloudHomeClient,
    cookiesProvider: MelCloudAuthCookiesPersistenceService,
    logger: PinoLogger,
  ) => {
    return new MelCloudHomeIntegrationService(client, cookiesProvider, logger);
  },
};

@Module({
  imports: [ConfigModule, ServicesModule, SocketsModule],
  controllers: [MelCLoudHomeController],
  providers: [
    MelCloudAuthCookiesPersistenceServiceProvider,
    MelCloudHomeIntegrationServiceProvider,
    MelCloudHomeClientProvider,
    MelCloudHomePollingProvider,
  ],
  exports: [
    MelCloudHomeIntegrationServiceProvider,
    MelCloudAuthCookiesPersistenceServiceProvider,
    MelCloudHomeClientProvider,
    MelCloudHomePollingProvider,
  ],
})
export class MelCloudHomeModule {}
