import path from 'path';
import type { Page } from 'playwright';
import { env } from '../config/env';
import {
  isExecutionContextDestroyedError,
  waitForPageStable,
  withNavigationRetry,
} from '../utils/playwright-page-stable';

interface CaptchaServiceLike {
  solveRecaptchaGrid(page: Page, gridOpts?: { siteKey?: string }): Promise<boolean>;
  solveHCaptcha(options: { siteKey: string; pageUrl: string }): Promise<string>;
  solveArkose(options: { publicKey: string; pageUrl: string; blob?: string }): Promise<string>;
}

function loadCaptchaModule(): {
  getCaptchaService: (opts?: {
    capsolverApiKey?: string;
    twocaptchaApiKey?: string;
  }) => CaptchaServiceLike;
} {
  const candidates = [
    path.resolve(__dirname, '../captcha.js'),
    path.resolve(__dirname, '../captcha.ts'),
    path.resolve(__dirname, '../../../../captcha.ts'),
    path.resolve(process.cwd(), 'captcha.ts'),
    path.resolve(process.cwd(), '../../captcha.ts'),
  ];

  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(candidate);
    } catch {
      continue;
    }
  }

  throw new Error('[captcha] Could not load root captcha.ts — run npm run build -w @fix-and-flow/backend');
}

const captcha = loadCaptchaModule();
const { getCaptchaService } = captcha;

export interface CaptchaDetection {
  present: boolean;
  type: 'recaptcha' | 'hcaptcha' | 'arkose' | 'none';
  siteKey?: string;
}

function siteKeyFromUrl(url: string): string {
  try {
    const match = url.match(/[?&]k=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}

async function detectCaptchaOnce(page: Page): Promise<CaptchaDetection> {
  for (const frame of page.frames()) {
    try {
      const url = frame.url();
      if (
        (url.includes('google.com/recaptcha') || url.includes('recaptcha.net/recaptcha')) &&
        url.includes('/anchor')
      ) {
        const siteKey = siteKeyFromUrl(url);
        return { present: true, type: 'recaptcha', siteKey: siteKey || undefined };
      }
    } catch {
      continue;
    }
  }

  for (const sel of [
    'iframe[title="reCAPTCHA"]',
    'iframe[src*="recaptcha"]',
    'iframe[src*="recaptcha.net"]',
  ]) {
    try {
      const handle = await page.$(sel);
      if (!handle) continue;
      const src = (await handle.getAttribute('src')) ?? '';
      const siteKey = siteKeyFromUrl(src);
      return { present: true, type: 'recaptcha', siteKey: siteKey || undefined };
    } catch (error) {
      if (isExecutionContextDestroyedError(error)) throw error;
      continue;
    }
  }

  try {
    const hcaptcha = await page.$('iframe[src*="hcaptcha.com"]');
    if (hcaptcha) {
      const src = (await hcaptcha.getAttribute('src')) ?? '';
      const match = src.match(/sitekey=([^&]+)/i);
      return { present: true, type: 'hcaptcha', siteKey: match?.[1] };
    }
  } catch (error) {
    if (isExecutionContextDestroyedError(error)) throw error;
  }

  try {
    const arkose = await page.$('iframe[src*="arkoselabs.com"], iframe[src*="funcaptcha"]');
    if (arkose) {
      const src = (await arkose.getAttribute('src')) ?? '';
      const match = src.match(/public_key=([^&]+)/i) ?? src.match(/pk=([^&]+)/i);
      return { present: true, type: 'arkose', siteKey: match?.[1] };
    }
  } catch (error) {
    if (isExecutionContextDestroyedError(error)) throw error;
  }

  return { present: false, type: 'none' };
}

export async function detectCaptcha(page: Page): Promise<CaptchaDetection> {
  return withNavigationRetry(page, () => detectCaptchaOnce(page), {
    maxAttempts: 3,
    label: 'detectCaptcha',
  });
}

/** Poll until reCAPTCHA / hCaptcha iframe appears (Facebook shows it after login submit). */
export async function waitForCaptchaToAppear(
  page: Page,
  timeoutMs = 35_000,
): Promise<CaptchaDetection> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await waitForPageStable(page, { timeoutMs: 4_000 }).catch(() => undefined);

    try {
      const detection = await detectCaptchaOnce(page);
      if (detection.present) return detection;
    } catch (error) {
      if (isExecutionContextDestroyedError(error)) {
        await page.waitForTimeout(1_000);
        continue;
      }
    }

    await page.waitForTimeout(800);
  }

  return { present: false, type: 'none' };
}

/**
 * After login credentials are submitted: wait for "I'm not a robot", then use root captcha.ts
 * (solveRecaptchaGrid → click checkbox → 2captcha grid solve).
 */
export async function solveLoginCaptchaWithCaptchaTs(page: Page): Promise<{
  captchaFound: boolean;
  solved: boolean;
  type?: CaptchaDetection['type'];
}> {
  const detection = await waitForCaptchaToAppear(page);

  if (!detection.present) {
    return { captchaFound: false, solved: true };
  }

  const service = getConfiguredCaptchaService();
  if (!service) {
    return { captchaFound: true, solved: false, type: detection.type };
  }

  await waitForPageStable(page);
  const solved = await resolveCaptchaOnPage(page, service, detection);
  return { captchaFound: true, solved, type: detection.type };
}

export async function resolveCaptchaOnPage(
  page: Page,
  service: CaptchaServiceLike,
  detection?: CaptchaDetection,
): Promise<boolean> {
  await waitForPageStable(page);

  const det = detection ?? (await detectCaptcha(page));
  if (!det.present) return true;

  if (det.type === 'recaptcha') {
    return withNavigationRetry(
      page,
      () => service.solveRecaptchaGrid(page, { siteKey: det.siteKey }),
      { maxAttempts: 2, label: 'solveRecaptchaGrid' },
    );
  }

  if (det.type === 'hcaptcha' && det.siteKey) {
    const token = await service.solveHCaptcha({ siteKey: det.siteKey, pageUrl: page.url() });
    await withNavigationRetry(
      page,
      () =>
        page.evaluate(`(function(token) {
          var fields = document.querySelectorAll('[name="h-captcha-response"], [name="g-recaptcha-response"]');
          for (var i = 0; i < fields.length; i++) { fields[i].value = token; }
        })(${JSON.stringify(token)})`),
      { maxAttempts: 2, stableBefore: false, label: 'injectHcaptchaToken' },
    );
    return !!token;
  }

  if (det.type === 'arkose' && det.siteKey) {
    const token = await service.solveArkose({ publicKey: det.siteKey, pageUrl: page.url() });
    await withNavigationRetry(
      page,
      () =>
        page.evaluate(`(function(token) {
          var el = document.querySelector('[name="fc-token"], #FunCaptcha-Token');
          if (el) el.value = token;
        })(${JSON.stringify(token)})`),
      { maxAttempts: 2, stableBefore: false, label: 'injectArkoseToken' },
    );
    return !!token;
  }

  return false;
}

export function getConfiguredCaptchaService(): CaptchaServiceLike | null {
  if (!env.TWOCAPTCHA_API_KEY && !env.CAPSOLVER_API_KEY) return null;
  return getCaptchaService({
    twocaptchaApiKey: env.TWOCAPTCHA_API_KEY,
    capsolverApiKey: env.CAPSOLVER_API_KEY,
  });
}
