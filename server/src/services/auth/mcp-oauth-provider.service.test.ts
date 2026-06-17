import { Response } from "express";
import {
  InvalidGrantError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import { McpOAuthProviderService } from "./mcp-oauth-provider.service";
import { GoogleAuthConfig } from "./google-auth";
import { GoogleSessionService } from "./google-session.service";
import { EmailsPersistenceService } from "./emails.persistence.service";
import { OAuthClientsPersistenceService } from "./oauth-clients.persistence.service";
import { OAuthPendingAuthorizationsPersistenceService } from "./oauth-pending-authorizations.persistence.service";
import { OAuthCodesPersistenceService } from "./oauth-codes.persistence.service";
import { OAuthTokensPersistenceService } from "./oauth-tokens.persistence.service";
import { hashOpaqueToken } from "../../helpers/crypto.helper";

const CLIENT: OAuthClientInformationFull = {
  client_id: "client-1",
  redirect_uris: ["https://example.com/callback"],
  token_endpoint_auth_method: "none",
  client_id_issued_at: 0,
  client_secret_expires_at: 0,
} as unknown as OAuthClientInformationFull;

function makeResponse(cookies: Record<string, string> = {}): Response {
  return {
    req: { cookies },
    redirect: jest.fn(),
  } as unknown as Response;
}

function makeService(
  opts: {
    sessionResult?: { email: string } | null;
    emailValid?: boolean;
  } = {},
) {
  const { sessionResult = null, emailValid = true } = opts;

  const googleAuthConfig = {
    clientId: "google-client-id",
    redirectUri: "https://api.example.com/api/auth/google/callback",
  } as unknown as GoogleAuthConfig;

  const googleSessionService = {
    validateSession: jest.fn().mockResolvedValue(sessionResult),
  } as unknown as GoogleSessionService;

  const emailsPersistenceService = {
    validateEmail: jest.fn().mockResolvedValue(emailValid),
  } as unknown as EmailsPersistenceService;

  const clientsPersistenceService = {
    getClient: jest.fn(),
    registerClient: jest.fn(),
  } as unknown as OAuthClientsPersistenceService;

  const pendingAuthorizationsPersistenceService = {
    create: jest.fn().mockResolvedValue("pending-id-1"),
    get: jest.fn(),
    delete: jest.fn(),
  } as unknown as OAuthPendingAuthorizationsPersistenceService;

  const codesPersistenceService = {
    create: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    consume: jest.fn(),
  } as unknown as OAuthCodesPersistenceService;

  const tokensPersistenceService = {
    create: jest.fn(),
    findByAccessTokenHash: jest.fn(),
    findByRefreshTokenHash: jest.fn(),
    deleteById: jest.fn(),
    deleteByAccessTokenHash: jest.fn(),
  } as unknown as OAuthTokensPersistenceService;

  const service = new McpOAuthProviderService(
    googleAuthConfig,
    googleSessionService,
    emailsPersistenceService,
    clientsPersistenceService,
    pendingAuthorizationsPersistenceService,
    codesPersistenceService,
    tokensPersistenceService,
  );

  return {
    service,
    googleSessionService,
    emailsPersistenceService,
    clientsPersistenceService,
    pendingAuthorizationsPersistenceService,
    codesPersistenceService,
    tokensPersistenceService,
  };
}

describe("McpOAuthProviderService.authorize", () => {
  it("redirects to Google login when there is no session cookie", async () => {
    const { service, pendingAuthorizationsPersistenceService } = makeService();
    const res = makeResponse();

    await service.authorize(
      CLIENT,
      {
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
        state: "state-1",
      },
      res,
    );

    expect(pendingAuthorizationsPersistenceService.create).toHaveBeenCalledWith(
      {
        clientId: "client-1",
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
        state: "state-1",
        scopes: undefined,
        resource: undefined,
      },
    );

    const redirectUrl = new URL((res.redirect as jest.Mock).mock.calls[0][0]);
    expect(redirectUrl.origin + redirectUrl.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(redirectUrl.searchParams.get("state")).toBe("pending-id-1");
    expect(redirectUrl.searchParams.get("client_id")).toBe("google-client-id");
  });

  it("redirects to Google login when the session cookie does not resolve to a session", async () => {
    const { service, pendingAuthorizationsPersistenceService } = makeService({
      sessionResult: null,
    });
    const res = makeResponse({ session: "bad-session" });

    await service.authorize(
      CLIENT,
      {
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
      },
      res,
    );

    expect(pendingAuthorizationsPersistenceService.create).toHaveBeenCalled();
  });

  it("redirects to Google login when the session email is not allowed", async () => {
    const { service, pendingAuthorizationsPersistenceService } = makeService({
      sessionResult: { email: "blocked@example.com" },
      emailValid: false,
    });
    const res = makeResponse({ session: "good-session" });

    await service.authorize(
      CLIENT,
      {
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
      },
      res,
    );

    expect(pendingAuthorizationsPersistenceService.create).toHaveBeenCalled();
  });

  it("issues an authorization code immediately when a valid session exists", async () => {
    const {
      service,
      codesPersistenceService,
      pendingAuthorizationsPersistenceService,
    } = makeService({
      sessionResult: { email: "user@example.com" },
      emailValid: true,
    });
    const res = makeResponse({ session: "good-session" });

    await service.authorize(
      CLIENT,
      {
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
        state: "state-1",
      },
      res,
    );

    expect(
      pendingAuthorizationsPersistenceService.create,
    ).not.toHaveBeenCalled();
    expect(codesPersistenceService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
        email: "user@example.com",
      }),
    );

    const redirectUrl = new URL((res.redirect as jest.Mock).mock.calls[0][0]);
    expect(redirectUrl.origin + redirectUrl.pathname).toBe(
      "https://example.com/callback",
    );
    expect(redirectUrl.searchParams.get("state")).toBe("state-1");
    expect(redirectUrl.searchParams.get("code")).toBeTruthy();
  });
});

describe("McpOAuthProviderService.completeAuthorization", () => {
  it("stores a hashed code and redirects with code and state", async () => {
    const { service, codesPersistenceService } = makeService();
    const res = makeResponse();

    await service.completeAuthorization(
      CLIENT,
      {
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
        state: "state-1",
      },
      "user@example.com",
      res,
    );

    expect(codesPersistenceService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
        email: "user@example.com",
      }),
    );

    const redirectUrl = new URL((res.redirect as jest.Mock).mock.calls[0][0]);
    expect(redirectUrl.searchParams.get("state")).toBe("state-1");
    expect(redirectUrl.searchParams.get("code")).toBeTruthy();
  });

  it("omits the state param when none was provided", async () => {
    const { service } = makeService();
    const res = makeResponse();

    await service.completeAuthorization(
      CLIENT,
      {
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
      },
      "user@example.com",
      res,
    );

    const redirectUrl = new URL((res.redirect as jest.Mock).mock.calls[0][0]);
    expect(redirectUrl.searchParams.has("state")).toBe(false);
  });
});

describe("McpOAuthProviderService.challengeForAuthorizationCode", () => {
  it("returns the stored code challenge for a matching client", async () => {
    const { service, codesPersistenceService } = makeService();
    (codesPersistenceService.get as jest.Mock).mockResolvedValue({
      clientId: "client-1",
      codeChallenge: "challenge-value",
    });

    await expect(
      service.challengeForAuthorizationCode(CLIENT, "auth-code"),
    ).resolves.toBe("challenge-value");
  });

  it("throws InvalidGrantError when the code does not exist", async () => {
    const { service, codesPersistenceService } = makeService();
    (codesPersistenceService.get as jest.Mock).mockResolvedValue(null);

    await expect(
      service.challengeForAuthorizationCode(CLIENT, "auth-code"),
    ).rejects.toThrow(InvalidGrantError);
  });

  it("throws InvalidGrantError when the code belongs to a different client", async () => {
    const { service, codesPersistenceService } = makeService();
    (codesPersistenceService.get as jest.Mock).mockResolvedValue({
      clientId: "other-client",
      codeChallenge: "challenge-value",
    });

    await expect(
      service.challengeForAuthorizationCode(CLIENT, "auth-code"),
    ).rejects.toThrow(InvalidGrantError);
  });
});

describe("McpOAuthProviderService.exchangeAuthorizationCode", () => {
  it("issues tokens for a valid, matching code", async () => {
    const { service, codesPersistenceService, tokensPersistenceService } =
      makeService();
    (codesPersistenceService.consume as jest.Mock).mockResolvedValue({
      clientId: "client-1",
      redirectUri: "https://example.com/callback",
      email: "user@example.com",
      resource: "https://example.com/mcp",
    });

    const tokens = await service.exchangeAuthorizationCode(
      CLIENT,
      "auth-code",
      undefined,
      "https://example.com/callback",
    );

    expect(tokens.token_type).toBe("bearer");
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();
    expect(tokens.expires_in).toBe(
      OAuthTokensPersistenceService.ACCESS_TOKEN_TTL_SECONDS,
    );
    expect(tokensPersistenceService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        email: "user@example.com",
        resource: "https://example.com/mcp",
      }),
    );
  });

  it("throws InvalidGrantError when the code is unknown or expired", async () => {
    const { service, codesPersistenceService } = makeService();
    (codesPersistenceService.consume as jest.Mock).mockResolvedValue(null);

    await expect(
      service.exchangeAuthorizationCode(CLIENT, "auth-code"),
    ).rejects.toThrow(InvalidGrantError);
  });

  it("throws InvalidGrantError when the code belongs to a different client", async () => {
    const { service, codesPersistenceService } = makeService();
    (codesPersistenceService.consume as jest.Mock).mockResolvedValue({
      clientId: "other-client",
      redirectUri: "https://example.com/callback",
      email: "user@example.com",
    });

    await expect(
      service.exchangeAuthorizationCode(CLIENT, "auth-code"),
    ).rejects.toThrow(InvalidGrantError);
  });

  it("throws InvalidGrantError when the redirect_uri does not match", async () => {
    const { service, codesPersistenceService } = makeService();
    (codesPersistenceService.consume as jest.Mock).mockResolvedValue({
      clientId: "client-1",
      redirectUri: "https://example.com/callback",
      email: "user@example.com",
    });

    await expect(
      service.exchangeAuthorizationCode(
        CLIENT,
        "auth-code",
        undefined,
        "https://attacker.example.com",
      ),
    ).rejects.toThrow(InvalidGrantError);
  });
});

describe("McpOAuthProviderService.exchangeRefreshToken", () => {
  it("rotates the refresh token and issues new tokens", async () => {
    const { service, tokensPersistenceService } = makeService();
    (
      tokensPersistenceService.findByRefreshTokenHash as jest.Mock
    ).mockResolvedValue({
      id: "old-token-id",
      clientId: "client-1",
      email: "user@example.com",
      resource: "https://example.com/mcp",
    });

    const tokens = await service.exchangeRefreshToken(CLIENT, "refresh-token");

    expect(tokensPersistenceService.deleteById).toHaveBeenCalledWith(
      "old-token-id",
    );
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();
  });

  it("throws InvalidGrantError when the refresh token is unknown", async () => {
    const { service, tokensPersistenceService } = makeService();
    (
      tokensPersistenceService.findByRefreshTokenHash as jest.Mock
    ).mockResolvedValue(null);

    await expect(
      service.exchangeRefreshToken(CLIENT, "refresh-token"),
    ).rejects.toThrow(InvalidGrantError);
  });

  it("throws InvalidGrantError when the refresh token belongs to a different client", async () => {
    const { service, tokensPersistenceService } = makeService();
    (
      tokensPersistenceService.findByRefreshTokenHash as jest.Mock
    ).mockResolvedValue({
      id: "old-token-id",
      clientId: "other-client",
      email: "user@example.com",
    });

    await expect(
      service.exchangeRefreshToken(CLIENT, "refresh-token"),
    ).rejects.toThrow(InvalidGrantError);
  });
});

describe("McpOAuthProviderService.verifyAccessToken", () => {
  it("returns AuthInfo for a valid, unexpired token with an allowed email", async () => {
    const { service, tokensPersistenceService } = makeService({
      emailValid: true,
    });
    const accessTokenExpiresAt = new Date(Date.now() + 60_000);
    (
      tokensPersistenceService.findByAccessTokenHash as jest.Mock
    ).mockResolvedValue({
      clientId: "client-1",
      email: "user@example.com",
      resource: "https://example.com/mcp",
      accessTokenExpiresAt,
    });

    const authInfo = await service.verifyAccessToken("access-token");

    expect(authInfo).toMatchObject({
      token: "access-token",
      clientId: "client-1",
      scopes: [],
      extra: { email: "user@example.com" },
    });
    expect(authInfo.resource?.toString()).toBe("https://example.com/mcp");
    expect(authInfo.expiresAt).toBe(
      Math.floor(accessTokenExpiresAt.getTime() / 1000),
    );
  });

  it("throws InvalidTokenError when the token is unknown", async () => {
    const { service, tokensPersistenceService } = makeService();
    (
      tokensPersistenceService.findByAccessTokenHash as jest.Mock
    ).mockResolvedValue(null);

    await expect(service.verifyAccessToken("access-token")).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it("throws InvalidTokenError when the token has expired", async () => {
    const { service, tokensPersistenceService } = makeService();
    (
      tokensPersistenceService.findByAccessTokenHash as jest.Mock
    ).mockResolvedValue({
      clientId: "client-1",
      email: "user@example.com",
      accessTokenExpiresAt: new Date(Date.now() - 60_000),
    });

    await expect(service.verifyAccessToken("access-token")).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it("throws InvalidTokenError when the email is no longer allowed", async () => {
    const { service, tokensPersistenceService } = makeService({
      emailValid: false,
    });
    (
      tokensPersistenceService.findByAccessTokenHash as jest.Mock
    ).mockResolvedValue({
      clientId: "client-1",
      email: "user@example.com",
      accessTokenExpiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.verifyAccessToken("access-token")).rejects.toThrow(
      InvalidTokenError,
    );
  });
});

describe("McpOAuthProviderService.revokeToken", () => {
  it("deletes the token by access token hash", async () => {
    const { service, tokensPersistenceService } = makeService();
    (
      tokensPersistenceService.findByRefreshTokenHash as jest.Mock
    ).mockResolvedValue(null);

    await service.revokeToken(CLIENT, { token: "access-token" });

    expect(
      tokensPersistenceService.deleteByAccessTokenHash,
    ).toHaveBeenCalledWith(hashOpaqueToken("access-token"));
  });

  it("also deletes the token when the provided value is a refresh token", async () => {
    const { service, tokensPersistenceService } = makeService();
    (
      tokensPersistenceService.findByRefreshTokenHash as jest.Mock
    ).mockResolvedValue({
      id: "token-id-1",
    });

    await service.revokeToken(CLIENT, { token: "refresh-token" });

    expect(tokensPersistenceService.deleteById).toHaveBeenCalledWith(
      "token-id-1",
    );
  });
});
