import { Module } from "@nestjs/common";
import { ConfigService } from "../../config/config-service";
import { OnActionTypeNames } from "../../config/home.zod";
import { OnActionHandler, OnActionsService } from "./on-actions-service";
import { TimerOnActionHandler } from "./timer/timer.on-action-handler";
import { TimerOnActionModule } from "./timer/module";

type OnActionDef = { handlerClass: any; moduleClass: any };

const onActionsRegistry = new Map<OnActionTypeNames, OnActionDef>([
  ["timer", { handlerClass: TimerOnActionHandler, moduleClass: TimerOnActionModule }],
]);

function buildModuleConfig() {
  const config = ConfigService.create().getConfig();

  const usedTypes = new Set<string>();
  for (const room of config.home.rooms) {
    for (const device of room.devices) {
      for (const action of device.actions ?? []) {
        if (action.onAction) {
          usedTypes.add(action.onAction.type);
        }
      }
    }
  }

  const activeDefs = Array.from(usedTypes)
    .map((type) => onActionsRegistry.get(type as OnActionTypeNames))
    .filter((def): def is OnActionDef => def !== undefined);

  const OnActionsServiceProvider = {
    provide: OnActionsService,
    inject: activeDefs.map((d) => d.handlerClass),
    useFactory: (...handlers: OnActionHandler[]) => new OnActionsService(handlers),
  };

  return {
    imports: activeDefs.map((d) => d.moduleClass),
    providers: [OnActionsServiceProvider],
    exports: [OnActionsService],
  };
}

@Module(buildModuleConfig())
export class OnActionsModule {}
