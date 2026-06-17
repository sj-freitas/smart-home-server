import { Pool } from "pg";
import { OAuthTokensPersistenceService } from "./oauth-tokens.persistence.service";

function makePool(queryImpl: jest.Mock): Pool {
  return { query: queryImpl } as unknown as Pool;
}

describe("OAuthTokensPersistenceService.create", () => {
  it("inserts a row with both expiries when a refresh token is provided", async () => {
    const insertedRow = {
      id: "token-id-1",
      created_at: new Date(),
      access_token_hash: "access-hash",
      refresh_token_hash: "refresh-hash",
      client_id: "client-1",
      email: "user@example.com",
      resource: "https://example.com/mcp",
      access_token_expires_at: new Date(),
      refresh_token_expires_at: new Date(),
    };
    const query = jest.fn().mockResolvedValue({ rows: [insertedRow] });
    const service = new OAuthTokensPersistenceService(makePool(query));

    const token = await service.create({
      accessTokenHash: "access-hash",
      refreshTokenHash: "refresh-hash",
      clientId: "client-1",
      email: "user@example.com",
      resource: "https://example.com/mcp",
    });

    expect(token).toMatchObject({
      id: "token-id-1",
      accessTokenHash: "access-hash",
      refreshTokenHash: "refresh-hash",
      clientId: "client-1",
      email: "user@example.com",
      resource: "https://example.com/mcp",
    });

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("INSERT INTO");
    expect(params[0]).toBe("access-hash");
    expect(params[1]).toBe("refresh-hash");
    expect(params[5]).toBeInstanceOf(Date);
    expect(params[6]).toBeInstanceOf(Date);
  });

  it("stores a null refresh expiry when no refresh token is provided", async () => {
    const insertedRow = {
      id: "token-id-2",
      created_at: new Date(),
      access_token_hash: "access-hash",
      refresh_token_hash: null,
      client_id: "client-1",
      email: "user@example.com",
      resource: null,
      access_token_expires_at: new Date(),
      refresh_token_expires_at: null,
    };
    const query = jest.fn().mockResolvedValue({ rows: [insertedRow] });
    const service = new OAuthTokensPersistenceService(makePool(query));

    await service.create({
      accessTokenHash: "access-hash",
      clientId: "client-1",
      email: "user@example.com",
    });

    const [, params] = query.mock.calls[0];
    expect(params[1]).toBeNull();
    expect(params[6]).toBeNull();
  });
});

describe("OAuthTokensPersistenceService.findByAccessTokenHash", () => {
  it("returns null when no row matches", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthTokensPersistenceService(makePool(query));

    await expect(service.findByAccessTokenHash("missing")).resolves.toBeNull();
  });

  it("returns the parsed token", async () => {
    const accessTokenExpiresAt = new Date();
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: "token-id-1",
          created_at: new Date(),
          access_token_hash: "access-hash",
          refresh_token_hash: null,
          client_id: "client-1",
          email: "user@example.com",
          resource: null,
          access_token_expires_at: accessTokenExpiresAt,
          refresh_token_expires_at: null,
        },
      ],
    });
    const service = new OAuthTokensPersistenceService(makePool(query));

    const token = await service.findByAccessTokenHash("access-hash");

    expect(token).toMatchObject({
      id: "token-id-1",
      accessTokenHash: "access-hash",
      clientId: "client-1",
      email: "user@example.com",
      accessTokenExpiresAt,
    });
  });
});

describe("OAuthTokensPersistenceService.findByRefreshTokenHash", () => {
  it("returns null when no unexpired row matches", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthTokensPersistenceService(makePool(query));

    await expect(service.findByRefreshTokenHash("missing")).resolves.toBeNull();
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("refresh_token_expires_at > now()");
    expect(params).toEqual(["missing"]);
  });

  it("returns the parsed token", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: "token-id-1",
          created_at: new Date(),
          access_token_hash: "access-hash",
          refresh_token_hash: "refresh-hash",
          client_id: "client-1",
          email: "user@example.com",
          resource: null,
          access_token_expires_at: new Date(),
          refresh_token_expires_at: new Date(),
        },
      ],
    });
    const service = new OAuthTokensPersistenceService(makePool(query));

    const token = await service.findByRefreshTokenHash("refresh-hash");

    expect(token?.refreshTokenHash).toBe("refresh-hash");
  });
});

describe("OAuthTokensPersistenceService.deleteById", () => {
  it("issues a delete query for the given id", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthTokensPersistenceService(makePool(query));

    await service.deleteById("token-id-1");

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("DELETE FROM");
    expect(sql).toContain("WHERE id = $1");
    expect(params).toEqual(["token-id-1"]);
  });
});

describe("OAuthTokensPersistenceService.deleteByAccessTokenHash", () => {
  it("issues a delete query for the given access token hash", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const service = new OAuthTokensPersistenceService(makePool(query));

    await service.deleteByAccessTokenHash("access-hash");

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("DELETE FROM");
    expect(sql).toContain("WHERE access_token_hash = $1");
    expect(params).toEqual(["access-hash"]);
  });
});

describe("OAuthTokensPersistenceService.ACCESS_TOKEN_TTL_SECONDS", () => {
  it("is one hour expressed in seconds", () => {
    expect(OAuthTokensPersistenceService.ACCESS_TOKEN_TTL_SECONDS).toBe(
      60 * 60,
    );
  });
});
