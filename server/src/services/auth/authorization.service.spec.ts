import { AuthorizationService } from "./authorization.service";
import { RequestContext } from "../request-context";
import { IpValidationService } from "../ip-validation.service";
import { AuthorizationHeaderVerificationService } from "./authorization-header-verification.service";
import { GoogleSessionService } from "./google-session.service";
import { ApiKeysPersistenceService } from "./api-keys.persistence.service";
import { EmailsPersistenceService } from "./emails.persistence.service";

// hashApiKey reads AUTH_API_KEY_SECRET from env at call time; stub it out entirely.
jest.mock("../../helpers/crypto.helper", () => ({
  hashApiKey: (key: string) => `hashed:${key}`,
}));

function makeService(overrides: {
  ipAllowed?: boolean;
  sessionCookie?: string | null;
  bearerToken?: string | null;
  sessionResult?: Awaited<ReturnType<GoogleSessionService["validateSession"]>>;
  emailValid?: boolean;
  apiKeyValid?: boolean;
}) {
  const ipValidationService = {
    isRequestAllowedBasedOnIP: jest.fn().mockReturnValue(overrides.ipAllowed ?? false),
  } as unknown as IpValidationService;

  const requestContext = {
    sessionCookie: overrides.sessionCookie ?? null,
  } as unknown as RequestContext;

  const authHeaderService = {
    getBearerTokenValue: jest.fn().mockReturnValue(overrides.bearerToken ?? null),
  } as unknown as AuthorizationHeaderVerificationService;

  const sessionService = {
    validateSession: jest.fn().mockResolvedValue(overrides.sessionResult ?? null),
  } as unknown as GoogleSessionService;

  const apiKeysPersistenceService = {
    validateApiKey: jest.fn().mockResolvedValue(
      overrides.apiKeyValid ? { owner: "test" } : null,
    ),
  } as unknown as ApiKeysPersistenceService;

  const emailsPersistenceService = {
    validateEmail: jest.fn().mockResolvedValue(overrides.emailValid ?? false),
  } as unknown as EmailsPersistenceService;

  return new AuthorizationService(
    requestContext,
    ipValidationService,
    authHeaderService,
    sessionService,
    apiKeysPersistenceService,
    emailsPersistenceService,
  );
}

describe("AuthorizationService.isUserAuthorized", () => {
  it("returns Authorized when IP is allowed", async () => {
    const service = makeService({ ipAllowed: true });
    expect(await service.isUserAuthorized()).toBe("Authorized");
  });

  it("returns Authorized for a valid session with a valid email", async () => {
    const service = makeService({
      sessionCookie: "session-id-123",
      sessionResult: { sessionId: "session-id-123", email: "user@example.com" },
      emailValid: true,
    });
    expect(await service.isUserAuthorized()).toBe("Authorized");
  });

  it("returns Forbidden for a valid session with an invalid email", async () => {
    const service = makeService({
      sessionCookie: "session-id-123",
      sessionResult: { sessionId: "session-id-123", email: "banned@example.com" },
      emailValid: false,
    });
    expect(await service.isUserAuthorized()).toBe("Forbidden");
  });

  it("returns NeedsLogIn when session is expired and there is no bearer token", async () => {
    const service = makeService({
      sessionCookie: "expired-session",
      sessionResult: null,
      bearerToken: null,
    });
    expect(await service.isUserAuthorized()).toBe("NeedsLogIn");
  });

  it("returns NeedsLogIn when there is no session and no bearer token", async () => {
    const service = makeService({ bearerToken: null });
    expect(await service.isUserAuthorized()).toBe("NeedsLogIn");
  });

  it("returns Authorized for a valid API key", async () => {
    const service = makeService({ bearerToken: "valid-api-key", apiKeyValid: true });
    expect(await service.isUserAuthorized()).toBe("Authorized");
  });

  it("returns Forbidden for an invalid API key", async () => {
    const service = makeService({ bearerToken: "invalid-api-key", apiKeyValid: false });
    expect(await service.isUserAuthorized()).toBe("Forbidden");
  });

  it("prefers IP allowlist over session check", async () => {
    const sessionService = { validateSession: jest.fn() } as unknown as GoogleSessionService;
    const service = makeService({ ipAllowed: true, sessionCookie: "some-session" });
    // session should never be called when IP is allowed
    expect(await service.isUserAuthorized()).toBe("Authorized");
  });
});
