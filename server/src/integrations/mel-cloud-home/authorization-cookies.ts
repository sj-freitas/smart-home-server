import puppeteer, { Browser, BrowserContext, Cookie, Page } from "puppeteer";
import { sleep } from "../../helpers/sleep";
import { MelCloudHomeIntegration } from "../../config/integration.zod";
import { PinoLogger } from "nestjs-pino";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36";

async function buildBrowser(logger: PinoLogger): Promise<Browser> {
  logger.debug("MelCloud: launching headless Chrome");
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  return puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
}

/**
 * Refreshes the page if the Blazor error overlay is detected.
 * Initially the MEL Cloud Home page can have an error message requesting us to refresh.
 */
async function ensurePageHealthy(
  page: Page,
  logger: PinoLogger,
  maxAttempts = 6,
): Promise<void> {
  for (let i = 1; i <= maxAttempts; i++) {
    const blazorError = await page.$("#blazor-error-ui");
    if (!blazorError || !(await blazorError.isVisible())) {
      return;
    }

    logger.warn(
      { attempt: i, maxAttempts },
      "MelCloud: Blazor error overlay detected, refreshing page",
    );
    await page.reload({ waitUntil: ["domcontentloaded", "networkidle2"] });
  }

  logger.warn(
    { maxAttempts },
    "MelCloud: max health-check attempts reached, proceeding anyway",
  );
}

async function getMelCloudHomeSecureCookies(
  cookies: Cookie[],
): Promise<string[]> {
  return cookies
    .filter((c) => c.name.startsWith("__Secure-monitorandcontrol"))
    .map((c) => `${c.name}=${c.value}`);
}

/**
 * Launches a headless browser, logs in to MEL Cloud Home, and returns the auth cookies.
 * Throws on failure — callers should wrap with withRetries if retry behaviour is desired.
 */
export async function getAuthorizationCookies(
  melCloudHomeConfig: MelCloudHomeIntegration,
  logger: PinoLogger,
): Promise<string> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await buildBrowser(logger);
    context = await browser.createBrowserContext();
    const page = await context.newPage();

    await page.setUserAgent({ userAgent: DEFAULT_USER_AGENT });
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(60_000);

    logger.debug(
      { url: melCloudHomeConfig.siteUrl },
      "MelCloud: navigating to login page",
    );
    await page.goto(melCloudHomeConfig.siteUrl, {
      waitUntil: ["domcontentloaded", "networkidle2"],
    });
    await ensurePageHealthy(page, logger);

    logger.debug("MelCloud: clicking Sign In and entering credentials");
    const signInButton = await page.waitForSelector(
      "xpath=//button[normalize-space() = 'Sign In']",
    );
    if (!signInButton) {
      throw new Error("Sign in button not found");
    }
    await signInButton.click();

    await page.waitForSelector("#signInFormUsername", { timeout: 5000 });
    await page.waitForSelector("#signInFormPassword", { timeout: 5000 });
    await page.type("#signInFormUsername", melCloudHomeConfig.username, {
      delay: 30,
    });
    await page.type("#signInFormPassword", melCloudHomeConfig.password, {
      delay: 30,
    });
    await page.keyboard.press("Enter");

    await sleep(2000);
    const cookies = await context.cookies();
    const melCloudHomeCookies = await getMelCloudHomeSecureCookies(cookies);
    if (!melCloudHomeCookies.length) {
      throw new Error("No monitor cookies found after login");
    }

    logger.info(
      { cookieCount: melCloudHomeCookies.length },
      "MelCloud: authorization cookies retrieved successfully",
    );
    return melCloudHomeCookies.join("; ");
  } finally {
    await Promise.all(
      [browser, context]
        .filter((t) => t !== null)
        .map(async (t) => await t.close()),
    );
  }
}
