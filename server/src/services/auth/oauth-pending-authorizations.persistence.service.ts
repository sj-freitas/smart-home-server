import { Pool } from "pg";
import { z } from "zod";

const TABLE_NAME = "auth_oauth_pending_authorizations";

export const OAuthPendingAuthorizationZod = z
  .object({
    id: z.string().readonly(),
    created_at: z.date().readonly(),
    client_id: z.string().readonly(),
    redirect_uri: z.string().readonly(),
    code_challenge: z.string().readonly(),
    state: z.string().nullable().readonly(),
    scopes: z.array(z.string()).nullable().readonly(),
    resource: z.string().nullable().readonly(),
    expires_at: z.date().readonly(),
  })
  .transform((data) => ({
    id: data.id,
    createdAt: data.created_at,
    clientId: data.client_id,
    redirectUri: data.redirect_uri,
    codeChallenge: data.code_challenge,
    state: data.state ?? undefined,
    scopes: data.scopes ?? undefined,
    resource: data.resource ?? undefined,
    expiresAt: data.expires_at,
  }));

export type OAuthPendingAuthorization = z.infer<typeof OAuthPendingAuthorizationZod>;

const PENDING_AUTHORIZATION_TTL_MS = 5 * 60 * 1000;

export class OAuthPendingAuthorizationsPersistenceService {
  constructor(private readonly pool: Pool) {}

  public async create(params: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    state?: string;
    scopes?: string[];
    resource?: string;
  }): Promise<string> {
    const expiresAt = new Date(Date.now() + PENDING_AUTHORIZATION_TTL_MS);

    const { rows } = await this.pool.query(
      `
        INSERT INTO ${TABLE_NAME} (
          client_id,
          redirect_uri,
          code_challenge,
          state,
          scopes,
          resource,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [
        params.clientId,
        params.redirectUri,
        params.codeChallenge,
        params.state ?? null,
        params.scopes ? JSON.stringify(params.scopes) : null,
        params.resource ?? null,
        expiresAt,
      ],
    );

    const [inserted] = rows;
    return inserted.id as string;
  }

  public async get(id: string): Promise<OAuthPendingAuthorization | null> {
    const { rows } = await this.pool.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        WHERE id = $1 AND expires_at > now()
      `,
      [id],
    );

    const [matching] = rows;
    if (!matching) {
      return null;
    }

    return OAuthPendingAuthorizationZod.parse(matching);
  }

  public async delete(id: string): Promise<void> {
    await this.pool.query(
      `
        DELETE FROM ${TABLE_NAME}
        WHERE id = $1
      `,
      [id],
    );
  }
}
