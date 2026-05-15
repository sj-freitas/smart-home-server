import { z } from "zod";

export const ScheduledActionZod = z
  .object({
    id: z.string(),
    created_at: z.date(),
    execute_at: z.date(),
    action_path: z.string(),
  })
  .transform((data) => ({
    id: data.id,
    createdAt: data.created_at,
    executeAt: data.execute_at,
    actionPath: data.action_path,
  }));

export type ScheduledAction = z.infer<typeof ScheduledActionZod>;
