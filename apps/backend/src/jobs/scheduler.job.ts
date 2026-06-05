import { logger } from '../config/logger';
import { schedulerService } from '../modules/scheduler/scheduler.service';

export async function processSchedulerTick(): Promise<void> {
  logger.info('Running scheduler tick');

  const processed = await schedulerService.processDueSchedules();

  logger.info({ processed }, 'Scheduler tick completed');
}
