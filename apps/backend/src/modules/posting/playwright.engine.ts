import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { AccountStatus } from '@fix-and-flow/types';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { randomDelay, simulateTyping } from '../../utils/human-behavior';
import { downloadImageToTemp, cleanupTempFiles } from '../../utils/network';
import { gotoWithRetry, gotoFacebookWithFallback, isNetworkError, isProxyNetworkError } from '../../utils/playwright-navigation';
import { SELECTORS } from './marketplace.selectors';
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
} from './posting.types';

type CredentialsWithAuth = PostingCredentials & { password?: string; email?: string };

export interface SessionRunOptions {
  onProxyFailure?: () => Promise<void>;
}

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

  async launchBrowser(proxy?: ProxyConfig): Promise<Browser> {
    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-http2',
        '--disable-quic',
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
        headless: this.config.headless,
        proxy: !!proxy,
        channel: env.PLAYWRIGHT_BROWSER_CHANNEL || 'chromium',
      },
      'Launching browser',
    );
    return chromium.launch(launchOptions);
  }

  async createSession(credentials: PostingCredentials): Promise<BrowserSession> {
    const browser = await this.launchBrowser(credentials.proxy);
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
        const cookies = JSON.parse(credentials.cookies);
        if (Array.isArray(cookies) && cookies.length > 0) {
          await context.addCookies(cookies);
          logger.info({ accountId: credentials.accountId, count: cookies.length }, 'Cookies loaded');
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

  async checkPageHealth(page: Page): Promise<AccountHealthResult> {
    const text = await page.locator('body').innerText().catch(() => '');
    return detectAccountHealth(text, page.url());
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

        session = await this.createSession({ ...credentials, proxy: strategy.proxy });
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
  ): Promise<boolean> {
    logger.info({ email }, 'Attempting Facebook login');
    await gotoWithRetry(page, `${FACEBOOK_URL}/login`);
    await randomDelay(2000, 4000);

    const emailInput = page.locator(SELECTORS.login.emailInput).first();
    const passInput = page.locator(SELECTORS.login.passwordInput).first();

    if (!(await emailInput.isVisible({ timeout: 10000 }).catch(() => false))) {
      return false;
    }

    await emailInput.click();
    await simulateTyping(async (char) => {
      await emailInput.pressSequentially(char, { delay: 0 });
    }, email);
    await randomDelay(800, 1500);

    await passInput.click();
    await simulateTyping(async (char) => {
      await passInput.pressSequentially(char, { delay: 0 });
    }, password);
    await randomDelay(1000, 2000);

    const loginButton = page.locator(SELECTORS.login.loginButton).first();
    const canClickLogin = await loginButton.isVisible({ timeout: 4000 }).catch(() => false);

    if (canClickLogin) {
      await loginButton.click();
    } else {
      logger.warn('Login button not found with known selectors; submitting with Enter key');
      await passInput.press('Enter');
    }

    await randomDelay(5000, 8000);

    const health = await this.checkPageHealth(page);
    return health.isLoggedIn;
  }

  async ensureLoggedIn(
    session: BrowserSession,
    credentials: PostingCredentials & { password?: string },
    callbacks?: SessionCallbacks,
  ): Promise<AccountHealthResult> {
    await this.navigateToFacebook(session.page);
    await this.simulateHumanInteraction(session.page);

    let health = await this.checkPageHealth(session.page);

    if (!health.isLoggedIn && credentials.password && credentials.email) {
      const loggedIn = await this.loginWithCredentials(
        session.page,
        credentials.email,
        credentials.password,
      );
      health = await this.checkPageHealth(session.page);
      if (!loggedIn) {
        health = { ...health, isLoggedIn: false, reason: 'Login failed' };
      }
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

  async simulateHumanInteraction(page: Page): Promise<void> {
    const viewport = page.viewportSize();
    if (!viewport) return;

    const x = Math.floor(Math.random() * viewport.width * 0.8) + viewport.width * 0.1;
    const y = Math.floor(Math.random() * viewport.height * 0.8) + viewport.height * 0.1;

    await page.mouse.move(x, y, { steps: randomSteps() });
    await randomDelay(500, 1500);
    await page.evaluate('window.scrollBy(0, Math.random() * 300)');
    await randomDelay(1000, 2000);
  }

  async uploadImages(page: Page, imageUrls: string[]): Promise<void> {
    if (!imageUrls.length) return;

    logger.info({ count: imageUrls.length }, 'Uploading listing images');
    const tempFiles: string[] = [];

    try {
      for (const url of imageUrls.slice(0, 10)) {
        const localPath = await downloadImageToTemp(url);
        tempFiles.push(localPath);
      }

      const fileInput = page.locator(SELECTORS.marketplace.imageUpload).first();
      if (await fileInput.count()) {
        await fileInput.setInputFiles(tempFiles);
        await randomDelay(3000, 6000);
        return;
      }

      const addPhotos = page.locator(SELECTORS.marketplace.addPhotosButton).first();
      if (await addPhotos.isVisible({ timeout: 5000 }).catch(() => false)) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 10000 }),
          addPhotos.click(),
        ]);
        await fileChooser.setFiles(tempFiles);
        await randomDelay(3000, 6000);
      }
    } finally {
      await cleanupTempFiles(tempFiles);
    }
  }

  async fillListingForm(page: Page, listing: ListingData): Promise<void> {
    logger.info({ title: listing.title }, 'Filling listing form');

    const titleInput = page.locator(SELECTORS.marketplace.titleInput).first();
    if (await titleInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await titleInput.click();
      await randomDelay(500, 1000);
      await simulateTyping(async (char) => {
        await titleInput.pressSequentially(char, { delay: 0 });
      }, listing.title);
      await randomDelay(1000, 2000);
    }

    const priceInput = page.locator(SELECTORS.marketplace.priceInput).first();
    if (listing.price != null && (await priceInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      await priceInput.click();
      await randomDelay(500, 1000);
      await priceInput.fill(String(listing.price));
      await randomDelay(1000, 2000);
    }

    const descInput = page.locator(SELECTORS.marketplace.descriptionInput).first();
    if (await descInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await descInput.click();
      await randomDelay(500, 1000);
      await simulateTyping(async (char) => {
        await descInput.pressSequentially(char, { delay: 0 });
      }, listing.description);
      await randomDelay(1000, 2000);
    }

    if (listing.city) {
      const locationInput = page.locator(SELECTORS.marketplace.locationInput).first();
      if (await locationInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await locationInput.click();
        await randomDelay(500, 1000);
        await locationInput.fill(listing.city);
        await randomDelay(1500, 2500);
        await page.keyboard.press('ArrowDown');
        await randomDelay(300, 600);
        await page.keyboard.press('Enter');
        await randomDelay(1000, 2000);
      }
    }
  }

  async clickThroughSteps(page: Page): Promise<void> {
    for (let step = 0; step < 3; step++) {
      const nextBtn = page.locator(SELECTORS.marketplace.nextButton).first();
      if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await randomDelay(1500, 3000);
        await nextBtn.click();
        await randomDelay(2000, 4000);
      } else {
        break;
      }
    }
  }

  async publishListing(page: Page): Promise<PostingResult> {
    logger.info('Attempting to publish listing');
    await this.clickThroughSteps(page);

    const publishButton = page.locator(SELECTORS.marketplace.publishButton).first();
    if (await publishButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await randomDelay(2000, 4000);
      await publishButton.click();
      await randomDelay(5000, 10000);

      const currentUrl = page.url();
      if (currentUrl.includes('marketplace') && !currentUrl.includes('create')) {
        const listingIdMatch = currentUrl.match(/item\/(\d+)/);
        return {
          success: true,
          listingUrl: currentUrl,
          listingId: listingIdMatch?.[1],
        };
      }
    }

    return { success: false, error: 'Could not find or click publish button' };
  }

  async createListing(
    credentials: CredentialsWithAuth,
    listing: ListingData,
    callbacks?: SessionCallbacks,
    sessionOptions?: SessionRunOptions,
  ): Promise<PostingResult> {
    try {
      return await this.withResilientSession(
        credentials,
        async (session) => {
          const health = await this.ensureLoggedIn(session, credentials, callbacks);
          if (!health.isLoggedIn) {
            return { success: false, error: health.reason ?? 'Account not logged in' };
          }
          if (health.status === AccountStatus.BANNED || health.status === AccountStatus.FLAGGED) {
            return { success: false, error: `Account ${health.status}: ${health.reason}` };
          }

          await this.navigateToMarketplace(session.page);
          await this.simulateHumanInteraction(session.page);
          await this.uploadImages(session.page, listing.imageUrls);
          await this.fillListingForm(session.page, listing);
          await this.simulateHumanInteraction(session.page);

          const result = await this.publishListing(session.page);

          const cookies = await session.context.cookies();
          if (callbacks?.onCookiesUpdated && cookies.length > 0) {
            await callbacks.onCookiesUpdated(cookies);
          }

          return result;
        },
        sessionOptions,
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
