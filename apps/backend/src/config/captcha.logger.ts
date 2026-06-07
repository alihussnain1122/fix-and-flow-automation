import fs from 'fs';
import path from 'path';
import pino from 'pino';
import { env } from './env';

function resolveCaptchaLogPath(): string {
  const configured = env.CAPTCHA_LOG_PATH;
  if (path.isAbsolute(configured)) return configured;
  return path.resolve(process.cwd(), configured);
}

const logPath = resolveCaptchaLogPath();
const logDir = path.dirname(logPath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/** Dedicated captcha log — see CAPTCHA_LOG_PATH in .env (default: logs/captcha.log) */
export const captchaLogger = pino(
  {
    level: 'debug',
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { service: 'fix-and-flow-captcha' },
  },
  pino.destination({ dest: logPath, sync: false, mkdir: true }),
);

export function getCaptchaLogPath(): string {
  return logPath;
}

/** Mirror captcha.ts console output into captcha.log without editing captcha.ts */
export function hookCaptchaModuleConsole(): void {
  if ((globalThis as { __captchaConsoleHooked?: boolean }).__captchaConsoleHooked) return;
  (globalThis as { __captchaConsoleHooked?: boolean }).__captchaConsoleHooked = true;

  const format = (args: unknown[]) =>
    args
      .map((a) => (typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');

  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    captchaLogger.info({ source: 'captcha.ts' }, format(args));
    origLog(...args);
  };
  console.warn = (...args: unknown[]) => {
    captchaLogger.warn({ source: 'captcha.ts' }, format(args));
    origWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    captchaLogger.error({ source: 'captcha.ts' }, format(args));
    origError(...args);
  };
}
