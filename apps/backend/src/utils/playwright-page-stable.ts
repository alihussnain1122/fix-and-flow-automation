import type { Page } from 'playwright';
import { logger } from '../config/logger';

export function isExecutionContextDestroyedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Execution context was destroyed') ||
    message.includes('Target closed') ||
    message.includes('frame was detached') ||
    message.includes('Navigating frame was detached') ||
    message.includes('Protocol error')
  );
}

/** Wait until Facebook finishes redirecting before querying DOM or captcha iframes. */
export async function waitForPageStable(
  page: Page,
  options?: { timeoutMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 15_000;

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs });
  } catch {
    /* navigation may still be starting */
  }

  try {
    await page.waitForLoadState('load', { timeout: Math.min(timeoutMs, 10_000) });
  } catch {
    /* Facebook often keeps long-polling */
  }

  try {
    await page.waitForLoadState('networkidle', { timeout: 4_000 });
  } catch {
    /* optional — skip if the page never idles */
  }

  await page.waitForTimeout(600);
}

export async function withNavigationRetry<T>(
  page: Page,
  operation: () => Promise<T>,
  options?: { maxAttempts?: number; stableBefore?: boolean; label?: string },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options?.stableBefore !== false) {
      await waitForPageStable(page, { timeoutMs: 12_000 });
    }

    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isExecutionContextDestroyedError(error) || attempt === maxAttempts) {
        throw error;
      }

      logger.debug(
        { attempt, maxAttempts, label: options?.label ?? 'page-operation' },
        'Page navigated during operation — retrying after load',
      );
    }
  }

  throw lastError;
}

/** Best-effort wait for post-login redirect (captcha, checkpoint, or home). */
export async function waitForPostSubmitNavigation(page: Page): Promise<void> {
  const startUrl = page.url();

  await Promise.race([
    page
      .waitForURL((url) => url.href !== startUrl, { timeout: 15_000 })
      .catch(() => undefined),
    page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined),
    page.waitForTimeout(8_000),
  ]);

  await waitForPageStable(page);
}
