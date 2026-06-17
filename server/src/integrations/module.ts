import { Module } from "@nestjs/common";
import { MelCloudHomeIntegrationService } from "./mel-cloud-home/integration.service";
import { ConfigModule } from "../config/module";
import { TuyaCloudIntegrationService } from "./tuya/integration.service";
import {
  IntegrationService,
  IntegrationsService,
} from "./integrations-service";
import {
  MEL_CLOUD_AUTHENTICATION_COOKIES,
  MelCloudHomeModule,
} from "./mel-cloud-home/module";
import { TuyaCloudModule } from "./tuya/module";
import { HueCloudIntegrationService } from "./hue-cloud/integration.service";
import { HUE_REFRESH_TOKEN, HueCloudModule } from "./hue-cloud/module";
import { ConfigService } from "../config/config-service";
import {
  IntegrationTypeNames,
  IntegrationTypeNamesZod,
} from "../config/integration.zod";
import { ShellyModule } from "./shelly/module";
import { ShellyIntegrationService } from "./shelly/integration.service";

type ModuleHelper = {
  module: any;
  services: any[];
};

const integrationsMap = new Map<IntegrationTypeNames, ModuleHelper>([
  [
    "tuya_cloud",
    {
      module: TuyaCloudModule,
      services: [TuyaCloudIntegrationService],
    },
  ],
  [
    "mel_cloud_home",
    {
      module: MelCloudHomeModule,
      services: [
        MelCloudHomeIntegrationService,
        MEL_CLOUD_AUTHENTICATION_COOKIES,
      ],
    },
  ],
  [
    "hue_cloud",
    {
      module: HueCloudModule,
      services: [HueCloudIntegrationService, HUE_REFRESH_TOKEN],
    },
  ],
  [
    "shelly",
    {
      module: ShellyModule,
      services: [ShellyIntegrationService],
    },
  ],
]);

function initDynamicIntegrationsProvider() {
  const config = ConfigService.create().getConfig();
  const integrationProviders: ModuleHelper[] = config.integrations
    .map((t) => integrationsMap.get(t.name))
    .filter((t): t is ModuleHelper => t !== undefined);

  return {
    imports: integrationProviders.map((t) => t.module),
    providers: [
      {
        provide: IntegrationsService,
        inject: [
          ConfigService,
          ...integrationProviders.flatMap((t) => t.services),
        ],
        useFactory: async (configService: ConfigService, ...params: any[]) => {
          const integrationServices = params.filter(
            (t) =>
              IntegrationTypeNamesZod.safeParse(
                (t as IntegrationService<unknown>).name,
              ).success,
          );

          return new IntegrationsService(
            configService.getConfig().home,
            integrationServices,
          );
        },
      },
    ],
  };
}

const metaModule = initDynamicIntegrationsProvider();

@Module({
  imports: [ConfigModule, ...metaModule.imports],
  providers: [...metaModule.providers],
  exports: [...metaModule.providers, ...metaModule.imports],
})
export class IntegrationsModule {}
