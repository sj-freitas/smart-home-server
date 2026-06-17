import { Pool } from "pg";
import { OAuthClientsPersistenceService } from "./oauth-clients.persistence.service";
import { decryptSecret } from "../../helpers/crypto.helper";

function makePool(queryImpl: jest.Mock): Pool {
  return { query: queryImpl } as unknown as Pool;
}

describe("OAuthClientsPersistenceService.getClient", () => {
  it("returns undefined when no client matches", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthClientsPersistenceService(makePool(query));

    await expect(service.getClient("missing-client")).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("SELECT *"), [
      "missing-client",
    ]);
  });

  it("returns the parsed client without a secret when none is stored", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          client_id: "client-1",
          client_secret_encrypted: null,
          client_id_issued_at: 1000,
          client_secret_expires_at: 0,
          metadata: {
            redirect_uris: ["https://example.com/callback"],
            token_endpoint_auth_method: "none",
          },
        },
      ],
    });
    const service = new OAuthClientsPersistenceService(makePool(query));

    const client = await service.getClient("client-1");

    expect(client).toMatchObject({
      client_id: "client-1",
      client_id_issued_at: 1000,
      client_secret_expires_at: 0,
      redirect_uris: ["https://example.com/callback"],
      token_endpoint_auth_method: "none",
    });
    expect(client?.client_secret).toBeUndefined();
  });

  it("decrypts a stored client secret", async () => {
    const { encryptSecret } = await import("../../helpers/crypto.helper");
    const encrypted = encryptSecret("plain-secret");

    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          client_id: "client-2",
          client_secret_encrypted: encrypted,
          client_id_issued_at: 1000,
          client_secret_expires_at: 0,
          metadata: {
            redirect_uris: ["https://example.com/callback"],
            token_endpoint_auth_method: "client_secret_post",
          },
        },
      ],
    });
    const service = new OAuthClientsPersistenceService(makePool(query));

    const client = await service.getClient("client-2");

    expect(client?.client_secret).toBe("plain-secret");
    expect(decryptSecret(encrypted)).toBe("plain-secret");
  });
});

describe("OAuthClientsPersistenceService.registerClient", () => {
  it("registers a confidential client and persists an encrypted secret", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthClientsPersistenceService(makePool(query));

    const client = await service.registerClient({
      redirect_uris: ["https://example.com/callback"],
      token_endpoint_auth_method: "client_secret_post",
    });

    expect(client.client_id).toBeTruthy();
    expect(client.client_secret).toBeTruthy();
    expect(client.redirect_uris).toEqual(["https://example.com/callback"]);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("INSERT INTO");
    const [
      clientId,
      clientSecretEncrypted,
      clientIdIssuedAt,
      clientSecretExpiresAt,
      metadata,
    ] = params;
    expect(clientId).toBe(client.client_id);
    expect(clientSecretEncrypted).toBeTruthy();
    expect(decryptSecret(clientSecretEncrypted)).toBe(client.client_secret);
    expect(clientIdIssuedAt).toBe(client.client_id_issued_at);
    expect(clientSecretExpiresAt).toBe(0);
    expect(metadata).not.toHaveProperty("client_secret");
    expect(metadata).not.toHaveProperty("client_secret_expires_at");
  });

  it("registers a public client without a secret", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthClientsPersistenceService(makePool(query));

    const client = await service.registerClient({
      redirect_uris: ["https://example.com/callback"],
      token_endpoint_auth_method: "none",
    });

    expect(client.client_secret).toBeUndefined();

    const [, params] = query.mock.calls[0];
    const [, clientSecretEncrypted] = params;
    expect(clientSecretEncrypted).toBeNull();
  });

  it("preserves a client-supplied secret instead of generating a new one", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthClientsPersistenceService(makePool(query));

    const client = await service.registerClient({
      redirect_uris: ["https://example.com/callback"],
      token_endpoint_auth_method: "client_secret_post",
      client_secret: "caller-supplied-secret",
      client_secret_expires_at: 12345,
    } as never);

    expect(client.client_secret).toBe("caller-supplied-secret");
    expect(client.client_secret_expires_at).toBe(12345);
  });
});
