import type { Browser, BrowserContext, Page, Locator } from 'playwright';
import { AccountStatus } from '@fix-and-flow/types';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { humanTypeInput, randomDelay, simulateTyping, randomBetween, randomTypingDelay } from '../../utils/human-behavior';
import { normalizeFacebookCookies, hasFacebookSessionCookie } from '../../utils/facebook-cookies';
import { launchStealthBrowser } from '../../utils/playwright-browser';
import { resolveImageToTempPath, cleanupTempFiles } from '../../utils/network';
import { gotoWithRetry, gotoFacebookWithFallback, isNetworkError, isProxyNetworkError } from '../../utils/playwright-navigation';
import {
  isExecutionContextDestroyedError,
  waitForPageStable,
  waitForPostSubmitNavigation,
} from '../../utils/playwright-page-stable';
import {
  detectCaptcha,
  getCaptchaMode,
  getConfiguredCaptchaService,
  handleLoginCaptchaStep,
  resolveAllLoginCaptchas,
  resolveCaptchaOnPage,
} from '../../services/captcha.integration';
import { captchaLogger, getCaptchaLogPath } from '../../config/captcha.logger';
import { SELECTORS } from './marketplace.selectors';
import { isCategorySelected, selectMarketplaceCategory } from './marketplace-category';
import {
  isConditionSelected,
  selectMarketplaceCondition,
  waitForListingForm,
} from './marketplace-dropdown';
import { detectAccountHealth, AccountHealthResult } from './account-health';
import {
  BrowserSession,
  ProxyConfig,
  PostingCredentials,
  ListingData,
  PostingResult,
  PlaywrightConfig,
  SessionCallbacks,
  InboxScrapeResult,
  InboxMessage,
  VerifyAccountResult,
  FacebookLoginResult,
  SessionRunOptions,
} from './posting.types';

type CredentialsWithAuth = PostingCredentials & { password?: string; email?: string };

const FACEBOOK_URL = 'https://www.facebook.com';
const MARKETPLACE_CREATE_URL = SELECTORS.marketplace.createListing;
const MARKETPLACE_INBOX_URL = SELECTORS.marketplace.inbox;

export class PlaywrightEngine {
  private config: PlaywrightConfig;

  constructor(config?: Partial<PlaywrightConfig>) {
    this.config = {
      headless: config?.headless ?? env.PLAYWRIGHT_HEADLESS,
      slowMo: config?.slowMo ?? env.PLAYWRIGHT_SLOW_MO,
      timeout: config?.timeout ?? 90000,
    };
  }

  async launchBrowser(proxy?: ProxyConfig, headless?: boolean): Promise<Browser> {
    const useHeadless = headless ?? this.config.headless;
    const launchOptions: Parameters<typeof launchStealthBrowser>[0] = {
      headless: useHeadless,
      slowMo: this.config.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    };

    if (env.PLAYWRIGHT_BROWSER_CHANNEL) {
      launchOptions.channel = env.PLAYWRIGHT_BROWSER_CHANNEL;
    }

    if (proxy) {
      launchOptions.proxy = {
        server: proxy.server,
        username: proxy.username,
        password: proxy.password,
      };
    }

    logger.info(
      {
        headless: useHeadless,
        proxy: !!proxy,
        channel: env.PLAYWRIGHT_BROWSER_CHANNEL || 'chromium',
        stealth: env.PLAYWRIGHT_USE_STEALTH,
      },
      'Launching browser',
    );
    return launchStealthBrowser(launchOptions);
  }

  async createSession(
    credentials: PostingCredentials,
    options?: { headless?: boolean },
  ): Promise<BrowserSession> {
    const browser = await this.launchBrowser(credentials.proxy, options?.headless);
    const context = await browser.newContext({
      userAgent: credentials.userAgent,
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
    });

    await context.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    `);

    if (credentials.cookies) {
      try {
        const parsed = JSON.parse(credentials.cookies);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cookies = normalizeFacebookCookies(parsed);
          await context.addCookies(cookies as unknown as Parameters<BrowserContext['addCookies']>[0]);
          logger.info(
            {
              accountId: credentials.accountId,
              count: cookies.length,
              hasSession: hasFacebookSessionCookie(cookies as Array<{ name?: string; value?: string }>),
            },
            'Cookies loaded',
          );
        }
      } catch (err) {
        logger.warn({ accountId: credentials.accountId, err }, 'Failed to parse cookies');
      }
    }

    const page = await context.newPage();
    page.setDefaultTimeout(this.config.timeout);

    return { browser, context, page };
  }

  async closeSession(session: BrowserSession): Promise<void> {
    await session.context.close();
    await session.browser.close();
  }

  async checkPageHealth(page: Page, context?: BrowserContext): Promise<AccountHealthResult> {
    await waitForPageStable(page, { timeoutMs: 8_000 }).catch(() => undefined);
    await this.dismissPostLoginDialogs(page);

    const loginFormVisible = await page
      .locator(SELECTORS.login.emailInput)
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    if (loginFormVisible) {
      return {
        status: AccountStatus.INACTIVE,
        isLoggedIn: false,
        reason: 'Facebook login page',
      };
    }

    const cookies = context ? await context.cookies() : [];
    const text = await page.locator('body').innerText().catch(() => '');
    return detectAccountHealth(text, page.url(), cookies);
  }

  async checkMarketplaceAccess(session: BrowserSession): Promise<AccountHealthResult> {
    const { page, context } = session;

    await waitForPageStable(page, { timeoutMs: 12_000 }).catch(() => undefined);
    await this.dismissPostLoginDialogs(page);

    const url = page.url().toLowerCase();
    const cookies = await context.cookies();

    if (url.includes('/login') || url.includes('checkpoint')) {
      return {
        status: AccountStatus.INACTIVE,
        isLoggedIn: false,
        reason: 'Redirected to Facebook login — re-connect the account under Accounts',
      };
    }

    const loginFormVisible = await page
      .locator(SELECTORS.login.emailInput)
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    if (loginFormVisible) {
      return {
        status: AccountStatus.INACTIVE,
        isLoggedIn: false,
        reason: 'Facebook login required — re-connect the account under Accounts',
      };
    }

    const text = await page.locator('body').innerText().catch(() => '');
    const textHealth = detectAccountHealth(text, url, cookies);

    if (textHealth.status === AccountStatus.BANNED || textHealth.status === AccountStatus.FLAGGED) {
      return textHealth;
    }

    const hasCreateForm = await page
      .locator(SELECTORS.marketplace.titleInput)
      .first()
      .isVisible({ timeout: 12_000 })
      .catch(() => false);

    const onMarketplace = url.includes('marketplace');
    const hasSession = hasFacebookSessionCookie(cookies);

    if (hasCreateForm || (onMarketplace && hasSession)) {
      return { status: AccountStatus.ACTIVE, isLoggedIn: true };
    }

    return {
      status: AccountStatus.INACTIVE,
      isLoggedIn: false,
      reason: textHealth.reason ?? 'Could not open Marketplace create listing',
    };
  }

  async withResilientSession<T>(
    credentials: CredentialsWithAuth,
    operation: (session: BrowserSession) => Promise<T>,
    options?: SessionRunOptions,
  ): Promise<T> {
    const strategies: Array<{ proxy?: ProxyConfig; label: string }> = [];

    if (credentials.proxy) {
      strategies.push({ proxy: credentials.proxy, label: 'account-proxy' });
      if (env.PLAYWRIGHT_PROXY_FALLBACK) {
        strategies.push({ proxy: undefined, label: 'direct-no-proxy' });
      }
    } else {
      strategies.push({ proxy: undefined, label: 'direct' });
    }

    let lastError: Error | undefined;

    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      let session: BrowserSession | null = null;

      try {
        logger.info(
          {
            accountId: credentials.accountId,
            strategy: strategy.label,
            attempt: i + 1,
            total: strategies.length,
          },
          'Starting browser session',
        );

        session = await this.createSession(
          { ...credentials, proxy: strategy.proxy },
          { headless: options?.headless },
        );
        return await operation(session);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const hasNext = i < strategies.length - 1;
        const isNetwork = isProxyNetworkError(lastError);

        if (hasNext && isNetwork) {
          logger.warn(
            {
              accountId: credentials.accountId,
              strategy: strategy.label,
              nextStrategy: strategies[i + 1]?.label,
              error: lastError.message.split('\n')[0],
            },
            'Session failed — trying next connection strategy',
          );

          if (strategy.proxy && options?.onProxyFailure) {
            await options.onProxyFailure();
          }
          continue;
        }

        throw lastError;
      } finally {
        if (session) {
          await this.closeSession(session);
        }
      }
    }

    throw lastError ?? new Error('Browser session failed');
  }

  async loginWithCredentials(
    page: Page,
    email: string,
    password: string,
    accountId?: string,
  ): Promise<boolean> {
    logger.info({ email, accountId, captchaMode: getCaptchaMode() }, 'Attempting Facebook login');
    captchaLogger.info({ accountId, email, captchaMode: getCaptchaMode() }, '=== Facebook login started ===');

    await gotoWithRetry(page, `${FACEBOOK_URL}/login`);
    await randomDelay(2500, 5000);
    await this.simulateHumanInteraction(page);

    const emailInput = page.locator(SELECTORS.login.emailInput).first();
    const passInput = page.locator(SELECTORS.login.passwordInput).first();

    if (!(await emailInput.isVisible({ timeout: 10000 }).catch(() => false))) {
      captchaLogger.error({ accountId }, 'Login form not visible');
      return false;
    }

    captchaLogger.info({ accountId }, 'Typing email with human keyboard input');
    await humanTypeInput(page, emailInput, email);
    await randomDelay(900, 2200);

    captchaLogger.info({ accountId }, 'Typing password with human keyboard input');
    await humanTypeInput(page, passInput, password);
    await randomDelay(1200, 2800);

    await this.simulateHumanInteraction(page);
    await randomDelay(800, 1800);

    await this.clickLoginSubmit(page);
    await waitForPostSubmitNavigation(page);

    const captchaLoop = await resolveAllLoginCaptchas(page, {
      timeoutMs: env.PLAYWRIGHT_LOGIN_TIMEOUT_MS,
      maxRounds: env.PLAYWRIGHT_CAPTCHA_MAX_ROUNDS,
      accountId,
      isLoggedIn: async () => (await this.checkPageHealth(page)).isLoggedIn,
      resubmitLogin: async () => {
        await this.clickLoginSubmit(page);
        await waitForPostSubmitNavigation(page);
      },
    });

    if (!captchaLoop.allSolved && captchaLoop.rounds > 0) {
      captchaLogger.error(
        { accountId, rounds: captchaLoop.rounds, lastError: captchaLoop.lastError },
        'Captcha loop did not complete — see captcha.log',
      );
    }

    await waitForPageStable(page);
    const health = await this.checkPageHealth(page);
    captchaLogger.info(
      { accountId, isLoggedIn: health.isLoggedIn, captchaRounds: captchaLoop.rounds },
      '=== Facebook login credentials step finished ===',
    );
    return health.isLoggedIn;
  }

  private async clickLoginSubmit(page: Page): Promise<void> {
    const loginButton = page.locator(SELECTORS.login.loginButton).first();
    const passInput = page.locator(SELECTORS.login.passwordInput).first();

    if (await loginButton.isVisible({ timeout: 4000 }).catch(() => false)) {
      await loginButton.click();
      return;
    }

    logger.warn('Login button not found with known selectors; submitting with Enter key');
    await passInput.press('Enter');
  }

  private async resolveCaptchaIfPresent(page: Page, accountId?: string): Promise<boolean> {
    if (getCaptchaMode() === 'manual') {
      const detection = await detectCaptcha(page).catch(() => ({
        present: false,
        type: 'none' as const,
      }));
      if (detection.present) {
        captchaLogger.debug({ accountId }, 'Captcha visible — manual mode, waiting for user');
      }
      return true;
    }

    try {
      await waitForPageStable(page);
      const detection = await detectCaptcha(page);
      if (!detection.present) return true;

      captchaLogger.info(
        { accountId, type: detection.type, siteKey: detection.siteKey?.slice(0, 8) },
        'Auto-solving captcha via captcha.ts',
      );

      const service = getConfiguredCaptchaService();
      if (!service) {
        captchaLogger.warn({ accountId }, 'No TWOCAPTCHA_API_KEY — cannot auto-solve');
        return false;
      }

      const solved = await resolveCaptchaOnPage(page, service, detection);
      captchaLogger.info({ accountId, solved, type: detection.type }, 'resolveCaptchaOnPage result');
      return solved;
    } catch (error) {
      if (isExecutionContextDestroyedError(error)) {
        captchaLogger.debug({ accountId }, 'Captcha check interrupted by navigation');
        return true;
      }

      captchaLogger.error({ accountId, error }, 'Captcha resolution error');
      return false;
    }
  }

  private isAwaitingManualAuth(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.includes('checkpoint') ||
      lower.includes('two_step') ||
      lower.includes('twofactor') ||
      lower.includes('auth_platform') ||
      lower.includes('/login/device-based') ||
      lower.includes('approvals') ||
      lower.includes('confirmemail')
    );
  }

  private async waitForLoginCompletion(
    page: Page,
    maxWaitMs: number,
    accountId?: string,
  ): Promise<{ completed: boolean; manualAuth: boolean; captchaRounds: number }> {
    const start = Date.now();
    let manualAuth = false;
    let captchaRounds = 0;

    while (Date.now() - start < maxWaitMs) {
      const url = page.url();

      if (this.isAwaitingManualAuth(url)) {
        const captchaOnPage = await detectCaptcha(page).catch(() => ({
          present: false,
          type: 'none' as const,
        }));

        if (captchaOnPage.present && getCaptchaMode() === 'auto') {
          captchaRounds++;
          captchaLogger.info(
            { accountId, round: captchaRounds, url },
            'Captcha on checkpoint/login page — auto-solving',
          );
          const step = await handleLoginCaptchaStep(page, {
            timeoutMs: Math.min(120_000, maxWaitMs - (Date.now() - start)),
            isLoggedIn: async () => (await this.checkPageHealth(page)).isLoggedIn,
            accountId,
            round: captchaRounds,
          });
          if (!step.solved) {
            captchaLogger.warn({ accountId, round: captchaRounds }, 'Auto captcha failed during auth wait');
          }
          continue;
        }

        manualAuth = true;
        captchaLogger.info({ accountId, url }, 'Waiting for 2FA / checkpoint in browser');
        logger.info({ url }, 'Complete 2FA or checkpoint in the browser window');
        await page.waitForTimeout(3000);
        continue;
      }

      try {
        await waitForPageStable(page, { timeoutMs: 8_000 });
      } catch {
        /* keep polling */
      }

      await this.resolveCaptchaIfPresent(page, accountId);

      let health: AccountHealthResult;
      try {
        health = await this.checkPageHealth(page);
      } catch (error) {
        if (isExecutionContextDestroyedError(error)) {
          await page.waitForTimeout(2000);
          continue;
        }
        throw error;
      }
      if (health.isLoggedIn) {
        captchaLogger.info({ accountId, captchaRounds }, 'Login completion — success');
        return { completed: true, manualAuth, captchaRounds };
      }

      if (
        health.status === AccountStatus.BANNED ||
        health.status === AccountStatus.FLAGGED
      ) {
        return { completed: false, manualAuth, captchaRounds };
      }

      await page.waitForTimeout(3000);
    }

    captchaLogger.warn(
      { accountId, manualAuth, captchaRounds, elapsedMs: Date.now() - start },
      'Login completion timed out',
    );
    return { completed: false, manualAuth, captchaRounds };
  }

  private async dismissPostLoginDialogs(page: Page): Promise<void> {
    const dismissLabels = [
      'Not Now',
      'Not now',
      'Skip',
      'Close',
      'OK',
      'Allow all cookies',
      'Accept All',
    ];

    for (const label of dismissLabels) {
      const btn = page.getByRole('button', { name: label }).first();
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click().catch(() => undefined);
        await randomDelay(500, 1000);
      }
    }
  }

  async loginAccount(
    credentials: CredentialsWithAuth,
    callbacks?: SessionCallbacks,
    sessionOptions?: SessionRunOptions,
  ): Promise<FacebookLoginResult> {
    if (!credentials.email || !credentials.password) {
      return {
        success: false,
        status: AccountStatus.INACTIVE,
        isLoggedIn: false,
        reason: 'Account email and password are required for Facebook login',
        loginMethod: 'playwright',
      };
    }

    const usedProxy = !!credentials.proxy;
    let proxyFallback = false;
    const headless = sessionOptions?.headless ?? env.PLAYWRIGHT_LOGIN_HEADLESS;

    try {
      return await this.withResilientSession(
        credentials,
        async (session) => {
          await this.navigateToFacebook(session.page);
          let health = await this.checkPageHealth(session.page, session.context);
          let manualAuthCompleted = false;

          if (!health.isLoggedIn) {
            const loginStart = Date.now();

            if (this.isAwaitingManualAuth(session.page.url())) {
              manualAuthCompleted = true;
            } else {
              logger.info(
                {
                  accountId: credentials.accountId,
                  headless,
                  captchaMode: getCaptchaMode(),
                  captchaLog: getCaptchaLogPath(),
                },
                'Opening Facebook login — captcha auto-solve via captcha.ts when API key set',
              );
              await this.loginWithCredentials(
                session.page,
                credentials.email!,
                credentials.password!,
                credentials.accountId,
              );
            }

            const elapsed = Date.now() - loginStart;
            const remainingMs = Math.max(60_000, env.PLAYWRIGHT_LOGIN_TIMEOUT_MS - elapsed);

            const wait = await this.waitForLoginCompletion(
              session.page,
              remainingMs,
              credentials.accountId,
            );
            manualAuthCompleted = manualAuthCompleted || wait.manualAuth;

            if (!wait.completed) {
              health = await this.checkPageHealth(session.page, session.context);
              const captchaMode = getCaptchaMode();
              const logHint = `See ${getCaptchaLogPath()} for captcha details`;

              let reason: string;
              if (wait.captchaRounds > 0 && captchaMode === 'auto') {
                reason = `Captcha auto-solve did not finish (${wait.captchaRounds} round(s)). ${logHint}`;
              } else if (manualAuthCompleted) {
                reason = `Login timed out waiting for 2FA or checkpoint. ${logHint}`;
              } else if (captchaMode === 'manual') {
                reason = `Login timed out — solve captcha in the browser. ${logHint}`;
              } else {
                reason = health.reason ?? `Facebook login failed. ${logHint}`;
              }

              return {
                success: false,
                status: health.status,
                isLoggedIn: false,
                reason,
                loginMethod: 'playwright',
                manualAuthCompleted,
                captchaMode,
                diagnostics: {
                  facebookReachable: true,
                  usedProxy,
                  proxyFallback,
                  facebookUrl: session.page.url(),
                },
              };
            }
          }

          await this.dismissPostLoginDialogs(session.page);
          health = await this.checkPageHealth(session.page, session.context);

          const cookies = await session.context.cookies();
          if (callbacks?.onCookiesUpdated && cookies.length > 0) {
            await callbacks.onCookiesUpdated(cookies);
          }
          if (callbacks?.onAccountHealth) {
            await callbacks.onAccountHealth(health);
          }

          return {
            success:
              health.isLoggedIn &&
              health.status !== AccountStatus.BANNED &&
              health.status !== AccountStatus.FLAGGED,
            status: health.status,
            isLoggedIn: health.isLoggedIn,
            reason: health.reason,
            cookiesSaved: cookies.length,
            loginMethod: 'playwright',
            manualAuthCompleted,
            captchaMode: getCaptchaMode(),
            diagnostics: {
              facebookReachable: true,
              usedProxy,
              proxyFallback,
              facebookUrl: session.page.url(),
            },
          };
        },
        {
          ...sessionOptions,
          headless,
          onProxyFailure: async () => {
            proxyFallback = true;
            if (sessionOptions?.onProxyFailure) {
              await sessionOptions.onProxyFailure();
            }
          },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      const recommendation =
        'Facebook is blocked or unreachable from this network. Add a working residential proxy (Proxies tab), assign it to the account, then connect again. Or set PLAYWRIGHT_GLOBAL_PROXY in .env.';

      const navigationHint =
        'Facebook redirected while automation was running. Wait for the browser to finish loading, then click Connect Facebook again.';

      return {
        success: false,
        status: AccountStatus.INACTIVE,
        isLoggedIn: false,
        reason: isExecutionContextDestroyedError(error)
          ? navigationHint
          : isNetworkError(error)
            ? `${recommendation} (Technical: ${message.split('\n')[0]})`
            : message,
        loginMethod: 'playwright',
        diagnostics: {
          facebookReachable: false,
          usedProxy,
          proxyFallback,
          recommendation,
        },
      };
    }
  }

  async ensureLoggedIn(
    session: BrowserSession,
    credentials: PostingCredentials & { password?: string },
    callbacks?: SessionCallbacks,
    options?: { allowCredentialLogin?: boolean },
  ): Promise<AccountHealthResult> {
    await this.navigateToFacebook(session.page);
    await this.simulateHumanInteraction(session.page);

    let health = await this.checkPageHealth(session.page, session.context);

    const allowLogin = options?.allowCredentialLogin !== false;

    if (!health.isLoggedIn && allowLogin && credentials.password && credentials.email) {
      const loggedIn = await this.loginWithCredentials(
        session.page,
        credentials.email,
        credentials.password,
      );
      health = await this.checkPageHealth(session.page, session.context);
      if (!loggedIn) {
        health = { ...health, isLoggedIn: false, reason: 'Login failed' };
      }
    } else if (!health.isLoggedIn && !allowLogin) {
      health = {
        ...health,
        isLoggedIn: false,
        reason:
          health.reason ??
          'Facebook session expired or missing. Re-connect the account under Accounts → Connect Facebook.',
      };
    }

    if (callbacks?.onAccountHealth) {
      await callbacks.onAccountHealth(health);
    }

    const cookies = await session.context.cookies();
    if (callbacks?.onCookiesUpdated && cookies.length > 0) {
      await callbacks.onCookiesUpdated(cookies);
    }

    return health;
  }

  async navigateToFacebook(page: Page): Promise<string> {
    logger.info('Navigating to Facebook (multi-URL fallback)');
    const usedUrl = await gotoFacebookWithFallback(page);
    await randomDelay(2000, 5000);
    return usedUrl;
  }

  async navigateToMarketplace(page: Page): Promise<void> {
    logger.info('Navigating to Marketplace create listing');
    await gotoWithRetry(page, MARKETPLACE_CREATE_URL);
    await randomDelay(3000, 6000);
  }

  async simulateHumanInteraction(page: Page, options?: { scroll?: boolean }): Promise<void> {
    const viewport = page.viewportSize();
    if (!viewport) return;

    const x = Math.floor(Math.random() * viewport.width * 0.8) + viewport.width * 0.1;
    const y = Math.floor(Math.random() * viewport.height * 0.8) + viewport.height * 0.1;

    await page.mouse.move(x, y, { steps: randomSteps() });
    await randomDelay(500, 1500);
    if (options?.scroll !== false) {
      await page.evaluate('window.scrollBy(0, Math.random() * 300)');
      await randomDelay(1000, 2000);
    }
  }

  async uploadImages(page: Page, imageUrls: string[]): Promise<void> {
    if (!imageUrls.length) return;

    logger.info({ count: imageUrls.length }, 'Uploading listing images');
    const tempFiles: string[] = [];

    try {
      for (const url of imageUrls.slice(0, 10)) {
        const localPath = await resolveImageToTempPath(url);
        tempFiles.push(localPath);
      }

      const fileInput = page.locator(SELECTORS.marketplace.imageUpload).first();
      if (await fileInput.count()) {
        await fileInput.setInputFiles(tempFiles);
        await randomDelay(4000, 7000);
        await waitForPageStable(page, { timeoutMs: 10_000 }).catch(() => undefined);
        await this.clickNextIfVisible(page);
        return;
      }

      const addPhotos = page.locator(SELECTORS.marketplace.addPhotosButton).first();
      if (await addPhotos.isVisible({ timeout: 5000 }).catch(() => false)) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 10000 }),
          addPhotos.click(),
        ]);
        await fileChooser.setFiles(tempFiles);
        await randomDelay(4000, 7000);
        await waitForPageStable(page, { timeoutMs: 10_000 }).catch(() => undefined);
        await this.clickNextIfVisible(page);
      }
    } finally {
      await cleanupTempFiles(tempFiles);
    }
  }

  private async isPublishButtonVisible(page: Page): Promise<boolean> {
    const candidates = this.getPublishButtonLocators(page);
    for (const locator of candidates) {
      if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) {
        return true;
      }
    }
    return false;
  }

  private getPublishButtonLocators(page: Page): Locator[] {
    return [
      page.getByRole('button', { name: /^Publish$/i }).first(),
      page.locator('div[aria-label="Publish"]').first(),
      page.locator('[role="button"]:has-text("Publish")').first(),
      page.locator(SELECTORS.marketplace.publishButton).first(),
    ];
  }

  private async clickNextIfVisible(page: Page): Promise<boolean> {
    const nextCandidates = [
      page.getByRole('button', { name: /^Next$/i }).first(),
      page.locator('div[aria-label="Next"]').first(),
      page.locator(SELECTORS.marketplace.nextButton).first(),
    ];

    for (const nextBtn of nextCandidates) {
      if (await nextBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await nextBtn.scrollIntoViewIfNeeded().catch(() => undefined);
        await nextBtn.click({ timeout: 8000, delay: randomBetween(50, 140) }).catch(() => undefined);
        await waitForPageStable(page, { timeoutMs: 8000 }).catch(() => undefined);
        return true;
      }
    }
    return false;
  }

  private async fillFieldIfNeeded(page: Page, locators: Locator[], value: string): Promise<boolean> {
    const target = value.trim();
    if (!target) return false;

    for (const field of locators) {
      if (!(await field.isVisible({ timeout: 2500 }).catch(() => false))) continue;

      const current = (await field.inputValue().catch(() => '')).trim();
      if (current === target || current.includes(target.slice(0, Math.min(20, target.length)))) {
        return true;
      }

      await field.evaluate(
        'el => el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" })',
      );
      await field.click({ delay: randomBetween(60, 160) });
      await field.fill('');
      await humanTypeInput(page, field, target);
      return true;
    }
    return false;
  }

  private async fillPriceIfNeeded(page: Page, price: number): Promise<void> {
    const priceValue = String(price ?? 0);
    const priceFields = [
      page.getByPlaceholder('Price', { exact: true }).first(),
      page.getByLabel(/^Price/i).first(),
      page.locator(SELECTORS.marketplace.priceInput).first(),
    ];

    for (const priceField of priceFields) {
      if (!(await priceField.isVisible({ timeout: 2500 }).catch(() => false))) continue;

      const current = (await priceField.inputValue().catch(() => '')).trim();
      if (current === priceValue) return;

      await priceField.scrollIntoViewIfNeeded().catch(() => undefined);
      await priceField.click({ delay: randomBetween(60, 160) });
      await priceField.fill('');
      await simulateTyping(async (char) => {
        await priceField.pressSequentially(char, { delay: randomTypingDelay() });
      }, priceValue);
      return;
    }
  }

  private async expandMoreDetails(page: Page): Promise<boolean> {
    logger.info('Expanding Show more / More details section');

    const triggers: Locator[] = [
      page.getByText('Show more', { exact: true }).first(),
      page.getByText('More details', { exact: true }).first(),
      page.getByRole('button', { name: /show more/i }).first(),
      page.getByRole('button', { name: /more details/i }).first(),
      page.locator('div:has-text("Show more")').first(),
      page.locator('div:has-text("More details")').first(),
      page.locator(SELECTORS.marketplace.moreDetailsButton).first(),
    ];

    for (const trigger of triggers) {
      if (!(await trigger.isVisible({ timeout: 2000 }).catch(() => false))) continue;

      const expanded = await trigger.getAttribute('aria-expanded').catch(() => null);
      if (expanded === 'true') return true;

      await trigger.click({ timeout: 8000, delay: randomBetween(50, 140) });
      await waitForPageStable(page, { timeoutMs: 4000 }).catch(() => undefined);
      await randomDelay(500, 1000);
      return true;
    }

    return false;
  }

  private async fillCityInMoreDetails(page: Page, city: string): Promise<void> {
    const expanded = await this.expandMoreDetails(page);
    if (!expanded) {
      logger.warn('Show more / More details button not found — trying city field anyway');
    }

    const cityFields = [
      page.getByLabel(/^Location/i).first(),
      page.getByPlaceholder(/location/i).first(),
      page.locator(SELECTORS.marketplace.locationInput).first(),
      page.getByLabel(/^City/i).first(),
      page.getByPlaceholder(/city/i).first(),
    ];

    for (const field of cityFields) {
      if (!(await field.isVisible({ timeout: 4000 }).catch(() => false))) continue;

      const current = (await field.inputValue().catch(() => '')).trim();
      const cityPart = city.split(',')[0].trim();
      if (current.includes(cityPart)) return;

      await field.click({ delay: randomBetween(60, 160) });
      await field.fill('');
      await field.fill(city.split(',')[0].trim());
      await randomDelay(500, 900);
      await page.keyboard.press('ArrowDown');
      await randomDelay(150, 300);
      await page.keyboard.press('Enter');
      await randomDelay(400, 800);
      return;
    }

    logger.warn({ city }, 'City/location field not found after Show more');
  }

  private async fillListingDetails(page: Page, listing: ListingData): Promise<void> {
    if (!listing.category?.trim()) {
      throw new Error('Category is required for Marketplace listing');
    }
    if (!listing.condition?.trim()) {
      throw new Error('Condition is required for Marketplace listing');
    }
    if (!listing.city?.trim()) {
      throw new Error('City is required for Marketplace listing');
    }

    logger.info(
      {
        title: listing.title,
        city: listing.city,
        category: listing.category,
        condition: listing.condition,
      },
      'Filling listing form (Facebook order)',
    );

    await this.simulateHumanInteraction(page, { scroll: false });
    await waitForListingForm(page);

    await this.fillFieldIfNeeded(
      page,
      [
        page.getByPlaceholder('Title', { exact: true }).first(),
        page.getByLabel(/^Title/i).first(),
        page.locator(SELECTORS.marketplace.titleInput).first(),
      ],
      listing.title,
    );

    await this.fillPriceIfNeeded(page, listing.price ?? 0);
    await randomDelay(400, 800);

    const categoryOk = await selectMarketplaceCategory(page, listing.category);
    if (!categoryOk || !(await isCategorySelected(page, listing.category))) {
      throw new Error(`Could not select category "${listing.category}" on Marketplace`);
    }

    const conditionOk = await selectMarketplaceCondition(page, listing.condition);
    if (!conditionOk || !(await isConditionSelected(page, listing.condition))) {
      throw new Error(`Could not select condition "${listing.condition}" on Marketplace`);
    }

    if (listing.description?.trim()) {
      await this.fillFieldIfNeeded(
        page,
        [
          page.getByLabel(/^Description/i).first(),
          page.locator(SELECTORS.marketplace.descriptionInput).first(),
          page.getByPlaceholder(/description/i).first(),
        ],
        listing.description,
      );
    }

    await this.fillCityInMoreDetails(page, listing.city);
  }

  async fillListingForm(page: Page, listing: ListingData): Promise<void> {
    await this.fillListingDetails(page, listing);
  }

  async clickThroughSteps(page: Page): Promise<void> {
    if (await this.isPublishButtonVisible(page)) return;

    const advanced = await this.clickNextIfVisible(page);
    if (!advanced) return;

    await waitForPageStable(page, { timeoutMs: 8000 }).catch(() => undefined);
    await randomDelay(800, 1500);
  }

  async publishListing(page: Page): Promise<PostingResult> {
    logger.info('Attempting to publish listing');
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)').catch(() => undefined);
    await this.clickThroughSteps(page);
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)').catch(() => undefined);

    const publishCandidates = [
      ...this.getPublishButtonLocators(page),
      page.locator('text=Publish').last(),
      page.locator('[aria-label="Publish"]').last(),
    ];

    for (const publishButton of publishCandidates) {
      if (!(await publishButton.isVisible({ timeout: 8_000 }).catch(() => false))) {
        continue;
      }

      await publishButton.scrollIntoViewIfNeeded().catch(() => undefined);
      await publishButton.click({ timeout: 10_000, delay: randomBetween(80, 180) }).catch(() => undefined);
      await waitForPageStable(page, { timeoutMs: 20_000 }).catch(() => undefined);

      const currentUrl = page.url();
      if (currentUrl.includes('marketplace') && !currentUrl.includes('create')) {
        const listingIdMatch = currentUrl.match(/item\/(\d+)/);
        return {
          success: true,
          listingUrl: currentUrl,
          listingId: listingIdMatch?.[1],
        };
      }

      const stillPublishing = await publishButton.isVisible({ timeout: 2_000 }).catch(() => false);
      if (!stillPublishing && currentUrl.includes('marketplace')) {
        return { success: true, listingUrl: currentUrl };
      }
    }

    const categoryStillEmpty = !(await isCategorySelected(page));
    const conditionStillEmpty = !(await isConditionSelected(page));
    if (categoryStillEmpty) {
      return { success: false, error: 'Category is required — select a category on the post before publishing' };
    }
    if (conditionStillEmpty) {
      return { success: false, error: 'Condition is required — select a condition on the post before publishing' };
    }

    return { success: false, error: 'Could not find or click publish button' };
  }

  async createListing(
    credentials: CredentialsWithAuth,
    listing: ListingData,
    callbacks?: SessionCallbacks,
    sessionOptions?: SessionRunOptions,
  ): Promise<PostingResult> {
    const headless = sessionOptions?.headless ?? env.PLAYWRIGHT_POST_HEADLESS;

    try {
      return await this.withResilientSession(
        credentials,
        async (session) => {
          const allowLogin = sessionOptions?.allowCredentialLogin !== false;

          // Step 1: Open Facebook (load saved session cookies)
          logger.info({ accountId: credentials.accountId }, 'Step 1/5: Open Facebook');
          await this.navigateToFacebook(session.page);
          await this.dismissPostLoginDialogs(session.page);
          await this.simulateHumanInteraction(session.page);

          let health = await this.checkPageHealth(session.page, session.context);

          if (
            !health.isLoggedIn &&
            allowLogin &&
            credentials.password &&
            credentials.email
          ) {
            const loggedIn = await this.loginWithCredentials(
              session.page,
              credentials.email,
              credentials.password,
              credentials.accountId,
            );
            if (loggedIn) {
              health = await this.checkPageHealth(session.page, session.context);
            }
          }

          if (!health.isLoggedIn) {
            return {
              success: false,
              error:
                health.reason ??
                'Facebook session expired. Re-connect the account under Accounts → Connect Facebook.',
            };
          }
          if (health.status === AccountStatus.BANNED || health.status === AccountStatus.FLAGGED) {
            return { success: false, error: `Account ${health.status}: ${health.reason}` };
          }

          // Step 2: Navigate to Marketplace
          logger.info({ accountId: credentials.accountId }, 'Step 2/5: Navigate to Marketplace');
          await this.navigateToMarketplace(session.page);
          await this.dismissPostLoginDialogs(session.page);
          await randomDelay(2000, 4000);

          health = await this.checkMarketplaceAccess(session);
          if (!health.isLoggedIn) {
            return {
              success: false,
              error: health.reason ?? 'Could not access Facebook Marketplace',
            };
          }

          if (callbacks?.onAccountHealth) {
            await callbacks.onAccountHealth(health);
          }

          // Step 3: Create listing (create form ready)
          logger.info({ accountId: credentials.accountId }, 'Step 3/5: Create listing');
          await this.simulateHumanInteraction(session.page);

          // Step 4: Upload images
          logger.info(
            { accountId: credentials.accountId, count: listing.imageUrls.length },
            'Step 4/5: Upload images',
          );
          await this.uploadImages(session.page, listing.imageUrls);
          await this.fillListingForm(session.page, listing);
          await this.simulateHumanInteraction(session.page);

          logger.info({ accountId: credentials.accountId }, 'Step 5/5: Next then Publish');
          await this.clickNextIfVisible(session.page);
          await waitForPageStable(session.page, { timeoutMs: 8000 }).catch(() => undefined);

          const result = await this.publishListing(session.page);

          const cookies = await session.context.cookies();
          if (callbacks?.onCookiesUpdated && cookies.length > 0) {
            await callbacks.onCookiesUpdated(cookies);
          }

          return result;
        },
        { ...sessionOptions, headless },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown posting error';
      logger.error({ error, accountId: credentials.accountId }, 'Posting failed');
      return {
        success: false,
        error: isNetworkError(error)
          ? `Network error: ${message}. Check proxy connectivity or set PLAYWRIGHT_PROXY_FALLBACK=true`
          : message,
      };
    }
  }

  async verifyAccount(
    credentials: CredentialsWithAuth,
    callbacks?: SessionCallbacks,
    sessionOptions?: SessionRunOptions,
  ): Promise<VerifyAccountResult> {
    const usedProxy = !!credentials.proxy;
    let proxyFallback = false;
    let facebookUrl: string | undefined;

    try {
      return await this.withResilientSession(
        credentials,
        async (session) => {
          const health = await this.ensureLoggedIn(session, credentials, callbacks);
          const cookies = await session.context.cookies();
          facebookUrl = session.page.url();

          return {
            success:
              health.isLoggedIn &&
              health.status !== AccountStatus.BANNED &&
              health.status !== AccountStatus.FLAGGED,
            status: health.status,
            isLoggedIn: health.isLoggedIn,
            reason: health.reason,
            cookies,
            diagnostics: {
              facebookReachable: true,
              usedProxy,
              proxyFallback,
              facebookUrl,
            },
          };
        },
        {
          ...sessionOptions,
          onProxyFailure: async () => {
            proxyFallback = true;
            if (sessionOptions?.onProxyFailure) {
              await sessionOptions.onProxyFailure();
            }
          },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      const recommendation =
        'Facebook is blocked or unreachable from this network. Add a working residential proxy (Proxies tab), assign it to the account, then verify again. Or set PLAYWRIGHT_GLOBAL_PROXY in .env.';

      return {
        success: false,
        status: AccountStatus.INACTIVE,
        isLoggedIn: false,
        reason: isNetworkError(error)
          ? `${recommendation} (Technical: ${message.split('\n')[0]})`
          : message,
        diagnostics: {
          facebookReachable: false,
          usedProxy,
          proxyFallback,
          recommendation,
        },
      };
    }
  }

  async scrapeInbox(
    credentials: CredentialsWithAuth,
    callbacks?: SessionCallbacks,
    sessionOptions?: SessionRunOptions,
  ): Promise<InboxScrapeResult> {
    try {
      return await this.withResilientSession(
        credentials,
        async (session) => {
          const health = await this.ensureLoggedIn(session, credentials, callbacks);

          if (!health.isLoggedIn) {
            return { messages: [], accountHealth: health };
          }

          await gotoWithRetry(session.page, MARKETPLACE_INBOX_URL);
          await randomDelay(3000, 6000);
          await this.simulateHumanInteraction(session.page);

          const messages = await this.extractInboxMessages(session.page);
          const cookies = await session.context.cookies();

          if (callbacks?.onCookiesUpdated && cookies.length > 0) {
            await callbacks.onCookiesUpdated(cookies);
          }

          return { messages, accountHealth: health, cookies };
        },
        sessionOptions,
      );
    } catch (error) {
      logger.error({ error, accountId: credentials.accountId }, 'Inbox scrape failed');
      return {
        messages: [],
        accountHealth: {
          status: AccountStatus.INACTIVE,
          isLoggedIn: false,
          reason: error instanceof Error ? error.message : 'Scrape failed',
        },
      };
    }
  }

  async sendInboxReply(
    credentials: CredentialsWithAuth,
    conversationId: string,
    replyText: string,
    callbacks?: SessionCallbacks,
    sessionOptions?: SessionRunOptions,
  ): Promise<boolean> {
    try {
      return await this.withResilientSession(
        credentials,
        async (session) => {
          const health = await this.ensureLoggedIn(session, credentials, callbacks);
          if (!health.isLoggedIn) return false;

          await gotoWithRetry(session.page, `${MARKETPLACE_INBOX_URL}/${conversationId}`);
          await randomDelay(2000, 4000);

          const input = session.page.locator(SELECTORS.inbox.messageInput).first();
          if (!(await input.isVisible({ timeout: 10000 }).catch(() => false))) return false;

          await input.click();
          await simulateTyping(async (char) => {
            await input.pressSequentially(char, { delay: 0 });
          }, replyText);
          await randomDelay(1000, 2000);

          const sendBtn = session.page.locator(SELECTORS.inbox.sendButton).first();
          if (await sendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await sendBtn.click();
            await randomDelay(2000, 4000);
            return true;
          }

          await session.page.keyboard.press('Enter');
          await randomDelay(2000, 4000);
          return true;
        },
        sessionOptions,
      );
    } catch (error) {
      logger.error({ error, conversationId }, 'Failed to send inbox reply');
      return false;
    }
  }

  private async extractInboxMessages(page: Page): Promise<InboxMessage[]> {
    const messages: InboxMessage[] = [];
    const rows = page.locator(SELECTORS.inbox.conversationList);
    const count = Math.min(await rows.count(), 20);

    for (let i = 0; i < count; i++) {
      try {
        const row = rows.nth(i);
        const text = (await row.innerText()).trim();
        if (!text) continue;

        const lines = text.split('\n').filter(Boolean);
        const senderName = lines[0] ?? 'Unknown';
        const content = lines.slice(1).join(' ').trim() || lines[0];
        const href = await row.locator('a').first().getAttribute('href').catch(() => null);
        const conversationId = href?.split('/').pop() ?? `conv-${i}-${Date.now()}`;

        messages.push({
          conversationId,
          senderName,
          content,
          facebookMessageId: `fb-${conversationId}-${i}`,
        });
      } catch {
        continue;
      }
    }

    logger.info({ count: messages.length }, 'Extracted inbox messages');
    return messages;
  }

  async runBasicFacebookInteraction(
    credentials?: Partial<CredentialsWithAuth>,
  ): Promise<void> {
    const creds: CredentialsWithAuth = {
      accountId: credentials?.accountId ?? 'test',
      email: credentials?.email,
      password: credentials?.password,
      cookies: credentials?.cookies,
      userAgent: credentials?.userAgent,
      proxy: credentials?.proxy,
    };

    await this.withResilientSession(creds, async (session) => {
      if (credentials?.email && credentials?.password) {
        await this.ensureLoggedIn(session, creds);
      } else {
        await this.navigateToFacebook(session.page);
      }

      await this.simulateHumanInteraction(session.page);
      logger.info({ title: await session.page.title() }, 'Basic Facebook interaction completed');
    });
  }
}

function randomSteps(): number {
  return Math.floor(Math.random() * 15) + 5;
}

export const playwrightEngine = new PlaywrightEngine();
