export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const MIN_POST_DELAY_MS = 2000;
export const MAX_POST_DELAY_MS = 10000;

export const DEFAULT_DAILY_POST_LIMIT = 5;
export const MIN_DAILY_POST_LIMIT = 1;
export const MAX_DAILY_POST_LIMIT = 5;

export const DEFAULT_MIN_INTERVAL_MINUTES = 60;
export const DEFAULT_MAX_INTERVAL_MINUTES = 240;

export const MAX_RETRY_ATTEMPTS = 3;

export const QUEUE_NAMES = {
  POSTING: 'posting-queue',
  INBOX: 'inbox-queue',
  SCHEDULER: 'scheduler-queue',
} as const;
