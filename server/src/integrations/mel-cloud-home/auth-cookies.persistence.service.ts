import { Pool } from "pg";

export class MelCloudAuthCookiesPersistenceService {
<<<<<<< Updated upstream
  private authCookies: string | null = null;
  public forceRefresh: (() => Promise<void>) | null = null;
=======
  private cachedCookies: string | null = null;

  constructor(private readonly pool: Pool) {}
>>>>>>> Stashed changes

  public async storeAuthCookies(authCookies: string): Promise<void> {
    this.cachedCookies = authCookies;
    await this.pool.query(
      `INSERT INTO public.mel_cloud_auth_cookies (cookies) VALUES ($1)`,
      [authCookies],
    );
  }

  public async retrieveAuthCookies(): Promise<string | null> {
    if (this.cachedCookies !== null) {
      return this.cachedCookies;
    }

    const { rows } = await this.pool.query(`
      SELECT cookies FROM public.mel_cloud_auth_cookies
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const [row] = rows;
    if (!row) {
      return null;
    }

    this.cachedCookies = row.cookies as string;
    return this.cachedCookies;
  }
}
