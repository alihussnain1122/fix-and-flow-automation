import { Job } from 'bullmq';
import { RotateProxyJobData } from '@fix-and-flow/types';
import { proxyService } from '../modules/proxies/proxy.service';
import { logger } from '../config/logger';

export async function processRotateProxyJob(job: Job<RotateProxyJobData>): Promise<void> {
  const { accountId } = job.data;
  logger.info({ jobId: job.id, accountId }, 'Processing rotate-proxy job');
  await proxyService.rotateForAccount(accountId);
}
