import { Pool } from "pg";
import { z } from "zod";
import {
  OAuthClientInformationFull,
  OAuthClientInformationFullSchema,
  OAuthClientMetadata,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { decryptSecret, encryptSecret, generateOpaqueToken } from "../../helpers/crypto.helper";

const TABLE_NAME = "auth_oauth_clients";

const DbOAuthClientZod = z.object({
  client_id: z.string().readonly(),
  client_secret_encrypted: z.string().nullable().readonly(),
  client_id_issued_at: z.coerce.number().readonly(),
  client_secret_expires_at: z.coerce.number().readonly(),
  metadata: z.record(z.string(), z.unknown()).readonly(),
});

function toClientInformation(row: z.infer<typeof DbOAuthClientZod>): OAuthClientInformationFull {
  const clientSecret = row.client_secret_encrypted
    ? decryptSecret(row.client_secret_encrypted)
    : undefined;

  return OAuthClientInformationFullSchema.parse({
    ...row.metadata,
    client_id: row.client_id,
    client_secret: clientSecret,
    client_id_issued_at: row.client_id_issued_at,
    client_secret_expires_at: row.client_secret_expires_at,
  });
}

export class OAuthClientsPersistenceService {
  constructor(private readonly pool: Pool) {}

  public async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const { rows } = await this.pool.query(
      `
        SELECT *
        FROM ${TABLE_NAME}
        WHERE client_id = $1
      `,
      [clientId],
    );

    const [matchingClient] = rows;
    if (!matchingClient) {
      return undefined;
    }

    return toClientInformation(DbOAuthClientZod.parse(matchingClient));
  }

  public async registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
  ): Promise<OAuthClientInformationFull> {
    const clientId = generateOpaqueToken();
    const clientIdIssuedAt = Math.floor(Date.now() / 1000);
    const isPublicClient = client.token_endpoint_auth_method === "none";

    const clientSecret = isPublicClient ? undefined : (client.client_secret ?? generateOpaqueToken());
    const clientSecretEncrypted = clientSecret ? encryptSecret(clientSecret) : null;
    const clientSecretExpiresAt = client.client_secret_expires_at ?? 0;

    const { client_secret: _clientSecret, client_secret_expires_at: _clientSecretExpiresAt, ...metadata } =
      client as OAuthClientMetadata & {
        client_secret?: string;
        client_secret_expires_at?: number;
      };

    await this.pool.query(
      `
        INSERT INTO ${TABLE_NAME} (
          client_id,
          client_secret_encrypted,
          client_id_issued_at,
          client_secret_expires_at,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [clientId, clientSecretEncrypted, clientIdIssuedAt, clientSecretExpiresAt, metadata],
    );

    return OAuthClientInformationFullSchema.parse({
      ...metadata,
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: clientIdIssuedAt,
      client_secret_expires_at: clientSecretExpiresAt,
    });
  }
}
