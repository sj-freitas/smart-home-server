import { Pool } from "pg";
import { z } from "zod";

const HomeInfoImageZod = z
  .object({
    id: z.string(),
    created_at: z.date(),
    home_id: z.string(),
    name: z.string(),
    image_base64: z.string(),
  })
  .transform((d) => ({
    id: d.id,
    createdAt: d.created_at,
    homeId: d.home_id,
    name: d.name,
    imageBase64: d.image_base64,
  }));

export type HomeInfoImage = z.infer<typeof HomeInfoImageZod>;

export class HomeInfoImagesPersistenceService {
  constructor(private readonly pool: Pool) {}

  public async getByHomeIdAndName(
    homeId: string,
    name: string,
  ): Promise<HomeInfoImage | null> {
    const { rows } = await this.pool.query(
      `SELECT id, created_at, home_id, name, image_base64
       FROM public.home_info_images
       WHERE home_id = $1 AND name = $2`,
      [homeId, name],
    );

    if (rows.length === 0) {
      return null;
    }

    return HomeInfoImageZod.parse(rows[0]);
  }
}
