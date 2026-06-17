import { ScheduledAction } from "./types.zod";
import { TimerPersistenceService } from "./timer.persistence.service";

export class TimerService {
  constructor(private readonly persistence: TimerPersistenceService) {}

  public async schedule(
    actionPath: string,
    durationInMinutes: number,
  ): Promise<void> {
    const executeAt = new Date(Date.now() + durationInMinutes * 60 * 1000);
    await this.persistence.schedule(actionPath, executeAt);
  }

  public async getDueActions(): Promise<ScheduledAction[]> {
    return this.persistence.getDueActions();
  }

  public async delete(id: string): Promise<void> {
    return this.persistence.delete(id);
  }
}
