import { Queue, Worker, QueueEvents, Processor } from 'bullmq';
import { env } from './env';
import { getRedisConnectionOptions } from './redis';
import { logger } from './logger';
import { QUEUE_NAMES } from '@fix-and-flow/shared';

const connection = getRedisConnectionOptions();

function getQueueName(name: string): string {
  return `${env.QUEUE_PREFIX}:${name}`;
}

const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();
const queueEvents = new Map<string, QueueEvents>();

export function getQueue(name: string): Queue {
  const queueName = getQueueName(name);

  if (!queues.has(queueName)) {
    const queue = new Queue(queueName, { connection });
    queues.set(queueName, queue);
    logger.info({ queueName }, 'Queue initialized');
  }

  return queues.get(queueName)!;
}

export function getPostingQueue(): Queue {
  return getQueue(QUEUE_NAMES.POSTING);
}

export function getInboxQueue(): Queue {
  return getQueue(QUEUE_NAMES.INBOX);
}

export function getSchedulerQueue(): Queue {
  return getQueue(QUEUE_NAMES.SCHEDULER);
}

export function registerWorker(
  queueName: string,
  processor: Processor,
  concurrency = 1,
): Worker {
  const fullQueueName = getQueueName(queueName);

  if (workers.has(fullQueueName)) {
    return workers.get(fullQueueName)!;
  }

  const worker = new Worker(fullQueueName, processor, {
    connection,
    concurrency,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, jobName: job?.name, err }, 'Job failed');
  });

  workers.set(fullQueueName, worker);
  logger.info({ queueName: fullQueueName, concurrency }, 'Worker registered');

  return worker;
}

export function getQueueEvents(name: string): QueueEvents {
  const queueName = getQueueName(name);

  if (!queueEvents.has(queueName)) {
    queueEvents.set(queueName, new QueueEvents(queueName, { connection }));
  }

  return queueEvents.get(queueName)!;
}

export async function closeQueues(): Promise<void> {
  for (const worker of workers.values()) {
    await worker.close();
  }
  workers.clear();

  for (const events of queueEvents.values()) {
    await events.close();
  }
  queueEvents.clear();

  for (const queue of queues.values()) {
    await queue.close();
  }
  queues.clear();

  logger.info('All queues and workers closed');
}
