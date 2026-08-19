import { hashApiKey } from "../../helpers/crypto.helper";
import { IpValidationService } from "../ip-validation.service";
import { ApiKeysPersistenceService } from "./api-keys.persistence.service";
import { AuthorizationHeaderVerificationService } from "./authorization-header-verification.service";
import { EmailsPersistenceService, Role } from "./emails.persistence.service";
import { GoogleSessionService } from "./google-session.service";
import { RequestContext } from "../request-context";

export function isJwt(token: string): boolean {
  return token.indexOf(".") >= 0;
}

// These map to the following status codes:
export type AuthorizationResult =
  | "Authorized" // 200
  | "NeedsLogIn" // 401 Needs either a login or an API key (Authorization Header most likely not found)
  | "Forbidden"; // 403

/**
 * Service that can inform whichever context it's inserted in regarding of the current request
 * is available to access the application.
 *
 * The flow is as follows:
 * 1. IP Verification -> If enabled, it'll check if the IP is part of the allowed list, in this case it is Authorized.
 * 2. Session Cookie Verification -> If the cookie exists and is correctly signed the user is Authorized.
 * 3. Authorization Verification -> Checks if the Authorization header exists:
 *  3.1 Doesn't exit -> NeedsLogIn
 *  3.2 API Key -> If it exists in the system it is authorized if not expired.
 *  3.3 JWT -> If it is valid using GoogleAuth
 *    3.3.1 -> Check if the email is in the DB hasn't expired access
 * 4. If all flows fail the user is Forbidden
 */
export class AuthorizationService {
  constructor(
    private readonly requestContext: RequestContext,
    private readonly ipValidationService: IpValidationService,
    private readonly authorizationHeaderVerificationService: AuthorizationHeaderVerificationService,
    private readonly sessionService: GoogleSessionService,
    private readonly apiKeysPersistenceService: ApiKeysPersistenceService,
    private readonly emailsPersistenceService: EmailsPersistenceService,
  ) {}

  private async isValidApiKey(apiKey: string): Promise<AuthorizationResult> {
    const hashedApiKey = hashApiKey(apiKey);
    const matchingKey =
      await this.apiKeysPersistenceService.validateApiKey(hashedApiKey);

    if (!matchingKey) {
      return "Forbidden";
    }

    console.log(`API Key access from ${matchingKey.owner} detected.`);
    return "Authorized";
  }

  private async validateSession(
    sessionId: string,
    requiredRoles?: Role[],
  ): Promise<AuthorizationResult> {
    const session = await this.sessionService.validateSession(sessionId);
    if (session === null) {
      // Session doesn't exist or has expired and there's no refresh token.
      return "NeedsLogIn";
    }

    const { email } = session;
    // Validate the email, scoped to a role if the caller requires one.
    const isEmailValid = requiredRoles
      ? await this.emailsPersistenceService.validateEmailForRoles(
          email,
          requiredRoles,
        )
      : await this.emailsPersistenceService.validateEmail(email);
    return isEmailValid ? "Authorized" : "Forbidden";
  }

  public async isUserAuthorized(
    requiredRoles?: Role[],
  ): Promise<AuthorizationResult> {
    const ipValidation = this.ipValidationService.isRequestAllowedBasedOnIP();
    if (ipValidation) {
      return "Authorized";
    }

    // Check the session to bypass this flow
    // We aren't doing JWT anymore.
    const sessionCookie = this.requestContext.sessionCookie;
    if (sessionCookie) {
      return await this.validateSession(
        this.requestContext.sessionCookie,
        requiredRoles,
      );
    }

    // No session token and no bearer -> login requested.
    const token =
      this.authorizationHeaderVerificationService.getBearerTokenValue();
    if (!token) {
      return "NeedsLogIn";
    }

    return await this.isValidApiKey(token);
  }
}
