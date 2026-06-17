import { Pool } from "pg";
import { z } from "zod";

const TABLE_NAME = "auth_oauth_tokens";

export const OAuthTokenZod = z
  .object({
    id: z.string().readonly(),
    created_at: z.date().readonly(),
    access_token_hash: z.string().readonly(),
    refresh_token_hash: z.string().nullable().readonly(),
    client_id: z.string().readonly(),
    email: z.string().readonly(),
    resource: z.string().nullable().readonly(),
    access_token_expires_at: z.date().readonly(),
    refresh_token_expires_at: z.date().nullable().readonly(),
  })
  .transform((data) => ({
    id: data.id,
    createdAt: data.created_at,
    accessTokenHash: data.access_token_hash,
    refreshTokenHash: data.refresh_token_hash ?? undefined,
    clientId: data.client_id,
    email: data.email,
    resource: data.resource ?? undefined,
    accessTokenExpiresAt: data.access_token_expires_at,
    refreshTokenExpiresAt: data.refresh_token_expires_at ?? undefined,
  }));

export type OAuthToken = z.infer<typeof OAuthTokenZod>;

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

export class OAuthTokensPersistenceService {
  public static readonly ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_MS / 1000;

  constructor(private readonly pool: Pool) {}

  public async create(params: {
    accessTokenHash: string;
    refreshTokenHash?: string;
    clientId: string;
    email: string;
    resource?: string;
  }): Promise<OAuthToken> {
    const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
    const refreshTokenExpiresAt = params.refreshTokenHash
      ? new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
      : null;

    const { rows } = await this.pool.query(
      `
        INSERT INTO ${TABLE_NAME} (
          access_token_hash,
          refresh_token_hash,
          client_id,
          email,
          resource,
          access_token_expires_at,
          refresh_token_expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        params.accessTokenHash,
        params.refreshTokenHash ?? null,
        params.clientId,
        params.email,
        params.resource ?? null,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
      ],
    );

    const [inserted] = rows;
    return OAuthTokenZod.parse(inserted);
  }

  public async findByAccessTokenHash(
    accessTokenHash: string,
  ): Promise<OAuthToken | null> {
    const { rows } = await this.pool.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        WHERE access_token_hash = $1
      `,
      [accessTokenHash],
    );

    const [matching] = rows;
    if (!matching) {
      return null;
    }

    return OAuthTokenZod.parse(matching);
  }

  public async findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<OAuthToken | null> {
    const { rows } = await this.pool.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        WHERE refresh_token_hash = $1 AND refresh_token_expires_at > now()
      `,
      [refreshTokenHash],
    );

    const [matching] = rows;
    if (!matching) {
      return null;
    }

    return OAuthTokenZod.parse(matching);
  }

  public async deleteById(id: string): Promise<void> {
    await this.pool.query(
      `
        DELETE FROM ${TABLE_NAME}
        WHERE id = $1
      `,
      [id],
    );
  }

  public async deleteByAccessTokenHash(accessTokenHash: string): Promise<void> {
    await this.pool.query(
      `
        DELETE FROM ${TABLE_NAME}
        WHERE access_token_hash = $1
      `,
      [accessTokenHash],
    );
  }
}
