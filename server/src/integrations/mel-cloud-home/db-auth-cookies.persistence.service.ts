import { Pool } from "pg";
import { MelCloudAuthCookiesPersistenceService } from "./auth-cookies.persistence.service";
import { MelCloudAuthCookiesRowZod } from "./auth-cookies.sql.types.zod";

export class DbMelCloudAuthCookiesPersistenceService implements MelCloudAuthCookiesPersistenceService {
  constructor(private readonly pool: Pool) {}

  async storeAuthCookies(cookies: string): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO mel_cloud_home_auth_cookies (cookies)
      VALUES ($1)
      `,
      [cookies],
    );
  }

  async retrieveAuthCookies(): Promise<string | null> {
    const { rows } = await this.pool.query(`
      SELECT *
      FROM mel_cloud_home_auth_cookies
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const [lastRow] = rows;
    if (!lastRow) {
      return null;
    }

    return MelCloudAuthCookiesRowZod.parse(lastRow).cookies;
  }
}
