import { Job } from 'bullmq';
import { registerWorker, getSchedulerQueue } from '../config/queue';
import { QUEUE_NAMES } from '@fix-and-flow/shared';
import { CreatePostJobData, CheckInboxJobData } from '@fix-and-flow/types';
import { processCreatePostJob } from './create-post.job';
import { processCheckInboxJob } from './check-inbox.job';
import { processSchedulerTick } from './scheduler.job';
import { logger } from '../config/logger';

export function initializeWorkers(): void {
  registerWorker(
    QUEUE_NAMES.POSTING,
    async (job: Job) => {
      switch (job.name) {
        case 'create-post-job':
          await processCreatePostJob(job as Job<CreatePostJobData>);
          break;
        default:
          logger.warn({ jobName: job.name }, 'Unknown posting job');
      }
    },
    2,
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
      if (job.name === 'scheduler-tick') {
        await processSchedulerTick();
      }
    },
    1,
  );

  const schedulerQueue = getSchedulerQueue();
  schedulerQueue.add(
    'scheduler-tick',
    {},
    {
      repeat: { every: 60_000 },
      jobId: 'scheduler-tick-recurring',
    },
  );

  logger.info('All BullMQ workers initialized');
}

export * from './create-post.job';
export * from './check-inbox.job';
export * from './scheduler.job';
