import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { randomDelay, simulateTyping } from '../../utils/human-behavior';
import {
  BrowserSession,
  ProxyConfig,
  PostingCredentials,
  ListingData,
  PostingResult,
  PlaywrightConfig,
} from './posting.types';

const FACEBOOK_URL = 'https://www.facebook.com';
const MARKETPLACE_URL = 'https://www.facebook.com/marketplace/create/item';

export class PlaywrightEngine {
  private config: PlaywrightConfig;

  constructor(config?: Partial<PlaywrightConfig>) {
    this.config = {
      headless: config?.headless ?? env.PLAYWRIGHT_HEADLESS,
      slowMo: config?.slowMo ?? env.PLAYWRIGHT_SLOW_MO,
      timeout: config?.timeout ?? 60000,
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
      ],
    };

    if (proxy) {
      launchOptions.proxy = {
        server: proxy.server,
        username: proxy.username,
        password: proxy.password,
      };
    }

    logger.info({ headless: this.config.headless, proxy: !!proxy }, 'Launching browser');
    return chromium.launch(launchOptions);
  }

  async createSession(credentials: PostingCredentials): Promise<BrowserSession> {
    const browser = await this.launchBrowser(credentials.proxy);
    const contextOptions: Parameters<Browser['newContext']>[0] = {
      userAgent: credentials.userAgent,
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    };

    const context = await browser.newContext(contextOptions);

    if (credentials.cookies) {
      try {
        const cookies = JSON.parse(credentials.cookies);
        await context.addCookies(cookies);
        logger.info({ accountId: credentials.accountId }, 'Cookies loaded for session');
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

  async navigateToFacebook(page: Page): Promise<void> {
    logger.info('Navigating to Facebook');
    await page.goto(FACEBOOK_URL, { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 5000);
  }

  async navigateToMarketplace(page: Page): Promise<void> {
    logger.info('Navigating to Marketplace create listing');
    await page.goto(MARKETPLACE_URL, { waitUntil: 'domcontentloaded' });
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

  async fillListingForm(page: Page, listing: ListingData): Promise<void> {
    logger.info({ title: listing.title }, 'Filling listing form');

    const titleSelector = 'input[aria-label*="Title"], input[placeholder*="Title"]';
    const titleInput = page.locator(titleSelector).first();

    if (await titleInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await titleInput.click();
      await randomDelay(500, 1000);
      await simulateTyping(async (char) => {
        await titleInput.pressSequentially(char, { delay: 0 });
      }, listing.title);
      await randomDelay(1000, 2000);
    }

    const priceSelector = 'input[aria-label*="Price"], input[placeholder*="Price"]';
    const priceInput = page.locator(priceSelector).first();

    if (listing.price && (await priceInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      await priceInput.click();
      await randomDelay(500, 1000);
      await priceInput.fill(String(listing.price));
      await randomDelay(1000, 2000);
    }

    const descSelector = 'textarea[aria-label*="Description"], textarea[placeholder*="Description"]';
    const descInput = page.locator(descSelector).first();

    if (await descInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await descInput.click();
      await randomDelay(500, 1000);
      await simulateTyping(async (char) => {
        await descInput.pressSequentially(char, { delay: 0 });
      }, listing.description);
      await randomDelay(1000, 2000);
    }
  }

  async publishListing(page: Page): Promise<PostingResult> {
    logger.info('Attempting to publish listing');

    const publishButton = page.locator(
      'div[aria-label="Publish"], div[aria-label="Next"], button:has-text("Publish"), button:has-text("Next")',
    ).first();

    if (await publishButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await randomDelay(2000, 4000);
      await publishButton.click();
      await randomDelay(5000, 10000);

      const currentUrl = page.url();
      if (currentUrl.includes('marketplace') && !currentUrl.includes('create')) {
        return {
          success: true,
          listingUrl: currentUrl,
        };
      }
    }

    return {
      success: false,
      error: 'Could not find or click publish button',
    };
  }

  async createListing(
    credentials: PostingCredentials,
    listing: ListingData,
  ): Promise<PostingResult> {
    let session: BrowserSession | null = null;

    try {
      session = await this.createSession(credentials);

      await this.navigateToFacebook(session.page);
      await this.simulateHumanInteraction(session.page);
      await this.navigateToMarketplace(session.page);
      await this.simulateHumanInteraction(session.page);
      await this.fillListingForm(session.page, listing);

      const result = await this.publishListing(session.page);

      if (session.context) {
        const cookies = await session.context.cookies();
        result.listingId = credentials.accountId;
        logger.info({ cookiesCount: cookies.length }, 'Session cookies captured');
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown posting error';
      logger.error({ error, accountId: credentials.accountId }, 'Posting failed');
      return { success: false, error: message };
    } finally {
      if (session) {
        await this.closeSession(session);
      }
    }
  }

  async runBasicFacebookInteraction(credentials?: Partial<PostingCredentials>): Promise<void> {
    let session: BrowserSession | null = null;

    try {
      session = await this.createSession({
        accountId: credentials?.accountId ?? 'test',
        cookies: credentials?.cookies,
        userAgent: credentials?.userAgent,
        proxy: credentials?.proxy,
      });

      await this.navigateToFacebook(session.page);
      await this.simulateHumanInteraction(session.page);

      const title = await session.page.title();
      logger.info({ title }, 'Basic Facebook interaction completed');
    } finally {
      if (session) {
        await this.closeSession(session);
      }
    }
  }
}

function randomSteps(): number {
  return Math.floor(Math.random() * 15) + 5;
}

export const playwrightEngine = new PlaywrightEngine();
