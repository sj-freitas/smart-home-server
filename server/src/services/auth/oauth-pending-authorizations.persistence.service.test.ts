import { Pool } from "pg";
import { OAuthPendingAuthorizationsPersistenceService } from "./oauth-pending-authorizations.persistence.service";

function makePool(queryImpl: jest.Mock): Pool {
  return { query: queryImpl } as unknown as Pool;
}

describe("OAuthPendingAuthorizationsPersistenceService.create", () => {
  it("inserts a row and returns the generated id", async () => {
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ id: "pending-id-1" }] });
    const service = new OAuthPendingAuthorizationsPersistenceService(
      makePool(query),
    );

    const id = await service.create({
      clientId: "client-1",
      redirectUri: "https://example.com/callback",
      codeChallenge: "challenge",
      state: "state-value",
      scopes: ["smart-home"],
      resource: "https://example.com/mcp",
    });

    expect(id).toBe("pending-id-1");
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("INSERT INTO");
    expect(params).toEqual([
      "client-1",
      "https://example.com/callback",
      "challenge",
      "state-value",
      JSON.stringify(["smart-home"]),
      "https://example.com/mcp",
      expect.any(Date),
    ]);
  });

  it("inserts null placeholders for optional fields", async () => {
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ id: "pending-id-2" }] });
    const service = new OAuthPendingAuthorizationsPersistenceService(
      makePool(query),
    );

    await service.create({
      clientId: "client-1",
      redirectUri: "https://example.com/callback",
      codeChallenge: "challenge",
    });

    const [, params] = query.mock.calls[0];
    expect(params).toEqual([
      "client-1",
      "https://example.com/callback",
      "challenge",
      null,
      null,
      null,
      expect.any(Date),
    ]);
  });
});

describe("OAuthPendingAuthorizationsPersistenceService.get", () => {
  it("returns null when no row matches", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthPendingAuthorizationsPersistenceService(
      makePool(query),
    );

    await expect(service.get("missing-id")).resolves.toBeNull();
  });

  it("returns the parsed pending authorization", async () => {
    const expiresAt = new Date();
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: "pending-id-1",
          created_at: new Date(),
          client_id: "client-1",
          redirect_uri: "https://example.com/callback",
          code_challenge: "challenge",
          state: "state-value",
          scopes: ["smart-home"],
          resource: "https://example.com/mcp",
          expires_at: expiresAt,
        },
      ],
    });
    const service = new OAuthPendingAuthorizationsPersistenceService(
      makePool(query),
    );

    const pending = await service.get("pending-id-1");

    expect(pending).toMatchObject({
      id: "pending-id-1",
      clientId: "client-1",
      redirectUri: "https://example.com/callback",
      codeChallenge: "challenge",
      state: "state-value",
      scopes: ["smart-home"],
      resource: "https://example.com/mcp",
      expiresAt,
    });
  });
});

describe("OAuthPendingAuthorizationsPersistenceService.delete", () => {
  it("issues a delete query for the given id", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthPendingAuthorizationsPersistenceService(
      makePool(query),
    );

    await service.delete("pending-id-1");

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("DELETE FROM");
    expect(params).toEqual(["pending-id-1"]);
  });
});
