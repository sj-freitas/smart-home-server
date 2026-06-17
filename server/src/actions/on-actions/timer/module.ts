import { forwardRef, Module } from "@nestjs/common";
import { Pool } from "pg";
import { ServicesModule } from "../../../services/module";
import { ActionsModule } from "../../module";
import { ActionRunnerService } from "../../action-runner.service";
import { TimerPersistenceService } from "./timer.persistence.service";
import { TimerService } from "./timer.service";
import { TimerOnActionHandler } from "./timer.on-action-handler";
import { startScheduler } from "../../../helpers/scheduler";

const TIMER_PROCESSOR = "TimerProcessor";

const TimerPersistenceServiceProvider = {
  provide: TimerPersistenceService,
  inject: [Pool],
  useFactory: (pool: Pool) => new TimerPersistenceService(pool),
};

const TimerServiceProvider = {
  provide: TimerService,
  inject: [TimerPersistenceService],
  useFactory: (persistence: TimerPersistenceService) =>
    new TimerService(persistence),
};

const TimerOnActionHandlerProvider = {
  provide: TimerOnActionHandler,
  inject: [TimerService],
  useFactory: (timerService: TimerService) =>
    new TimerOnActionHandler(timerService),
};

const TimerProcessorProvider = {
  provide: TIMER_PROCESSOR,
  inject: [TimerService, forwardRef(() => ActionRunnerService)] as any[],
  useFactory: async (
    timerService: TimerService,
    runner: ActionRunnerService,
  ) => {
    await startScheduler(async () => {
      const due = await timerService.getDueActions();
      for (const action of due) {
        await timerService.delete(action.id);
        const [roomId, deviceId, actionId] = action.actionPath.split("/");
        const result = await runner.run(roomId, deviceId, actionId);
        if (result.found === false) {
          console.error(
            `Scheduled action for ${action.actionPath}: ${result.message}`,
          );
        }
      }
    }, 60_000);
  },
};

@Module({
  imports: [ServicesModule, forwardRef(() => ActionsModule)],
  providers: [
    TimerPersistenceServiceProvider,
    TimerServiceProvider,
    TimerOnActionHandlerProvider,
    TimerProcessorProvider,
  ],
  exports: [TimerServiceProvider, TimerOnActionHandlerProvider],
})
export class TimerOnActionModule {}
