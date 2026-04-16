import { SessionsPersistenceService } from "./sessions.persistence.service";
import { GoogleAuthService } from "./google-auth.service";

export interface ApplicationSession {
  // Add any other fields we need here.
  sessionId: string;
  email: string;
}

const TWO_WEEKS = 2 * 24 * 60 * 60 * 1000;

export class GoogleSessionService {
  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly sessionsPersistenceService: SessionsPersistenceService,
  ) {}

  async validateSession(
    sessionId: string,
    currentDate = Date.now(),
  ): Promise<ApplicationSession | null> {
    // Store the session
    const currentSession = await this.sessionsPersistenceService.get(sessionId);
    if (!currentSession) {
      return null;
    }

    // Check if the session has expired
    const sessionHasExpired =
      currentDate > currentSession.expiresAt.getTime() - 10_000;
    if (!sessionHasExpired) {
      // Session exists and everything is ok!
      return {
        sessionId,
        email: currentSession.email,
      };
    }

    if (!currentSession.refreshToken) {
      // Nothing that can be done here, token has expired and can't be renewed.
      return null;
    }

    const refreshedToken = await this.googleAuthService.refreshToken(
      currentSession.refreshToken,
    );
    if (!refreshedToken?.accessToken) {
      // Error happened!
      return null;
    }

    await this.sessionsPersistenceService.update(sessionId, {
      email: currentSession.email,
      accessToken: refreshedToken.accessToken,
      refreshToken: refreshedToken.refreshToken,
      expiresAt: new Date(
        // In theory sessions don't need to expire. A user's email is always their email forever
        // The only check we need is if the email is still valid in our system and we already do a DB read
        // for every action a user performs.
        Date.now() + TWO_WEEKS,
      ),
    });

    // New session was created.
    return {
      sessionId,
      email: currentSession.email,
    };
  }

  public async createSession(
    email: string,
    accessToken: string,
    _?: number,
    refreshToken?: string,
  ): Promise<ApplicationSession> {
    const expiresAt = new Date(
      // In theory sessions don't need to expire. A user's email is always their email forever
      // The only check we need is if the email is still valid in our system and we already do a DB read
      // for every action a user performs.
      Date.now() + TWO_WEEKS,
    );

    const sessionId = await this.sessionsPersistenceService.create({
      email,
      accessToken,
      refreshToken,
      expiresAt,
    });

    return {
      sessionId,
      email,
    };
  }

  public async destroySession(sessionId: string) {
    await this.sessionsPersistenceService.delete(sessionId);
  }
}
