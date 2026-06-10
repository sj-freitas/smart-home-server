import { Pool } from "pg";
import { z } from "zod";

const TABLE_NAME = "auth_oauth_codes";

export const OAuthCodeZod = z
  .object({
    code_hash: z.string().readonly(),
    created_at: z.date().readonly(),
    client_id: z.string().readonly(),
    redirect_uri: z.string().readonly(),
    code_challenge: z.string().readonly(),
    email: z.string().readonly(),
    resource: z.string().nullable().readonly(),
    expires_at: z.date().readonly(),
  })
  .transform((data) => ({
    codeHash: data.code_hash,
    createdAt: data.created_at,
    clientId: data.client_id,
    redirectUri: data.redirect_uri,
    codeChallenge: data.code_challenge,
    email: data.email,
    resource: data.resource ?? undefined,
    expiresAt: data.expires_at,
  }));

export type OAuthCode = z.infer<typeof OAuthCodeZod>;

const AUTHORIZATION_CODE_TTL_MS = 60 * 1000;

export class OAuthCodesPersistenceService {
  constructor(private readonly pool: Pool) {}

  public async create(params: {
    codeHash: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    email: string;
    resource?: string;
  }): Promise<void> {
    const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS);

    await this.pool.query(
      `
        INSERT INTO ${TABLE_NAME} (
          code_hash,
          client_id,
          redirect_uri,
          code_challenge,
          email,
          resource,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        params.codeHash,
        params.clientId,
        params.redirectUri,
        params.codeChallenge,
        params.email,
        params.resource ?? null,
        expiresAt,
      ],
    );
  }

  /**
   * Looks up a code without consuming it. Used for PKCE challenge validation,
   * which happens before the code is exchanged.
   */
  public async get(codeHash: string): Promise<OAuthCode | null> {
    const { rows } = await this.pool.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        WHERE code_hash = $1 AND expires_at > now()
      `,
      [codeHash],
    );

    const [matching] = rows;
    if (!matching) {
      return null;
    }

    return OAuthCodeZod.parse(matching);
  }

  /**
   * Looks up and deletes a code in one step, so it can only be exchanged once.
   */
  public async consume(codeHash: string): Promise<OAuthCode | null> {
    const { rows } = await this.pool.query(
      `
        DELETE FROM ${TABLE_NAME}
        WHERE code_hash = $1 AND expires_at > now()
        RETURNING *
      `,
      [codeHash],
    );

    const [deleted] = rows;
    if (!deleted) {
      return null;
    }

    return OAuthCodeZod.parse(deleted);
  }
}
