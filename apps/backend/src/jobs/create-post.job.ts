import { Job } from 'bullmq';
import { JobName, CreatePostJobData } from '@fix-and-flow/types';
import { NotFoundError } from '@fix-and-flow/shared';
import { logger } from '../config/logger';
import { postingService } from '../modules/posting/posting.service';
import { logService } from '../services/log.service';
import { LogCategory, LogLevel } from '@fix-and-flow/types';

export async function processCreatePostJob(job: Job<CreatePostJobData>): Promise<void> {
  const { postId, accountId, title } = job.data;

  logger.info({ jobId: job.id, postId, accountId }, 'Processing create-post job');

  await logService.create({
    level: LogLevel.INFO,
    category: LogCategory.SCHEDULER,
    message: `Job started: create-post for "${title}"`,
    accountId,
    postId,
    metadata: { jobId: job.id },
  });

  try {
    await postingService.executePost(postId);

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.POSTING,
      message: `Job completed: create-post for "${title}"`,
      accountId,
      postId,
      metadata: { jobId: job.id },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      logger.warn({ postId, accountId, jobId: job.id }, 'Post no longer exists — skipping queued job');
      return;
    }

    const message = error instanceof Error ? error.message : 'Job processing failed';

    await logService.create({
      level: LogLevel.ERROR,
      category: LogCategory.POSTING,
      message: `Job failed: create-post - ${message}`,
      accountId,
      postId,
      metadata: { jobId: job.id },
    });

    throw error;
  }
}

export const CREATE_POST_JOB_NAME = JobName.CREATE_POST;
