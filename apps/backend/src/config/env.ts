import { config } from 'dotenv';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('/api/v1'),

  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string().default('fixandflow'),
  POSTGRES_PASSWORD: z.string().default('fixandflow_secret'),
  POSTGRES_DB: z.string().default('fixandflow'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  ENCRYPTION_KEY: z.string().min(16),

  QUEUE_PREFIX: z.string().default('fix-and-flow'),

  PLAYWRIGHT_HEADLESS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  PLAYWRIGHT_SLOW_MO: z.coerce.number().default(0),
  PLAYWRIGHT_NAV_RETRIES: z.coerce.number().default(3),
  PLAYWRIGHT_NAV_TIMEOUT: z.coerce.number().default(60000),
  PLAYWRIGHT_PROXY_FALLBACK: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  PLAYWRIGHT_BROWSER_CHANNEL: z.enum(['chrome', 'msedge', '']).default(''),
  PLAYWRIGHT_GLOBAL_PROXY: z.string().optional(),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
