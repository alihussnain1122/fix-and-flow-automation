import { Job } from 'bullmq';
import { VerifyAccountJobData } from '@fix-and-flow/types';
import { accountService } from '../modules/accounts/account.service';
import { logger } from '../config/logger';

export async function processVerifyAccountJob(job: Job<VerifyAccountJobData>): Promise<void> {
  const { accountId } = job.data;
  logger.info({ jobId: job.id, accountId }, 'Processing verify-account job');
  await accountService.verifyAccount(accountId);
}
