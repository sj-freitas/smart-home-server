import puppeteer, { Browser, BrowserContext, Cookie, Page } from "puppeteer";
import { sleep } from "../../helpers/sleep";
import { MelCloudHomeIntegration } from "../../config/integration.zod";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36";

async function buildBrowser(): Promise<Browser> {
  console.log("Launching local headless Chrome");
  return puppeteer.launch({
    headless: true,
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
async function ensurePageHealthy(page: Page, maxAttempts = 6): Promise<void> {
  for (let i = 1; i <= maxAttempts; i++) {
    const blazorError = await page.$("#blazor-error-ui");
    if (!blazorError || !(await blazorError.isVisible())) {
      return;
    }

    console.warn(
      `Detected #blazor-error-ui (attempt ${i}/${maxAttempts}) — refreshing`,
    );

    await page.reload({
      waitUntil: ["domcontentloaded", "networkidle2"],
    });
  }

  console.warn("Max health-check attempts reached; continuing anyway.");
}

async function clickSignInAndLogin(
  page: Page,
  melCloudHomeUrl: string,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(melCloudHomeUrl, {
    waitUntil: ["domcontentloaded", "networkidle2"],
  });

  await ensurePageHealthy(page);

  const signInButtonSelector = "xpath=//button[normalize-space() = 'Sign In']";
  const signInButton = await page.waitForSelector(signInButtonSelector);

  await signInButton.click();

  const emailSelector = "#signInFormUsername";
  const passwordSelector = "#signInFormPassword";

  await page.waitForSelector(emailSelector, { timeout: 5000 });
  await page.waitForSelector(passwordSelector, { timeout: 5000 });

  await page.type(emailSelector, email, { delay: 30 });
  await page.type(passwordSelector, password, { delay: 30 });

  await page.keyboard.press("Enter");
}

async function getMelCloudHomeSecureCookies(
  cookies: Cookie[],
): Promise<string[]> {
  return cookies
    .filter((c) => c.name.startsWith("__Secure-monitorandcontrol"))
    .map((c) => `${c.name}=${c.value}`);
}

export async function getAuthorizationCookies(
  melCloudHomeConfig: MelCloudHomeIntegration,
): Promise<string> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await buildBrowser();
    context = await browser.createBrowserContext();
    const page = await context.newPage();

    await page.setUserAgent({
      userAgent: DEFAULT_USER_AGENT,
    });
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(60_000);

    await clickSignInAndLogin(
      page,
      melCloudHomeConfig.siteUrl,
      melCloudHomeConfig.username,
      melCloudHomeConfig.password,
    );

    await sleep(2000);
    const cookies = await context.cookies();
    const melCloudHomeCookies = await getMelCloudHomeSecureCookies(cookies);
    if (!melCloudHomeCookies.length) {
      throw new Error("[FAILURE] No monitor cookies found");
    }

    console.log("[SUCCESS] Authorization cookies retrieved");
    return melCloudHomeCookies.join("; ");
  } catch (err) {
    console.error("Failed to obtain authorization cookies:", err);
    throw err;
  } finally {
    // Put into an array of promises to make sure both close are executed regardless of one another
    await Promise.all(
      [browser, context]
        .filter((t) => t !== null)
        .map(async (t) => await t.close()),
    );
  }
}
