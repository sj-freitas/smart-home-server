import { AuthorizationService } from './authorization.service';
import { IpValidationService } from '../ip-validation.service';
import { ApiKeysPersistenceService } from './api-keys.persistence.service';
import { AuthorizationHeaderVerificationService } from './authorization-header-verification.service';
import { EmailsPersistenceService } from './emails.persistence.service';
import { GoogleSessionService } from './google-session.service';
import { RequestContext } from '../request-context';

function makeService(opts: {
  ipAllowed?: boolean;
  sessionCookie?: string;
  sessionResult?: { email: string } | null;
  emailValid?: boolean;
  bearerToken?: string | null;
  apiKeyResult?: { owner: string } | null;
}): AuthorizationService {
  const {
    ipAllowed = false,
    sessionCookie = undefined,
    sessionResult = null,
    emailValid = false,
    bearerToken = null,
    apiKeyResult = null,
  } = opts;

  const ipValidation = {
    isRequestAllowedBasedOnIP: jest.fn().mockReturnValue(ipAllowed),
  } as unknown as IpValidationService;

  const headerVerification = {
    getBearerTokenValue: jest.fn().mockReturnValue(bearerToken),
  } as unknown as AuthorizationHeaderVerificationService;

  const sessionService = {
    validateSession: jest.fn().mockResolvedValue(sessionResult),
  } as unknown as GoogleSessionService;

  const apiKeysPersistence = {
    validateApiKey: jest.fn().mockResolvedValue(apiKeyResult),
  } as unknown as ApiKeysPersistenceService;

  const emailsPersistence = {
    validateEmail: jest.fn().mockResolvedValue(emailValid),
  } as unknown as EmailsPersistenceService;

  const requestContext = { sessionCookie } as unknown as RequestContext;

  return new AuthorizationService(
    requestContext,
    ipValidation,
    headerVerification,
    sessionService,
    apiKeysPersistence,
    emailsPersistence,
  );
}

describe('AuthorizationService.isUserAuthorized', () => {
  it('returns Authorized immediately when the IP is allowed', async () => {
    const svc = makeService({ ipAllowed: true });
    await expect(svc.isUserAuthorized()).resolves.toBe('Authorized');
  });

  describe('when IP check fails', () => {
    it('returns Authorized when a valid session with an allowed email is present', async () => {
      const svc = makeService({
        sessionCookie: 'abc123',
        sessionResult: { email: 'user@example.com' },
        emailValid: true,
      });
      await expect(svc.isUserAuthorized()).resolves.toBe('Authorized');
    });

    it('returns Forbidden when session is valid but the email is not permitted', async () => {
      const svc = makeService({
        sessionCookie: 'abc123',
        sessionResult: { email: 'blocked@example.com' },
        emailValid: false,
      });
      await expect(svc.isUserAuthorized()).resolves.toBe('Forbidden');
    });

    it('returns NeedsLogIn when session is null and no Authorization header is present', async () => {
      const svc = makeService({ bearerToken: null });
      await expect(svc.isUserAuthorized()).resolves.toBe('NeedsLogIn');
    });

    it('returns Authorized when the Authorization header holds a valid API key', async () => {
      const svc = makeService({
        bearerToken: 'my-api-key',
        apiKeyResult: { owner: 'ci-bot' },
      });
      await expect(svc.isUserAuthorized()).resolves.toBe('Authorized');
    });

    it('returns Forbidden when the API key is not found in the database', async () => {
      const svc = makeService({ bearerToken: 'bad-key', apiKeyResult: null });
      await expect(svc.isUserAuthorized()).resolves.toBe('Forbidden');
    });
  });
});
