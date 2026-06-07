import path from 'path';
import type { Frame, Page } from 'playwright';
import { env } from '../config/env';
import { captchaLogger, hookCaptchaModuleConsole } from '../config/captcha.logger';
import { randomDelay } from '../utils/human-behavior';
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
  hookCaptchaModuleConsole();

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
      const mod = require(candidate);
      captchaLogger.info({ modulePath: candidate }, 'Loaded root captcha.ts');
      return mod;
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

export interface CaptchaLoopResult {
  rounds: number;
  allSolved: boolean;
  captchaMode: 'manual' | 'auto';
  lastError?: string;
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

const RECAPTCHA_CHECKBOX_SELECTORS = [
  '#recaptcha-anchor',
  'span.recaptcha-checkbox-unchecked',
  '.rc-anchor-checkbox[role="checkbox"]',
  '[role="checkbox"].recaptcha-checkbox',
  '.rc-anchor-checkbox',
];

const RECAPTCHA_IFRAME_SELECTORS = [
  'iframe[title="reCAPTCHA"]',
  'iframe[src*="recaptcha"][src*="anchor"]',
  'iframe[src*="recaptcha.net"][src*="anchor"]',
];

async function clickCheckboxInsideFrame(frame: Frame, via: string): Promise<boolean> {
  for (const selector of RECAPTCHA_CHECKBOX_SELECTORS) {
    try {
      const locator = frame.locator(selector).first();
      if ((await locator.count()) === 0) continue;
      await locator.waitFor({ state: 'visible', timeout: 6_000 });
      await locator.click({ delay: 120, timeout: 8_000 });
      captchaLogger.info({ via, selector }, "Clicked I'm not a robot checkbox");
      return true;
    } catch {
      continue;
    }
  }

  try {
    const clicked = await frame.evaluate(`(function() {
      var cb = document.querySelector('#recaptcha-anchor') ||
               document.querySelector('span.recaptcha-checkbox-unchecked') ||
               document.querySelector('.rc-anchor-checkbox[role="checkbox"]');
      if (cb) { cb.click(); return true; }
      return false;
    })()`);
    if (clicked) {
      captchaLogger.info({ via, method: 'evaluate' }, "Clicked I'm not a robot checkbox");
      return true;
    }
  } catch {
    /* frame detached */
  }

  return false;
}

/**
 * Explicit Playwright click on reCAPTCHA "I'm not a robot" before captcha.ts grid solve.
 * Does not modify root captcha.ts.
 */
export async function clickRecaptchaCheckbox(page: Page, siteKey?: string): Promise<boolean> {
  captchaLogger.info(
    { siteKey: siteKey?.slice(0, 8), url: page.url() },
    "Step 1: clicking I'm not a robot checkbox",
  );

  await waitForPageStable(page, { timeoutMs: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(800);

  try {
    const secHandle = await page.$('iframe[title="Security verification"]');
    if (secHandle) {
      const secFrame = await secHandle.contentFrame();
      if (secFrame) {
        for (const h of await secFrame.$$('iframe[title="reCAPTCHA"]')) {
          const anchor = await h.contentFrame();
          if (anchor && (await clickCheckboxInsideFrame(anchor, 'security-iframe'))) {
            await page.waitForTimeout(2_000);
            return true;
          }
        }
      }
    }
  } catch (error) {
    captchaLogger.debug({ error: String(error) }, 'Security iframe checkbox path failed');
  }

  for (const iframeSel of RECAPTCHA_IFRAME_SELECTORS) {
    try {
      await page.waitForSelector(iframeSel, { state: 'attached', timeout: 10_000 }).catch(() => {});
      const handles = await page.$$(iframeSel);
      for (const handle of handles) {
        const src = (await handle.getAttribute('src')) ?? '';
        if (siteKey && src && !src.includes(siteKey) && siteKeyFromUrl(src) !== siteKey) {
          continue;
        }
        const anchor = await handle.contentFrame();
        if (anchor && (await clickCheckboxInsideFrame(anchor, iframeSel))) {
          await page.waitForTimeout(2_000);
          return true;
        }
      }
      if (!siteKey) {
        for (const handle of handles) {
          const anchor = await handle.contentFrame();
          if (anchor && (await clickCheckboxInsideFrame(anchor, `${iframeSel}-fallback`))) {
            await page.waitForTimeout(2_000);
            return true;
          }
        }
      }
    } catch (error) {
      captchaLogger.debug({ iframeSel, error: String(error) }, 'Iframe checkbox path failed');
    }
  }

  for (const frame of page.frames()) {
    const frameUrl = frame.url();
    if (
      !(frameUrl.includes('google.com/recaptcha') || frameUrl.includes('recaptcha.net/recaptcha')) ||
      !frameUrl.includes('/anchor')
    ) {
      continue;
    }
    if (siteKey && !frameUrl.includes(siteKey) && siteKeyFromUrl(frameUrl) !== siteKey) {
      continue;
    }
    if (await clickCheckboxInsideFrame(frame, 'page.frames')) {
      await page.waitForTimeout(2_000);
      return true;
    }
  }

  if (siteKey) {
    for (const frame of page.frames()) {
      const frameUrl = frame.url();
      if (!frameUrl.includes('recaptcha') || !frameUrl.includes('/anchor')) continue;
      if (await clickCheckboxInsideFrame(frame, 'page.frames-any-key')) {
        await page.waitForTimeout(2_000);
        return true;
      }
    }
  }

  try {
    const iframe = page.locator('iframe[title="reCAPTCHA"]').first();
    if (await iframe.isVisible({ timeout: 4_000 }).catch(() => false)) {
      const box = await iframe.boundingBox();
      if (box) {
        const x = box.x + Math.min(28, box.width * 0.15);
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.waitForTimeout(200);
        await page.mouse.click(x, y);
        captchaLogger.info({ x, y }, "Clicked reCAPTCHA widget area (I'm not a robot fallback)");
        await page.waitForTimeout(2_000);
        return true;
      }
    }
  } catch (error) {
    captchaLogger.debug({ error: String(error) }, 'Iframe bounding-box click failed');
  }

  captchaLogger.warn("Could not click I'm not a robot checkbox — grid may not appear");
  return false;
}

export async function resolveCaptchaOnPage(
  page: Page,
  service: CaptchaServiceLike,
  detection?: CaptchaDetection,
): Promise<boolean> {
  await waitForPageStable(page);

  const det = detection ?? (await detectCaptcha(page));
  if (!det.present) return true;

  captchaLogger.info(
    { type: det.type, siteKey: det.siteKey?.slice(0, 8), url: page.url() },
    'Calling captcha.ts solver',
  );

  if (det.type === 'recaptcha') {
    await withNavigationRetry(
      page,
      async () => {
        const clicked = await clickRecaptchaCheckbox(page, det.siteKey);
        captchaLogger.info({ clicked }, 'Checkbox click step completed — waiting for challenge');
        await page.waitForTimeout(2_500);
        return clicked;
      },
      { maxAttempts: 2, label: 'clickRecaptchaCheckbox' },
    ).catch(() => {
      captchaLogger.warn('Checkbox click retries exhausted — continuing to captcha.ts');
    });

    captchaLogger.info({ siteKey: det.siteKey?.slice(0, 8) }, 'Step 2: captcha.ts grid solve via 2captcha');
    const solved = await withNavigationRetry(
      page,
      () => service.solveRecaptchaGrid(page, { siteKey: det.siteKey }),
      { maxAttempts: 2, label: 'solveRecaptchaGrid' },
    );
    captchaLogger.info({ solved, type: 'recaptcha' }, 'captcha.ts solveRecaptchaGrid finished');
    return solved;
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
    captchaLogger.info({ hasToken: !!token }, 'hCaptcha token injected');
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
    captchaLogger.info({ hasToken: !!token }, 'Arkose token injected');
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

/** Auto when API key is set unless PLAYWRIGHT_CAPTCHA_MODE=manual */
export function getCaptchaMode(): 'manual' | 'auto' {
  if (env.PLAYWRIGHT_CAPTCHA_MODE === 'manual') return 'manual';
  if (getConfiguredCaptchaService()) return 'auto';
  return 'manual';
}

export async function waitForManualCaptchaCompletion(
  page: Page,
  options: {
    timeoutMs: number;
    isDone: () => Promise<boolean>;
    captchaAlreadyVisible?: boolean;
    accountId?: string;
    round?: number;
  },
): Promise<{ completed: boolean; captchaSeen: boolean }> {
  let captchaSeen = !!options.captchaAlreadyVisible;

  if (!captchaSeen) {
    const detection = await waitForCaptchaToAppear(page, 12_000);
    if (!detection.present) {
      if (await options.isDone()) {
        return { completed: true, captchaSeen: false };
      }
      return { completed: false, captchaSeen: false };
    }
    captchaSeen = true;
  }

  captchaLogger.info(
    { mode: 'manual', accountId: options.accountId, round: options.round, url: page.url() },
    'Waiting for you to solve captcha in the browser',
  );

  const deadline = Date.now() + options.timeoutMs;

  while (Date.now() < deadline) {
    if (await options.isDone()) {
      captchaLogger.info({ round: options.round }, 'Manual captcha — logged in');
      return { completed: true, captchaSeen };
    }

    await waitForPageStable(page, { timeoutMs: 3_000 }).catch(() => undefined);

    try {
      const stillThere = await detectCaptchaOnce(page);
      if (!stillThere.present) {
        await page.waitForTimeout(1_500);
        if (await options.isDone()) {
          return { completed: true, captchaSeen };
        }
        captchaLogger.info({ round: options.round }, 'Manual captcha — iframe gone, continuing');
        return { completed: true, captchaSeen };
      }
    } catch (error) {
      if (isExecutionContextDestroyedError(error)) {
        await page.waitForTimeout(1_000);
        continue;
      }
    }

    await page.waitForTimeout(2_000);
  }

  captchaLogger.warn({ round: options.round, accountId: options.accountId }, 'Manual captcha timed out');
  return { completed: false, captchaSeen };
}

export async function handleLoginCaptchaStep(
  page: Page,
  options: {
    timeoutMs: number;
    isLoggedIn: () => Promise<boolean>;
    accountId?: string;
    round?: number;
  },
): Promise<{
  captchaFound: boolean;
  solved: boolean;
  manual: boolean;
  type?: CaptchaDetection['type'];
}> {
  const mode = getCaptchaMode();
  const detection = await waitForCaptchaToAppear(page, 12_000);

  if (!detection.present) {
    return { captchaFound: false, solved: true, manual: mode === 'manual' };
  }

  captchaLogger.info(
    {
      mode,
      round: options.round,
      accountId: options.accountId,
      type: detection.type,
      siteKey: detection.siteKey?.slice(0, 8),
      url: page.url(),
    },
    'Captcha detected',
  );

  if (mode === 'manual') {
    const result = await waitForManualCaptchaCompletion(page, {
      timeoutMs: options.timeoutMs,
      isDone: options.isLoggedIn,
      captchaAlreadyVisible: true,
      accountId: options.accountId,
      round: options.round,
    });
    return {
      captchaFound: true,
      solved: result.completed,
      manual: true,
      type: detection.type,
    };
  }

  const service = getConfiguredCaptchaService();
  if (!service) {
    captchaLogger.warn('auto mode requested but no API key — falling back to manual');
    const result = await waitForManualCaptchaCompletion(page, {
      timeoutMs: options.timeoutMs,
      isDone: options.isLoggedIn,
      captchaAlreadyVisible: true,
      accountId: options.accountId,
      round: options.round,
    });
    return {
      captchaFound: true,
      solved: result.completed,
      manual: true,
      type: detection.type,
    };
  }

  await waitForPageStable(page);
  const solved = await resolveCaptchaOnPage(page, service, detection);
  captchaLogger.info({ round: options.round, solved, mode: 'auto' }, 'Captcha round result');
  return { captchaFound: true, solved, manual: false, type: detection.type };
}

/**
 * Facebook may show multiple captchas in a row — solve each via captcha.ts (auto) or wait (manual).
 */
export async function resolveAllLoginCaptchas(
  page: Page,
  options: {
    timeoutMs: number;
    maxRounds: number;
    isLoggedIn: () => Promise<boolean>;
    accountId?: string;
    resubmitLogin?: () => Promise<void>;
  },
): Promise<CaptchaLoopResult> {
  const mode = getCaptchaMode();
  const deadline = Date.now() + options.timeoutMs;
  let rounds = 0;
  let lastError: string | undefined;

  captchaLogger.info(
    {
      mode,
      accountId: options.accountId,
      maxRounds: options.maxRounds,
      timeoutMs: options.timeoutMs,
      hasApiKey: !!getConfiguredCaptchaService(),
    },
    '=== Login captcha loop started ===',
  );

  while (rounds < options.maxRounds && Date.now() < deadline) {
    if (await options.isLoggedIn()) {
      captchaLogger.info({ rounds }, 'Logged in — captcha loop complete');
      return { rounds, allSolved: true, captchaMode: mode };
    }

    const remaining = deadline - Date.now();
    let detection = await waitForCaptchaToAppear(page, Math.min(15_000, remaining));

    if (!detection.present) {
      const iframeVisible = await page
        .locator('iframe[title="reCAPTCHA"]')
        .first()
        .isVisible({ timeout: 2_000 })
        .catch(() => false);
      if (iframeVisible) {
        captchaLogger.info('reCAPTCHA iframe visible — clicking checkbox first');
        await clickRecaptchaCheckbox(page);
        await page.waitForTimeout(2_000);
        detection = await detectCaptchaOnce(page).catch(() => ({
          present: false,
          type: 'none' as const,
        }));
      }
    }

    if (!detection.present) {
      const clearMs = env.PLAYWRIGHT_CAPTCHA_CLEAR_MS;
      captchaLogger.info({ clearMs, rounds }, 'No captcha — waiting to confirm no new challenge appears');

      const clearDeadline = Date.now() + clearMs;
      let recheckFound: CaptchaDetection | null = null;

      while (Date.now() < clearDeadline) {
        await page.waitForTimeout(600);
        const recheck = await detectCaptchaOnce(page).catch(() => ({
          present: false,
          type: 'none' as const,
        }));
        const iframeVisible = await page
          .locator('iframe[title="reCAPTCHA"]')
          .first()
          .isVisible({ timeout: 500 })
          .catch(() => false);

        if (recheck.present || iframeVisible) {
          recheckFound = recheck.present ? recheck : { present: true, type: 'recaptcha' as const };
          captchaLogger.info({ rounds: rounds + 1 }, 'Another captcha appeared after previous solve');
          break;
        }
      }

      if (!recheckFound) {
        captchaLogger.info({ rounds }, 'Captcha chain finished — no new challenges');
        return { rounds, allSolved: true, captchaMode: mode };
      }

      detection = recheckFound;
      if (!detection.present && (await page.locator('iframe[title="reCAPTCHA"]').first().isVisible().catch(() => false))) {
        detection = { present: true, type: 'recaptcha' };
      }
    }

    rounds++;
    const roundTimeout = Math.min(120_000, remaining);

    captchaLogger.info(
      { round: rounds, type: detection.type, url: page.url() },
      '--- Captcha round ---',
    );

    try {
      const step = await handleLoginCaptchaStep(page, {
        timeoutMs: roundTimeout,
        isLoggedIn: options.isLoggedIn,
        accountId: options.accountId,
        round: rounds,
      });

      if (!step.solved) {
        lastError = step.manual
          ? 'Manual captcha not completed in time'
          : 'captcha.ts / 2captcha failed to solve';
        captchaLogger.error({ round: rounds, lastError, type: step.type }, 'Captcha round failed');
        return { rounds, allSolved: false, captchaMode: mode, lastError };
      }

      captchaLogger.info({ round: rounds, manual: step.manual }, 'Captcha round succeeded');

      if (await options.isLoggedIn()) {
        return { rounds, allSolved: true, captchaMode: mode };
      }

      await waitForPageStable(page);
      await randomDelay(2500, 5500);

      if (page.url().includes('/login') && options.resubmitLogin) {
        captchaLogger.info({ round: rounds }, 'Re-submitting login after captcha');
        await options.resubmitLogin();
        await waitForPageStable(page);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      captchaLogger.error({ round: rounds, error: lastError }, 'Captcha round threw');
      if (isExecutionContextDestroyedError(error)) {
        await page.waitForTimeout(2_000);
        continue;
      }
      return { rounds, allSolved: false, captchaMode: mode, lastError };
    }
  }

  if (rounds >= options.maxRounds) {
    lastError = `Exceeded max captcha rounds (${options.maxRounds})`;
    captchaLogger.warn({ rounds, maxRounds: options.maxRounds }, lastError);
  } else {
    lastError = 'Captcha loop timed out';
    captchaLogger.warn({ rounds }, lastError);
  }

  return { rounds, allSolved: false, captchaMode: mode, lastError };
}
