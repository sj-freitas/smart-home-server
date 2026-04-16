import { GoogleSessionService } from "./google-session.service";
import { GoogleAuthService } from "./google-auth.service";
import { SessionsPersistenceService } from "./sessions.persistence.service";

function makeService(
  persistenceMethods: Partial<Record<keyof SessionsPersistenceService, jest.Mock>>,
  authMethods: Partial<Record<keyof GoogleAuthService, jest.Mock>> = {},
) {
  const persistence = {
    get: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue("new-session-id"),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    ...persistenceMethods,
  } as unknown as SessionsPersistenceService;

  const authService = {
    refreshToken: jest.fn().mockResolvedValue(null),
    ...authMethods,
  } as unknown as GoogleAuthService;

  return new GoogleSessionService(authService, persistence);
}

const FUTURE_DATE = new Date(Date.now() + 60_000);
const PAST_DATE = new Date(Date.now() - 60_000);

describe("GoogleSessionService.validateSession", () => {
  it("returns null when session does not exist", async () => {
    const svc = makeService({ get: jest.fn().mockResolvedValue(null) });
    expect(await svc.validateSession("unknown")).toBeNull();
  });

  it("returns the session when it is still valid", async () => {
    const svc = makeService({
      get: jest.fn().mockResolvedValue({
        id: "sess-1",
        email: "user@example.com",
        accessToken: "tok",
        refreshToken: null,
        expiresAt: FUTURE_DATE,
        createdAt: new Date(),
      }),
    });
    const result = await svc.validateSession("sess-1");
    expect(result).toEqual({ sessionId: "sess-1", email: "user@example.com" });
  });

  it("returns null when session is expired and no refresh token exists", async () => {
    const svc = makeService({
      get: jest.fn().mockResolvedValue({
        id: "sess-old",
        email: "user@example.com",
        accessToken: "tok",
        refreshToken: null,
        expiresAt: PAST_DATE,
        createdAt: new Date(),
      }),
    });
    expect(await svc.validateSession("sess-old")).toBeNull();
  });

  it("returns null when token refresh fails", async () => {
    const svc = makeService(
      {
        get: jest.fn().mockResolvedValue({
          id: "sess-expired",
          email: "user@example.com",
          accessToken: "tok",
          refreshToken: "refresh-tok",
          expiresAt: PAST_DATE,
          createdAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      { refreshToken: jest.fn().mockResolvedValue(null) },
    );
    expect(await svc.validateSession("sess-expired")).toBeNull();
  });

  it("refreshes the token and returns a session when refresh succeeds", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const svc = makeService(
      {
        get: jest.fn().mockResolvedValue({
          id: "sess-refresh",
          email: "user@example.com",
          accessToken: "old-tok",
          refreshToken: "refresh-tok",
          expiresAt: PAST_DATE,
          createdAt: new Date(),
        }),
        update,
      },
      {
        refreshToken: jest.fn().mockResolvedValue({
          accessToken: "new-tok",
          refreshToken: "new-refresh-tok",
          idToken: undefined,
          expiresIn: undefined,
          scope: undefined,
          tokenType: undefined,
        }),
      },
    );
    const result = await svc.validateSession("sess-refresh");
    expect(result).toEqual({ sessionId: "sess-refresh", email: "user@example.com" });
    expect(update).toHaveBeenCalledWith(
      "sess-refresh",
      expect.objectContaining({ accessToken: "new-tok", email: "user@example.com" }),
    );
  });
});

describe("GoogleSessionService.createSession", () => {
  it("creates a session and returns the new session id and email", async () => {
    const create = jest.fn().mockResolvedValue("created-session-id");
    const svc = makeService({ create });
    const result = await svc.createSession("user@example.com", "access-tok");
    expect(result).toEqual({ sessionId: "created-session-id", email: "user@example.com" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com", accessToken: "access-tok" }),
    );
  });

  it("passes an optional refresh token through to persistence", async () => {
    const create = jest.fn().mockResolvedValue("s-id");
    const svc = makeService({ create });
    await svc.createSession("user@example.com", "access-tok", undefined, "refresh-tok");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "refresh-tok" }),
    );
  });
});

describe("GoogleSessionService.destroySession", () => {
  it("delegates deletion to the persistence service", async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const svc = makeService({ delete: del });
    await svc.destroySession("sess-to-delete");
    expect(del).toHaveBeenCalledWith("sess-to-delete");
  });
});
