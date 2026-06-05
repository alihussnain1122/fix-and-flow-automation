import pino from 'pino';
import { env, isDevelopment } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: env.NODE_ENV,
    service: 'fix-and-flow-backend',
  },
});

export type Logger = typeof logger;
