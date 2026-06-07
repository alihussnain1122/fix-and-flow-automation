import { chromium as baseChromium, type Browser } from 'playwright';
import { env } from '../config/env';
import { logger } from '../config/logger';

type LaunchOptions = Parameters<typeof baseChromium.launch>[0];

let stealthChromium: typeof baseChromium | null = null;

function getStealthChromium(): typeof baseChromium {
  if (stealthChromium) return stealthChromium;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium: extraChromium } = require('playwright-extra') as {
    chromium: typeof baseChromium & { use: (plugin: unknown) => void };
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');

  extraChromium.use(StealthPlugin());
  stealthChromium = extraChromium;
  logger.info('Playwright stealth plugin enabled (puppeteer-extra-plugin-stealth)');
  return extraChromium;
}

/** Launch Chrome/Chromium with optional stealth anti-detection plugin. */
export async function launchStealthBrowser(options: LaunchOptions): Promise<Browser> {
  const launcher = env.PLAYWRIGHT_USE_STEALTH ? getStealthChromium() : baseChromium;
  return launcher.launch(options);
}
