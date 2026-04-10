export class MelCloudAuthCookiesPersistenceService {
  private authCookies: string | null = null;

  public async storeAuthCookies(authCookies: string): Promise<void> {
    this.authCookies = authCookies;
  }

  public async retrieveAuthCookies(): Promise<string | null> {
    return this.authCookies;
  }
}
