import { query } from '../config/database';
import { logger } from '../config/logger';

export async function processDailyReset(): Promise<void> {
  logger.info('Running daily reset job');

  await query('SELECT reset_daily_post_counts()');

  logger.info('Daily post counts reset for all accounts');
}
