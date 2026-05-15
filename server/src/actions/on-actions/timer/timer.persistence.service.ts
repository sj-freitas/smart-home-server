import { Pool } from "pg";
import { ScheduledAction, ScheduledActionZod } from "./types.zod";

export class TimerPersistenceService {
  constructor(private readonly pool: Pool) {}

  public async schedule(actionPath: string, executeAt: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.scheduled_actions (action_path, execute_at) VALUES ($1, $2)`,
      [actionPath, executeAt],
    );
  }

  public async getDueActions(now = new Date()): Promise<ScheduledAction[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM public.scheduled_actions WHERE execute_at <= $1`,
      [now],
    );
    return rows.map((row) => ScheduledActionZod.parse(row));
  }

  public async delete(id: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM public.scheduled_actions WHERE id = $1`,
      [id],
    );
  }
}
