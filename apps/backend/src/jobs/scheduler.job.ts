import { logger } from '../config/logger';
import { schedulerService } from '../modules/scheduler/scheduler.service';
import { postingService } from '../modules/posting/posting.service';

export async function processSchedulerTick(): Promise<void> {
  const schedulesProcessed = await schedulerService.processDueSchedules();
  const automationProcessed = await postingService.processAutomationQueue();
  const processed = schedulesProcessed + automationProcessed;

  if (processed > 0) {
    logger.info(
      { schedulesProcessed, automationProcessed, processed },
      'Scheduler tick completed',
    );
  } else {
    logger.debug('Scheduler tick completed (nothing due)');
  }
}
