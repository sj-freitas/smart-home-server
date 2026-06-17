export interface MelCloudAuthCookiesPersistenceService {
  storeAuthCookies(cookies: string): Promise<void>;
  retrieveAuthCookies(): Promise<string | null>;
}

export class InMemoryMelCloudAuthCookiesPersistenceService implements MelCloudAuthCookiesPersistenceService {
  private authCookies: string | null = null;

  async storeAuthCookies(authCookies: string): Promise<void> {
    this.authCookies = authCookies;
  }

  async retrieveAuthCookies(): Promise<string | null> {
    return this.authCookies;
  }
}
