import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { getRedis, disconnectRedis } from './config/redis';
import { closeQueues } from './config/queue';
import { initializeWorkers } from './jobs';

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
    getRedis();
    await initializeWorkers();

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, env: env.NODE_ENV, apiPrefix: env.API_PREFIX },
        'Fix & Flow backend started',
      );
    });

    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down gracefully...');

      server.close(async () => {
        await closeQueues();
        await disconnectRedis();
        await disconnectDatabase();
        logger.info('Server shut down complete');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    const details = error instanceof Error ? { message: error.message, stack: error.stack } : { error };
    logger.fatal(details, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
