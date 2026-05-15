import { TimerOnAction } from "../../../config/home.zod";
import { TimerService } from "./timer.service";
import { OnActionHandler } from "../on-actions-service";

export class TimerOnActionHandler implements OnActionHandler<TimerOnAction> {
  readonly type = "timer" as const;

  constructor(private readonly timerService: TimerService) {}

  public async handle(onAction: TimerOnAction): Promise<void> {
    const { durationInMinutes, action } = onAction.parameters;
    await this.timerService.schedule(action, durationInMinutes);
  }
}
