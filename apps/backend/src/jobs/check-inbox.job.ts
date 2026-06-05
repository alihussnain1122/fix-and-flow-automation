import { Job } from 'bullmq';
import { JobName, CheckInboxJobData } from '@fix-and-flow/types';
import { logger } from '../config/logger';
import { inboxService } from '../modules/inbox/inbox.service';

export async function processCheckInboxJob(job: Job<CheckInboxJobData>): Promise<void> {
  const { accountId } = job.data;

  logger.info({ jobId: job.id, accountId }, 'Processing check-inbox job');

  const newMessages = await inboxService.checkInbox(accountId);

  logger.info({ jobId: job.id, accountId, newMessages }, 'Check-inbox job completed');
}

export const CHECK_INBOX_JOB_NAME = JobName.CHECK_INBOX;
