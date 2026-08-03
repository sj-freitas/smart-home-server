import { Pool } from "pg";
import { z } from "zod";

const HomeInfoZod = z
  .object({
    id: z.string(),
    created_at: z.date(),
    home_id: z.string(),
    markdown: z.string(),
  })
  .transform((d) => ({
    id: d.id,
    createdAt: d.created_at,
    homeId: d.home_id,
    markdown: d.markdown,
  }));

export type HomeInfo = z.infer<typeof HomeInfoZod>;

export class HomeInfoPersistenceService {
  constructor(private readonly pool: Pool) {}

  public async getLatestByHomeId(homeId: string): Promise<HomeInfo | null> {
    const { rows } = await this.pool.query(
      `SELECT id, created_at, home_id, markdown
       FROM public.home_info
       WHERE home_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [homeId],
    );

    if (rows.length === 0) {
      return null;
    }

    return HomeInfoZod.parse(rows[0]);
  }
}
