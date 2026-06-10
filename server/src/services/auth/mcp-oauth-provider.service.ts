import { Response } from "express";
import {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  InvalidGrantError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { generateOpaqueToken, hashOpaqueToken } from "../../helpers/crypto.helper";
import { RequestContext } from "../request-context";
import { GoogleAuthConfig } from "./google-auth";
import { GoogleSessionService } from "./google-session.service";
import { EmailsPersistenceService } from "./emails.persistence.service";
import { OAuthClientsPersistenceService } from "./oauth-clients.persistence.service";
import { OAuthPendingAuthorizationsPersistenceService } from "./oauth-pending-authorizations.persistence.service";
import { OAuthCodesPersistenceService } from "./oauth-codes.persistence.service";
import {
  OAuthTokensPersistenceService,
} from "./oauth-tokens.persistence.service";

const GOOGLE_AUTH_V2_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export type PendingMcpAuthorization = {
  client: OAuthClientInformationFull;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  resource?: string;
};

/**
 * Minimal OAuth 2.1 authorization server for the MCP HTTP endpoint.
 *
 * Authorization piggybacks on the existing Google login: if the caller's
 * browser already has a valid session cookie (and the email is allowed),
 * an authorization code is issued immediately. Otherwise the request is
 * parked and the browser is sent through the normal Google login flow;
 * `AuthGoogleController` resumes it via `completeAuthorization` once the
 * session cookie has been created.
 */
export class McpOAuthProviderService implements OAuthServerProvider {
  constructor(
    private readonly googleAuthConfig: GoogleAuthConfig,
    private readonly googleSessionService: GoogleSessionService,
    private readonly emailsPersistenceService: EmailsPersistenceService,
    private readonly clientsPersistenceService: OAuthClientsPersistenceService,
    private readonly pendingAuthorizationsPersistenceService: OAuthPendingAuthorizationsPersistenceService,
    private readonly codesPersistenceService: OAuthCodesPersistenceService,
    private readonly tokensPersistenceService: OAuthTokensPersistenceService,
  ) {}

  public get clientsStore(): OAuthRegisteredClientsStore {
    return this.clientsPersistenceService;
  }

  public async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const email = await this.getAuthorizedEmail(res);
    if (email) {
      await this.completeAuthorization(client, params, email, res);
      return;
    }

    const pendingId = await this.pendingAuthorizationsPersistenceService.create({
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state,
      scopes: params.scopes,
      resource: params.resource?.toString(),
    });

    res.redirect(this.buildGoogleAuthUrl(pendingId));
  }

  /**
   * Issues an authorization code and redirects back to the MCP client.
   * Called either directly from `authorize` (already logged in) or from
   * `AuthGoogleController` after a fresh Google login resolves a pending request.
   */
  public async completeAuthorization(
    client: OAuthClientInformationFull,
    params: Pick<AuthorizationParams, "redirectUri" | "codeChallenge" | "state" | "resource">,
    email: string,
    res: Response,
  ): Promise<void> {
    const code = generateOpaqueToken();

    await this.codesPersistenceService.create({
      codeHash: hashOpaqueToken(code),
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      email,
      resource: params.resource?.toString(),
    });

    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (params.state !== undefined) {
      redirectUrl.searchParams.set("state", params.state);
    }

    res.redirect(redirectUrl.toString());
  }

  public async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const code = await this.codesPersistenceService.get(hashOpaqueToken(authorizationCode));
    if (!code || code.clientId !== client.client_id) {
      throw new InvalidGrantError("Invalid authorization code");
    }

    return code.codeChallenge;
  }

  public async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const code = await this.codesPersistenceService.consume(hashOpaqueToken(authorizationCode));
    if (!code || code.clientId !== client.client_id) {
      throw new InvalidGrantError("Invalid authorization code");
    }
    if (redirectUri && code.redirectUri !== redirectUri) {
      throw new InvalidGrantError("redirect_uri does not match the authorization request");
    }

    return this.issueTokens(client, code.email, resource?.toString() ?? code.resource);
  }

  public async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    _scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const existing = await this.tokensPersistenceService.findByRefreshTokenHash(
      hashOpaqueToken(refreshToken),
    );
    if (!existing || existing.clientId !== client.client_id) {
      throw new InvalidGrantError("Invalid refresh token");
    }

    await this.tokensPersistenceService.deleteById(existing.id);

    return this.issueTokens(client, existing.email, resource?.toString() ?? existing.resource);
  }

  public async verifyAccessToken(token: string): Promise<AuthInfo> {
    const existing = await this.tokensPersistenceService.findByAccessTokenHash(
      hashOpaqueToken(token),
    );
    if (!existing) {
      throw new InvalidTokenError("Invalid access token");
    }
    if (existing.accessTokenExpiresAt.getTime() <= Date.now()) {
      throw new InvalidTokenError("Access token has expired");
    }

    const isEmailValid = await this.emailsPersistenceService.validateEmail(existing.email);
    if (!isEmailValid) {
      throw new InvalidTokenError("User is no longer authorized");
    }

    return {
      token,
      clientId: existing.clientId,
      scopes: [],
      expiresAt: Math.floor(existing.accessTokenExpiresAt.getTime() / 1000),
      resource: existing.resource ? new URL(existing.resource) : undefined,
      extra: { email: existing.email },
    };
  }

  public async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const hash = hashOpaqueToken(request.token);
    await this.tokensPersistenceService.deleteByAccessTokenHash(hash);

    const tokenByRefresh = await this.tokensPersistenceService.findByRefreshTokenHash(hash);
    if (tokenByRefresh) {
      await this.tokensPersistenceService.deleteById(tokenByRefresh.id);
    }
  }

  private async issueTokens(
    client: OAuthClientInformationFull,
    email: string,
    resource?: string,
  ): Promise<OAuthTokens> {
    const accessToken = generateOpaqueToken();
    const refreshToken = generateOpaqueToken();

    await this.tokensPersistenceService.create({
      accessTokenHash: hashOpaqueToken(accessToken),
      refreshTokenHash: hashOpaqueToken(refreshToken),
      clientId: client.client_id,
      email,
      resource,
    });

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: OAuthTokensPersistenceService.ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
    };
  }

  private async getAuthorizedEmail(res: Response): Promise<string | null> {
    const sessionCookie = res.req.cookies?.[RequestContext.SESSION_COOKIE_NAME];
    if (!sessionCookie) {
      return null;
    }

    const session = await this.googleSessionService.validateSession(sessionCookie);
    if (!session) {
      return null;
    }

    const isEmailValid = await this.emailsPersistenceService.validateEmail(session.email);
    return isEmailValid ? session.email : null;
  }

  private buildGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.googleAuthConfig.clientId,
      redirect_uri: this.googleAuthConfig.redirectUri,
      response_type: "code",
      scope: "openid email",
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return `${GOOGLE_AUTH_V2_URL}?${params.toString()}`;
  }
}
