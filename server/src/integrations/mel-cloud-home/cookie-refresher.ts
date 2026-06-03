import { MelCloudAuthCookiesPersistenceService } from "./auth-cookies.persistence.service";
import { getAuthorizationCookies } from "./authorization-cookies";
import { MelCloudHomeIntegration } from "../../config/integration.zod";
import { ConfigService } from "../../config/config-service";
import { withRetries } from "../../helpers/retry";

const getAuthorizationCookiesWithRetry = withRetries(getAuthorizationCookies);

const ONE_HOUR_MS = 1000 * 60 * 60 * 1;
const createRefreshAuthCookiesFunction =
  (
    melCloudHomeConfig: MelCloudHomeIntegration,
    authCookiesService: MelCloudAuthCookiesPersistenceService,
  ) =>
  async () => {
    const cookie = await getAuthorizationCookiesWithRetry(melCloudHomeConfig);
    if (!cookie) {
      console.error(
        "Failed to refresh MelCloudHome authorization cookies. Will retry in the next scheduled run.",
      );
      return;
    }
    await authCookiesService.storeAuthCookies(cookie);
  };

export async function spinCookieRefresher(
  config: ConfigService,
  authCookiesService: MelCloudAuthCookiesPersistenceService,
<<<<<<< Updated upstream
): Promise<() => Promise<void>> {
=======
): Promise<void> {
>>>>>>> Stashed changes
  const melCloudHomeConfig = config
    .getConfig()
    .integrations.find((t) => t.name === "mel_cloud_home");
  if (!melCloudHomeConfig) {
    throw new Error("MelCloudHome integration config not found");
  }
  const refreshAuthCookiesTask = createRefreshAuthCookiesFunction(
    melCloudHomeConfig,
    authCookiesService,
  );

  // Schedule hourly refresh regardless of whether cookies already exist.
  setInterval(() => void refreshAuthCookiesTask(), ONE_HOUR_MS);

  const authCookies = await authCookiesService.retrieveAuthCookies();
  if (!authCookies) {
    // No cookies in DB — fire Chrome in the background so startup isn't blocked.
    // The integration returns offline state gracefully until cookies arrive.
    void refreshAuthCookiesTask();
  }
<<<<<<< Updated upstream

  return refreshAuthCookiesTask;
=======
>>>>>>> Stashed changes
}
