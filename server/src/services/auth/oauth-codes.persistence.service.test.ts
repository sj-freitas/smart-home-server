import { Pool } from "pg";
import { OAuthCodesPersistenceService } from "./oauth-codes.persistence.service";

function makePool(queryImpl: jest.Mock): Pool {
  return { query: queryImpl } as unknown as Pool;
}

describe("OAuthCodesPersistenceService.create", () => {
  it("inserts a row with an expiry in the future", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthCodesPersistenceService(makePool(query));

    await service.create({
      codeHash: "code-hash",
      clientId: "client-1",
      redirectUri: "https://example.com/callback",
      codeChallenge: "challenge",
      email: "user@example.com",
      resource: "https://example.com/mcp",
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("INSERT INTO");
    expect(params).toEqual([
      "code-hash",
      "client-1",
      "https://example.com/callback",
      "challenge",
      "user@example.com",
      "https://example.com/mcp",
      expect.any(Date),
    ]);
    expect((params[6] as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("inserts null for an absent resource", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthCodesPersistenceService(makePool(query));

    await service.create({
      codeHash: "code-hash",
      clientId: "client-1",
      redirectUri: "https://example.com/callback",
      codeChallenge: "challenge",
      email: "user@example.com",
    });

    const [, params] = query.mock.calls[0];
    expect(params[5]).toBeNull();
  });
});

describe("OAuthCodesPersistenceService.get", () => {
  it("returns null when no unexpired row matches", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthCodesPersistenceService(makePool(query));

    await expect(service.get("missing-hash")).resolves.toBeNull();
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("expires_at > now()");
    expect(params).toEqual(["missing-hash"]);
  });

  it("returns the parsed code", async () => {
    const expiresAt = new Date();
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          code_hash: "code-hash",
          created_at: new Date(),
          client_id: "client-1",
          redirect_uri: "https://example.com/callback",
          code_challenge: "challenge",
          email: "user@example.com",
          resource: null,
          expires_at: expiresAt,
        },
      ],
    });
    const service = new OAuthCodesPersistenceService(makePool(query));

    const code = await service.get("code-hash");

    expect(code).toMatchObject({
      codeHash: "code-hash",
      clientId: "client-1",
      redirectUri: "https://example.com/callback",
      codeChallenge: "challenge",
      email: "user@example.com",
      resource: undefined,
      expiresAt,
    });
  });
});

describe("OAuthCodesPersistenceService.consume", () => {
  it("returns null when no unexpired row matches", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthCodesPersistenceService(makePool(query));

    await expect(service.consume("missing-hash")).resolves.toBeNull();
    const [sql] = query.mock.calls[0];
    expect(sql).toContain("DELETE FROM");
    expect(sql).toContain("expires_at > now()");
  });

  it("returns the deleted code", async () => {
    const expiresAt = new Date();
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          code_hash: "code-hash",
          created_at: new Date(),
          client_id: "client-1",
          redirect_uri: "https://example.com/callback",
          code_challenge: "challenge",
          email: "user@example.com",
          resource: "https://example.com/mcp",
          expires_at: expiresAt,
        },
      ],
    });
    const service = new OAuthCodesPersistenceService(makePool(query));

    const code = await service.consume("code-hash");

    expect(code).toMatchObject({
      codeHash: "code-hash",
      clientId: "client-1",
      resource: "https://example.com/mcp",
    });
  });
});
