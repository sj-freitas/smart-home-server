import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { GoogleSessionService } from "../../services/auth/google-session.service";
import { AuthConfig } from "../auth.config";
import { RequestContext } from "../../services/request-context";
import { GoogleAuthService } from "../../services/auth/google-auth.service";
import { McpOAuthProviderService } from "../../services/auth/mcp-oauth-provider.service";
import { OAuthClientsPersistenceService } from "../../services/auth/oauth-clients.persistence.service";
import { OAuthPendingAuthorizationsPersistenceService } from "../../services/auth/oauth-pending-authorizations.persistence.service";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller("api/auth/google")
export class AuthGoogleController {
  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly sessionService: GoogleSessionService,
    private readonly authConfig: AuthConfig,
    private readonly requestContext: RequestContext,
    private readonly mcpOAuthProvider: McpOAuthProviderService,
    private readonly oauthClientsPersistenceService: OAuthClientsPersistenceService,
    private readonly oauthPendingAuthorizationsPersistenceService: OAuthPendingAuthorizationsPersistenceService,
  ) {}

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string | undefined,
    @Res() response: Response,
  ) {
    if (!code) {
      throw new BadRequestException("Missing code");
    }

    const token = await this.googleAuthService.getToken(code);
    if (!token?.idToken || !token.accessToken) {
      throw new BadRequestException("No id_token returned by Google");
    }
    const payload = await this.googleAuthService.verifyIdToken(token.idToken);
    if (!payload) {
      throw new BadRequestException("Invalid id_token");
    }

    if (!payload.email) {
      throw new BadRequestException("Missing email in id_token");
    }

    const session = await this.sessionService.createSession(
      payload.email,
      token.accessToken,
      token.expiresIn,
      token.refreshToken,
    );

    response.cookie("session", session.sessionId, {
      httpOnly: true,
      secure: this.authConfig.setSecureCookie,
      sameSite: this.authConfig.sameSiteCookie,
      domain: this.authConfig.domainCookie,
      path: "/",
    });

    if (state && UUID_REGEX.test(state)) {
      const pending =
        await this.oauthPendingAuthorizationsPersistenceService.get(state);
      if (pending) {
        const client = await this.oauthClientsPersistenceService.getClient(
          pending.clientId,
        );
        if (!client) {
          throw new BadRequestException(
            "Unknown OAuth client for pending authorization",
          );
        }

        await this.oauthPendingAuthorizationsPersistenceService.delete(state);
        await this.mcpOAuthProvider.completeAuthorization(
          client,
          {
            redirectUri: pending.redirectUri,
            codeChallenge: pending.codeChallenge,
            state: pending.state,
            resource: pending.resource ? new URL(pending.resource) : undefined,
          },
          payload.email,
          response,
        );
        return;
      }
    }

    return response.redirect(this.authConfig.clientBaseUrl);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Res() response: Response) {
    const session = this.requestContext.sessionCookie;
    if (session) {
      this.sessionService.destroySession(session);
    }

    response.clearCookie(RequestContext.SESSION_COOKIE_NAME);

    return response.status(HttpStatus.OK).send("logged out");
  }
}
