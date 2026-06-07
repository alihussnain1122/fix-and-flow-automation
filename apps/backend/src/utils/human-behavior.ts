import { MIN_POST_DELAY_MS, MAX_POST_DELAY_MS } from '@fix-and-flow/shared';

export function randomDelay(minMs = MIN_POST_DELAY_MS, maxMs = MAX_POST_DELAY_MS): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export function randomTypingDelay(): number {
  return Math.floor(Math.random() * 150) + 50;
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export async function simulateTyping(
  typeFn: (char: string) => Promise<void>,
  text: string,
): Promise<void> {
  for (const char of text) {
    await typeFn(char);
    await new Promise((resolve) => setTimeout(resolve, randomTypingDelay()));
    if (Math.random() < 0.1) {
      await randomDelay(120, 380);
    }
  }
}

/** Human-like credential entry: click field, then keyboard.type (not fill). */
export async function humanTypeInput(
  page: import('playwright').Page,
  locator: import('playwright').Locator,
  text: string,
): Promise<void> {
  await randomDelay(500, 1400);
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await locator.click({ delay: randomBetween(60, 180) });
  await randomDelay(350, 900);

  for (const char of text) {
    await page.keyboard.type(char, { delay: randomTypingDelay() });
    if (Math.random() < 0.12) {
      await randomDelay(180, 520);
    }
  }

  await randomDelay(600, 1600);
}
