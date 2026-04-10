import { Module, Scope } from "@nestjs/common";
import { MelCloudHomeIntegrationService } from "./integration.service";
import { ConfigModule } from "../../config/module";
import { ConfigService } from "../../config/config-service";
import { MelCloudHomeClient } from "./client";
import { MelCloudAuthCookiesPersistenceService } from "./auth-cookies.persistence.service";
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
  inject: [ConfigService],
  scope: Scope.DEFAULT,
  useFactory: async (config: ConfigService) => {
    const authCookiesService = new MelCloudAuthCookiesPersistenceService();
    await spinCookieRefresher(config, authCookiesService);

    return authCookiesService;
  },
};

// Run this once.
// export const MEL_CLOUD_AUTHENTICATION_COOKIES =
//   "MelCloudHomeAuthenticationCookies";
// const MelCloudHomeAuthenticationCookiesProvider = {
//   provide: MEL_CLOUD_AUTHENTICATION_COOKIES,
//   inject: [ConfigService, MelCloudAuthCookiesPersistenceService],
//   useFactory: async (
//     config: ConfigService,
//     authCookiesService: MelCloudAuthCookiesPersistenceService,
//   ) => {
//     return await spinCookieRefresher(config, authCookiesService);
//   },
// };

export const MEL_CLOUD_HOME_STATE_POLLING = "MelCloudHomeStatePolling";
const MelCloudHomePollingProvider = {
  provide: MEL_CLOUD_HOME_STATE_POLLING,
  inject: [
    ConfigService,
    MelCloudHomeIntegrationService,
    StateService,
    HomeStateGateway,
  ],
  useFactory: async (
    config: ConfigService,
    melCLoudHomeIntegration: MelCloudHomeIntegrationService,
    stateService: StateService,
    homeStateGateway: HomeStateGateway,
  ) => {
    const homeConfig = config.getConfig().home;

    await startScheduler(async () => {
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
  inject: [MEL_CLOUD_AUTHENTICATION_COOKIES, ConfigService],
  useFactory: async (
    melCloudAuthCookiesPersistenceService: MelCloudAuthCookiesPersistenceService,
    config: ConfigService,
  ) => {
    const melCloudHomeConfig = config
      .getConfig()
      .integrations.find((t) => t.name === "mel_cloud_home");
    if (!melCloudHomeConfig) {
      throw new Error("MelCloudHome integration config not found");
    }

    return new MelCloudHomeClient(
      melCloudAuthCookiesPersistenceService,
      melCloudHomeConfig.apiUrl,
    );
  },
};

const MelCloudHomeIntegrationServiceProvider = {
  provide: MelCloudHomeIntegrationService,
  inject: [MelCloudHomeClient, MEL_CLOUD_AUTHENTICATION_COOKIES],
  useFactory: async (client: MelCloudHomeClient, cookiesProvider: MelCloudAuthCookiesPersistenceService) => {
    return new MelCloudHomeIntegrationService(client, cookiesProvider);
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
