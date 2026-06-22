import { Module, Scope, UseFilters } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Pool } from "pg";
import { OAuth2Client } from "google-auth-library";
import { IpValidationService } from "./ip-validation.service";
import { RequestContext } from "./request-context";
import { ConfigService } from "../config/config-service";
import { ConfigModule } from "../config/module";
import { HomeConfig } from "../config/home.zod";
import { ApiKeysPersistenceService } from "./auth/api-keys.persistence.service";
import { EmailsPersistenceService } from "./auth/emails.persistence.service";
import { GoogleAuthService } from "./auth/google-auth.service";
import { AuthorizationService } from "./auth/authorization.service";
import { AuthorizationHeaderVerificationService } from "./auth/authorization-header-verification.service";
import { GoogleSessionService } from "./auth/google-session.service";
import { SessionsPersistenceService } from "./auth/sessions.persistence.service";
import { GoogleAuthConfig } from "./auth/google-auth";
import { StatePersistenceService } from "./state/state.persistence.service";
import { StateService } from "./state/state.service";
import { MetricsPersistenceService } from "../metrics/metrics.persistence.service";
import { OAuthClientsPersistenceService } from "./auth/oauth-clients.persistence.service";
import { OAuthPendingAuthorizationsPersistenceService } from "./auth/oauth-pending-authorizations.persistence.service";
import { OAuthCodesPersistenceService } from "./auth/oauth-codes.persistence.service";
import { OAuthTokensPersistenceService } from "./auth/oauth-tokens.persistence.service";
import { McpOAuthProviderService } from "./auth/mcp-oauth-provider.service";

const HOME_CONFIG = "HOME_CONFIG";

export const PgPoolProvider = {
  provide: Pool,
  useFactory: () => {
    const { DATABASE_URL } = process.env;
    if (!DATABASE_URL) {
      throw new Error(`DATABASE_URL is a required env vars!`);
    }

    const pool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    return pool;
  },
};

const GoogleAuthConfigProvider = {
  provide: GoogleAuthConfig,
  useFactory: () => new GoogleAuthConfig(),
};

// Ideally the Auth provider can be set in the config but as that's a bit too complex
// and out of the scope of this project we keep the API strongly tied with Google Auth -
// Everyone has a Google Account and custom providers wouldn't justify the hassle.
const OAuth2ClientProvider = {
  provide: OAuth2Client,
  inject: [GoogleAuthConfig],
  useFactory: (googleAuthConfig: GoogleAuthConfig) => {
    return new OAuth2Client(googleAuthConfig.clientId);
  },
};

const SessionsPersistenceServiceProvider = {
  provide: SessionsPersistenceService,
  inject: [Pool],
  useFactory: (pool: Pool) => {
    return new SessionsPersistenceService(pool);
  },
};

const GoogleSessionServiceProvider = {
  provide: GoogleSessionService,
  inject: [GoogleAuthService, SessionsPersistenceService],
  useFactory: (
    googleAuthService: GoogleAuthService,
    persistenceService: SessionsPersistenceService,
  ) => {
    return new GoogleSessionService(googleAuthService, persistenceService);
  },
};

const GoogleAuthServiceProvider = {
  provide: GoogleAuthService,
  inject: [OAuth2Client, GoogleAuthConfig],
  useFactory: (
    oAuth2Client: OAuth2Client,
    googleAuthConfig: GoogleAuthConfig,
  ) => {
    return new GoogleAuthService(oAuth2Client, googleAuthConfig);
  },
};

const ApiKeysPersistenceServiceProvider = {
  provide: ApiKeysPersistenceService,
  inject: [Pool],
  useFactory: (pool: Pool) => new ApiKeysPersistenceService(pool),
};

const EmailsPersistenceServiceProvider = {
  provide: EmailsPersistenceService,
  inject: [Pool],
  useFactory: (pool: Pool) => new EmailsPersistenceService(pool),
};

const AuthorizationServiceProvider = {
  provide: AuthorizationService,
  inject: [
    RequestContext,
    IpValidationService,
    AuthorizationHeaderVerificationService,
    GoogleSessionService,
    ApiKeysPersistenceService,
    EmailsPersistenceService,
  ],
  useFactory: (
    requestContext: RequestContext,
    ipValidationService: IpValidationService,
    authorizationHeaderVerificationService: AuthorizationHeaderVerificationService,
    googleSessionService: GoogleSessionService,
    apiKeysPersistenceService: ApiKeysPersistenceService,
    emailsPersistenceService: EmailsPersistenceService,
  ) =>
    new AuthorizationService(
      requestContext,
      ipValidationService,
      authorizationHeaderVerificationService,
      googleSessionService,
      apiKeysPersistenceService,
      emailsPersistenceService,
    ),
};

const AuthorizationHeaderVerificationServiceProvider = {
  provide: AuthorizationHeaderVerificationService,
  inject: [RequestContext],
  useFactory: (request: RequestContext) => {
    return new AuthorizationHeaderVerificationService(request);
  },
};

const HomeConfigProvider = {
  provide: HOME_CONFIG,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => config.getConfig().home,
};

const RequestContextProvider = {
  provide: RequestContext,
  scope: Scope.REQUEST,
  useFactory: (req: any) => {
    return new RequestContext(req);
  },
  inject: [REQUEST],
};

const IPValidationServiceProvider = {
  provide: IpValidationService,
  inject: [RequestContext, HOME_CONFIG],
  scope: Scope.REQUEST,
  useFactory: (requestContext: RequestContext, homeConfig: HomeConfig) => {
    return new IpValidationService(requestContext, homeConfig);
  },
};

const StatePersistenceServiceProvider = {
  provide: StatePersistenceService,
  inject: [Pool],
  useFactory: (pool: Pool) => new StatePersistenceService(pool),
};

const MetricsPersistenceServiceProvider = {
  provide: MetricsPersistenceService,
  inject: [Pool],
  useFactory: (pool: Pool) => new MetricsPersistenceService(pool),
};

const StateServiceProvider = {
  provide: StateService,
  inject: [StatePersistenceService, ConfigService, MetricsPersistenceService],
  useFactory: (
    service: StatePersistenceService,
    config: ConfigService,
    metrics: MetricsPersistenceService,
  ) => new StateService(config.getConfig().home, service, metrics),
};

const OAuthClientsPersistenceServiceProvider = {
  provide: OAuthClientsPersistenceService,
  inject: [Pool],
  useFactory: (pool: Pool) => new OAuthClientsPersistenceService(pool),
};

const OAuthPendingAuthorizationsPersistenceServiceProvider = {
  provide: OAuthPendingAuthorizationsPersistenceService,
  inject: [Pool],
  useFactory: (pool: Pool) =>
    new OAuthPendingAuthorizationsPersistenceService(pool),
};

const OAuthCodesPersistenceServiceProvider = {
  provide: OAuthCodesPersistenceService,
  inject: [Pool],
  useFactory: (pool: Pool) => new OAuthCodesPersistenceService(pool),
};

const OAuthTokensPersistenceServiceProvider = {
  provide: OAuthTokensPersistenceService,
  inject: [Pool],
  useFactory: (pool: Pool) => new OAuthTokensPersistenceService(pool),
};

const McpOAuthProviderServiceProvider = {
  provide: McpOAuthProviderService,
  inject: [
    GoogleAuthConfig,
    GoogleSessionService,
    EmailsPersistenceService,
    OAuthClientsPersistenceService,
    OAuthPendingAuthorizationsPersistenceService,
    OAuthCodesPersistenceService,
    OAuthTokensPersistenceService,
  ],
  useFactory: (
    googleAuthConfig: GoogleAuthConfig,
    googleSessionService: GoogleSessionService,
    emailsPersistenceService: EmailsPersistenceService,
    clientsPersistenceService: OAuthClientsPersistenceService,
    pendingAuthorizationsPersistenceService: OAuthPendingAuthorizationsPersistenceService,
    codesPersistenceService: OAuthCodesPersistenceService,
    tokensPersistenceService: OAuthTokensPersistenceService,
  ) =>
    new McpOAuthProviderService(
      googleAuthConfig,
      googleSessionService,
      emailsPersistenceService,
      clientsPersistenceService,
      pendingAuthorizationsPersistenceService,
      codesPersistenceService,
      tokensPersistenceService,
    ),
};

@Module({
  imports: [ConfigModule],
  providers: [
    OAuth2ClientProvider,
    GoogleAuthConfigProvider,
    GoogleAuthServiceProvider,
    GoogleSessionServiceProvider,
    IPValidationServiceProvider,
    ApiKeysPersistenceServiceProvider,
    SessionsPersistenceServiceProvider,
    AuthorizationHeaderVerificationServiceProvider,
    EmailsPersistenceServiceProvider,
    AuthorizationServiceProvider,
    RequestContextProvider,
    HomeConfigProvider,
    PgPoolProvider,
    StatePersistenceServiceProvider,
    MetricsPersistenceServiceProvider,
    StateServiceProvider,
    OAuthClientsPersistenceServiceProvider,
    OAuthPendingAuthorizationsPersistenceServiceProvider,
    OAuthCodesPersistenceServiceProvider,
    OAuthTokensPersistenceServiceProvider,
    McpOAuthProviderServiceProvider,
  ],
  exports: [
    OAuth2ClientProvider,
    GoogleAuthServiceProvider,
    GoogleAuthConfigProvider,
    GoogleSessionServiceProvider,
    IPValidationServiceProvider,
    ApiKeysPersistenceServiceProvider,
    SessionsPersistenceServiceProvider,
    AuthorizationHeaderVerificationServiceProvider,
    EmailsPersistenceServiceProvider,
    AuthorizationServiceProvider,
    RequestContextProvider,
    HomeConfigProvider,
    PgPoolProvider,
    StatePersistenceServiceProvider,
    MetricsPersistenceServiceProvider,
    StateServiceProvider,
    OAuthClientsPersistenceServiceProvider,
    OAuthPendingAuthorizationsPersistenceServiceProvider,
    OAuthCodesPersistenceServiceProvider,
    OAuthTokensPersistenceServiceProvider,
    McpOAuthProviderServiceProvider,
  ],
})
export class ServicesModule {}
