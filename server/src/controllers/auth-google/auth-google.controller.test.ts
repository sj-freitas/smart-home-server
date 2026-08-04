import { Response } from "express";
import { AuthGoogleController } from "./auth-google.controller";
import { GoogleSessionService } from "../../services/auth/google-session.service";
import { AuthConfig } from "../auth.config";
import { RequestContext } from "../../services/request-context";
import { GoogleAuthService } from "../../services/auth/google-auth.service";
import { McpOAuthProviderService } from "../../services/auth/mcp-oauth-provider.service";
import { OAuthClientsPersistenceService } from "../../services/auth/oauth-clients.persistence.service";
import { OAuthPendingAuthorizationsPersistenceService } from "../../services/auth/oauth-pending-authorizations.persistence.service";

function makeResponse(): jest.Mocked<Response> {
  return {
    cookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Response>;
}

function makeController(overrides: { pendingAuthorization?: unknown } = {}) {
  const googleAuthService = {
    getToken: jest.fn().mockResolvedValue({
      idToken: "id-token",
      accessToken: "access-token",
      expiresIn: 3600,
      refreshToken: "refresh-token",
    }),
    verifyIdToken: jest.fn().mockResolvedValue({ email: "user@example.com" }),
  } as unknown as jest.Mocked<GoogleAuthService>;

  const sessionService = {
    createSession: jest
      .fn()
      .mockResolvedValue({ sessionId: "session-1", email: "user@example.com" }),
  } as unknown as jest.Mocked<GoogleSessionService>;

  const authConfig = {
    clientBaseUrl: "https://palais-freitas.xyz",
    setSecureCookie: true,
    sameSiteCookie: "lax",
    domainCookie: "palais-freitas.xyz",
  } as unknown as AuthConfig;

  const requestContext = {} as RequestContext;

  const mcpOAuthProvider = {
    completeAuthorization: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<McpOAuthProviderService>;

  const oauthClientsPersistenceService = {
    getClient: jest.fn().mockResolvedValue({ clientId: "client-1" }),
  } as unknown as jest.Mocked<OAuthClientsPersistenceService>;

  const oauthPendingAuthorizationsPersistenceService = {
    get: jest.fn().mockResolvedValue(overrides.pendingAuthorization ?? null),
    delete: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<OAuthPendingAuthorizationsPersistenceService>;

  const controller = new AuthGoogleController(
    googleAuthService,
    sessionService,
    authConfig,
    requestContext,
    mcpOAuthProvider,
    oauthClientsPersistenceService,
    oauthPendingAuthorizationsPersistenceService,
  );

  return {
    controller,
    googleAuthService,
    sessionService,
    authConfig,
    mcpOAuthProvider,
    oauthClientsPersistenceService,
    oauthPendingAuthorizationsPersistenceService,
  };
}

describe("AuthGoogleController.callback", () => {
  it("redirects back to the page the user was on when state is a safe relative path", async () => {
    const { controller } = makeController();
    const response = makeResponse();

    await controller.callback(
      "auth-code",
      "/home-info/palais-freitas",
      response,
    );

    expect(response.redirect).toHaveBeenCalledWith(
      "https://palais-freitas.xyz/home-info/palais-freitas",
    );
  });

  it("preserves query strings included in the return path", async () => {
    const { controller } = makeController();
    const response = makeResponse();

    await controller.callback("auth-code", "/rooms?tab=living-room", response);

    expect(response.redirect).toHaveBeenCalledWith(
      "https://palais-freitas.xyz/rooms?tab=living-room",
    );
  });

  it("falls back to the client base URL when there is no state", async () => {
    const { controller } = makeController();
    const response = makeResponse();

    await controller.callback("auth-code", undefined, response);

    expect(response.redirect).toHaveBeenCalledWith(
      "https://palais-freitas.xyz",
    );
  });

  it("falls back to the client base URL when state is a protocol-relative URL (open redirect attempt)", async () => {
    const { controller } = makeController();
    const response = makeResponse();

    await controller.callback("auth-code", "//evil.example.com", response);

    expect(response.redirect).toHaveBeenCalledWith(
      "https://palais-freitas.xyz",
    );
  });

  it("falls back to the client base URL when state is an absolute URL (open redirect attempt)", async () => {
    const { controller } = makeController();
    const response = makeResponse();

    await controller.callback(
      "auth-code",
      "https://evil.example.com",
      response,
    );

    expect(response.redirect).toHaveBeenCalledWith(
      "https://palais-freitas.xyz",
    );
  });

  it("does not treat a UUID state as a return path (MCP authorization flow takes precedence)", async () => {
    const pendingAuthorization = {
      clientId: "client-1",
      redirectUri: "https://mcp-client.example.com/callback",
      codeChallenge: "challenge",
      state: "mcp-state",
      resource: undefined,
    };
    const { controller, mcpOAuthProvider } = makeController({
      pendingAuthorization,
    });
    const response = makeResponse();

    await controller.callback(
      "auth-code",
      "550e8400-e29b-41d4-a716-446655440000",
      response,
    );

    expect(mcpOAuthProvider.completeAuthorization).toHaveBeenCalled();
    expect(response.redirect).not.toHaveBeenCalled();
  });
});
