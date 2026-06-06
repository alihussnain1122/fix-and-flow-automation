import { Page } from 'playwright';
import { logger } from '../config/logger';
import { env } from '../config/env';

const NETWORK_ERROR_PATTERNS = [
  'ERR_CONNECTION_RESET',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_CLOSED',
  'ERR_PROXY_CONNECTION_FAILED',
  'ERR_TUNNEL_CONNECTION_FAILED',
  'ERR_NETWORK_CHANGED',
  'ERR_INTERNET_DISCONNECTED',
  'ERR_NAME_NOT_RESOLVED',
  'ETIMEDOUT',
  'ECONNRESET',
  'net::ERR',
];

/** Facebook entry points — tried in order when one is blocked */
export const FACEBOOK_ENTRY_URLS = [
  'https://www.facebook.com',
  'https://m.facebook.com',
  'https://mbasic.facebook.com',
] as const;

export function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function isProxyNetworkError(error: unknown): boolean {
  return isNetworkError(error);
}

export async function gotoWithRetry(
  page: Page,
  url: string,
  options?: {
    waitUntil?: 'domcontentloaded' | 'load' | 'commit';
    retries?: number;
  },
): Promise<void> {
  const maxRetries = options?.retries ?? env.PLAYWRIGHT_NAV_RETRIES;
  const waitUntil = options?.waitUntil ?? 'domcontentloaded';
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, { waitUntil, timeout: env.PLAYWRIGHT_NAV_TIMEOUT });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        { url, attempt, maxRetries, error: lastError.message.split('\n')[0] },
        'Navigation attempt failed',
      );

      if (attempt < maxRetries && isNetworkError(lastError)) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error(`Failed to navigate to ${url}`);
}

/** Try multiple Facebook URLs — use when www.facebook.com is blocked locally */
export async function gotoFacebookWithFallback(page: Page): Promise<string> {
  let lastError: Error | undefined;

  for (const url of FACEBOOK_ENTRY_URLS) {
    try {
      await gotoWithRetry(page, url, { retries: 2, waitUntil: 'commit' });
      logger.info({ url }, 'Facebook reachable via URL');
      return url;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn({ url, error: lastError.message.split('\n')[0] }, 'Facebook URL failed, trying next');
    }
  }

  throw lastError ?? new Error('All Facebook entry URLs are unreachable from this network');
}
