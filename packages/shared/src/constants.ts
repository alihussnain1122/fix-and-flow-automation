export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const MIN_POST_DELAY_MS = 2000;
export const MAX_POST_DELAY_MS = 10000;

export const DEFAULT_DAILY_POST_LIMIT = 5;
/** Per-account daily cap — set on Schedules page (Fix & Flow spec: 3–5/day/account) */
export const MIN_DAILY_POST_LIMIT = 3;
export const MAX_DAILY_POST_LIMIT = 5;

export const DEFAULT_MIN_INTERVAL_MINUTES = 60;
export const DEFAULT_MAX_INTERVAL_MINUTES = 240;

export const MAX_RETRY_ATTEMPTS = 3;

/** 24/7 automation targets and defaults (Fix & Flow production spec) */
export const AUTOMATION_TARGETS = {
  DAILY_POSTS: 500,
  ACCOUNT_UPTIME_PCT: 99,
  AUTO_REPLY_MAX_SECONDS: 120,
  PROXY_ROTATION_SUCCESS_PCT: 95,
  LISTING_REFRESH_MIN_HOURS: 24,
  LISTING_REFRESH_MAX_HOURS: 48,
} as const;

export const AUTOMATION_DEFAULTS = {
  INBOX_POLL_INTERVAL_SECONDS: 90,
  ACCOUNT_HEALTH_INTERVAL_HOURS: 6,
  PROXY_HEALTH_INTERVAL_HOURS: 12,
  POSTS_PER_SCHEDULER_TICK: 10,
  MAX_INBOX_CHECKS_PER_TICK: 5,
  MAX_HEALTH_CHECKS_PER_TICK: 3,
  MAX_PROXY_CHECKS_PER_TICK: 5,
  DEFAULT_CATEGORY: 'Services',
  DEFAULT_CONDITION: 'New',
} as const;

/** Facebook Marketplace listing categories */
export const MARKETPLACE_CATEGORIES = [
  'Home & Garden',
  'Tools & Home Improvement',
  'Home Improvement',
  'Household',
  'Services',
  'Miscellaneous',
  'Other',
] as const;

export const MARKETPLACE_CONDITIONS = [
  'New',
  'Used - Like New',
  'Used - Good',
  'Used - Fair',
] as const;

export const QUEUE_NAMES = {
  POSTING: 'posting-queue',
  INBOX: 'inbox-queue',
  SCHEDULER: 'scheduler-queue',
} as const;
