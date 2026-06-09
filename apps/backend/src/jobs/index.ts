import { Job } from 'bullmq';
import { registerWorker, getSchedulerQueue } from '../config/queue';
import { QUEUE_NAMES } from '@fix-and-flow/shared';
import {
  CreatePostJobData,
  CheckInboxJobData,
  VerifyAccountJobData,
  RotateProxyJobData,
} from '@fix-and-flow/types';
import { processCreatePostJob } from './create-post.job';
import { processCheckInboxJob } from './check-inbox.job';
import { processSchedulerTick } from './scheduler.job';
import { processDailyReset } from './daily-reset.job';
import { processVerifyAccountJob } from './verify-account.job';
import { processRotateProxyJob } from './rotate-proxy.job';
import { logger } from '../config/logger';

export async function initializeWorkers(): Promise<void> {
  registerWorker(
    QUEUE_NAMES.POSTING,
    async (job: Job) => {
      switch (job.name) {
        case 'create-post-job':
          await processCreatePostJob(job as Job<CreatePostJobData>);
          break;
        case 'verify-account-job':
          await processVerifyAccountJob(job as Job<VerifyAccountJobData>);
          break;
        default:
          logger.warn({ jobName: job.name }, 'Unknown posting job');
      }
    },
    3,
  );

  registerWorker(
    QUEUE_NAMES.INBOX,
    async (job: Job) => {
      switch (job.name) {
        case 'check-inbox-job':
          await processCheckInboxJob(job as Job<CheckInboxJobData>);
          break;
        default:
          logger.warn({ jobName: job.name }, 'Unknown inbox job');
      }
    },
    1,
  );

  registerWorker(
    QUEUE_NAMES.SCHEDULER,
    async (job: Job) => {
      switch (job.name) {
        case 'scheduler-tick':
          await processSchedulerTick();
          break;
        case 'daily-reset':
          await processDailyReset();
          break;
        case 'rotate-proxy-job':
          await processRotateProxyJob(job as Job<RotateProxyJobData>);
          break;
        default:
          logger.warn({ jobName: job.name }, 'Unknown scheduler job');
      }
    },
    1,
  );

  try {
    const schedulerQueue = getSchedulerQueue();

    await schedulerQueue.add(
      'scheduler-tick',
      {},
      { repeat: { every: 60_000 }, jobId: 'scheduler-tick-recurring' },
    );

    await schedulerQueue.add(
      'daily-reset',
      {},
      { repeat: { pattern: '0 0 * * *' }, jobId: 'daily-reset-recurring' },
    );

    logger.info('All BullMQ workers initialized');
  } catch (error) {
    logger.warn({ error }, 'Scheduler repeat jobs may already exist');
  }
}

export * from './create-post.job';
export * from './check-inbox.job';
export * from './scheduler.job';
export * from './daily-reset.job';
export * from './verify-account.job';
export * from './rotate-proxy.job';
