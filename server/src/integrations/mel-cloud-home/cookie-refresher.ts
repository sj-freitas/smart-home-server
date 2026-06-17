import { MelCloudAuthCookiesPersistenceService } from "./auth-cookies.persistence.service";
import { getAuthorizationCookies } from "./authorization-cookies";
import { MelCloudHomeIntegration } from "../../config/integration.zod";
import { ConfigService } from "../../config/config-service";
import { startScheduler } from "../../helpers/scheduler";
import { withRetries } from "../../helpers/retry";
import { PinoLogger } from "nestjs-pino";

const ONE_HOUR_MS = 1000 * 60 * 60 * 1;

function createRefreshAuthCookiesFunction(
  melCloudHomeConfig: MelCloudHomeIntegration,
  authCookiesService: MelCloudAuthCookiesPersistenceService,
  logger: PinoLogger,
) {
  return async () => {
    logger.info(
      { source: "background", task: "cookie-refresh" },
      "MelCloud: starting background cookie refresh",
    );
    try {
      const cookie = await withRetries(
        () => getAuthorizationCookies(melCloudHomeConfig, logger),
        3,
        5_000,
        true,
        (attempt, maxAttempts, err) => {
          logger.warn(
            {
              source: "background",
              task: "cookie-refresh",
              attempt,
              maxAttempts,
              err,
            },
            "MelCloud: cookie refresh attempt failed, retrying",
          );
        },
      )();
      await authCookiesService.storeAuthCookies(cookie);
      logger.info(
        { source: "background", task: "cookie-refresh" },
        "MelCloud: background cookie refresh succeeded",
      );
    } catch (err) {
      logger.error(
        { source: "background", task: "cookie-refresh", err },
        "MelCloud: all cookie refresh attempts exhausted, will retry on next scheduled run",
      );
    }
  };
}

export async function spinCookieRefresher(
  config: ConfigService,
  authCookiesService: MelCloudAuthCookiesPersistenceService,
  logger: PinoLogger,
): Promise<() => Promise<void>> {
  const melCloudHomeConfig = config
    .getConfig()
    .integrations.find((t) => t.name === "mel_cloud_home");
  if (!melCloudHomeConfig) {
    throw new Error("MelCloudHome integration config not found");
  }
  const refreshAuthCookiesTask = createRefreshAuthCookiesFunction(
    melCloudHomeConfig,
    authCookiesService,
    logger,
  );
  const authCookies = await authCookiesService.retrieveAuthCookies();

  if (!authCookies) {
    logger.info(
      { source: "background", task: "cookie-refresh" },
      "MelCloud: no existing cookies found, performing initial refresh and scheduling periodic runs",
    );
    await startScheduler(refreshAuthCookiesTask, ONE_HOUR_MS);
  }

  return refreshAuthCookiesTask;
}
