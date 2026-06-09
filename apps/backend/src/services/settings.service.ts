import { query } from '../config/database';
import {
  AUTOMATION_DEFAULTS as SHARED_AUTOMATION_DEFAULTS,
  AUTOMATION_TARGETS as SHARED_AUTOMATION_TARGETS,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
} from '@fix-and-flow/shared';
import { ValidationError } from '@fix-and-flow/shared';

/** Fallback when @fix-and-flow/shared dist is stale (run: npm run build -w @fix-and-flow/shared) */
const AUTOMATION_TARGETS = SHARED_AUTOMATION_TARGETS ?? {
  DAILY_POSTS: 500,
  ACCOUNT_UPTIME_PCT: 99,
  AUTO_REPLY_MAX_SECONDS: 120,
  PROXY_ROTATION_SUCCESS_PCT: 95,
  LISTING_REFRESH_MIN_HOURS: 24,
  LISTING_REFRESH_MAX_HOURS: 48,
};

const AUTOMATION_DEFAULTS = SHARED_AUTOMATION_DEFAULTS ?? {
  INBOX_POLL_INTERVAL_SECONDS: 90,
  ACCOUNT_HEALTH_INTERVAL_HOURS: 6,
  PROXY_HEALTH_INTERVAL_HOURS: 12,
  POSTS_PER_SCHEDULER_TICK: 10,
  MAX_INBOX_CHECKS_PER_TICK: 5,
  MAX_HEALTH_CHECKS_PER_TICK: 3,
  MAX_PROXY_CHECKS_PER_TICK: 5,
  DEFAULT_CATEGORY: 'Services',
  DEFAULT_CONDITION: 'New',
};

const KEYS = {
  master: 'automation_master_enabled',
  posts: 'posts_automation_enabled',
  inbox: 'inbox_automation_enabled',
  listingRefresh: 'listing_refresh_enabled',
  accountHealth: 'account_health_enabled',
  proxyHealth: 'proxy_health_enabled',
  dailyPostTarget: 'daily_post_target',
  inboxPollSeconds: 'inbox_poll_interval_seconds',
  refreshMinHours: 'listing_refresh_min_hours',
  refreshMaxHours: 'listing_refresh_max_hours',
  postsPerTick: 'posts_per_scheduler_tick',
  defaultCategory: 'default_listing_category',
  defaultCondition: 'default_listing_condition',
} as const;

export interface AutomationSettings {
  masterEnabled: boolean;
  postsEnabled: boolean;
  inboxEnabled: boolean;
  listingRefreshEnabled: boolean;
  accountHealthEnabled: boolean;
  proxyHealthEnabled: boolean;
  dailyPostTarget: number;
  inboxPollIntervalSeconds: number;
  listingRefreshMinHours: number;
  listingRefreshMaxHours: number;
  postsPerSchedulerTick: number;
  defaultCategory: string;
  defaultCondition: string;
  targets: typeof AUTOMATION_TARGETS;
}

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const result = await query<{ value: T }>(`SELECT value FROM app_settings WHERE key = $1`, [key]);
  if (!result.rows[0]) return fallback;
  return result.rows[0].value as T;
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [key, JSON.stringify(value)],
  );
}

export class SettingsService {
  async getAutomationSettings(): Promise<AutomationSettings> {
    return {
      masterEnabled: await readSetting(KEYS.master, true),
      postsEnabled: await readSetting(KEYS.posts, true),
      inboxEnabled: await readSetting(KEYS.inbox, true),
      listingRefreshEnabled: await readSetting(KEYS.listingRefresh, true),
      accountHealthEnabled: await readSetting(KEYS.accountHealth, true),
      proxyHealthEnabled: await readSetting(KEYS.proxyHealth, true),
      dailyPostTarget: await readSetting(KEYS.dailyPostTarget, AUTOMATION_TARGETS.DAILY_POSTS),
      inboxPollIntervalSeconds: await readSetting(
        KEYS.inboxPollSeconds,
        AUTOMATION_DEFAULTS.INBOX_POLL_INTERVAL_SECONDS,
      ),
      listingRefreshMinHours: await readSetting(
        KEYS.refreshMinHours,
        AUTOMATION_TARGETS.LISTING_REFRESH_MIN_HOURS,
      ),
      listingRefreshMaxHours: await readSetting(
        KEYS.refreshMaxHours,
        AUTOMATION_TARGETS.LISTING_REFRESH_MAX_HOURS,
      ),
      postsPerSchedulerTick: await readSetting(
        KEYS.postsPerTick,
        AUTOMATION_DEFAULTS.POSTS_PER_SCHEDULER_TICK,
      ),
      defaultCategory: await readSetting(
        KEYS.defaultCategory,
        AUTOMATION_DEFAULTS.DEFAULT_CATEGORY,
      ),
      defaultCondition: await readSetting(
        KEYS.defaultCondition,
        AUTOMATION_DEFAULTS.DEFAULT_CONDITION,
      ),
      targets: AUTOMATION_TARGETS,
    };
  }

  async updateAutomationSettings(
    patch: Partial<Omit<AutomationSettings, 'targets'>>,
  ): Promise<AutomationSettings> {
    if (patch.masterEnabled !== undefined) await writeSetting(KEYS.master, patch.masterEnabled);
    if (patch.postsEnabled !== undefined) await writeSetting(KEYS.posts, patch.postsEnabled);
    if (patch.inboxEnabled !== undefined) await writeSetting(KEYS.inbox, patch.inboxEnabled);
    if (patch.listingRefreshEnabled !== undefined) {
      await writeSetting(KEYS.listingRefresh, patch.listingRefreshEnabled);
    }
    if (patch.accountHealthEnabled !== undefined) {
      await writeSetting(KEYS.accountHealth, patch.accountHealthEnabled);
    }
    if (patch.proxyHealthEnabled !== undefined) {
      await writeSetting(KEYS.proxyHealth, patch.proxyHealthEnabled);
    }
    if (patch.dailyPostTarget !== undefined) {
      await writeSetting(KEYS.dailyPostTarget, patch.dailyPostTarget);
    }
    if (patch.inboxPollIntervalSeconds !== undefined) {
      await writeSetting(KEYS.inboxPollSeconds, patch.inboxPollIntervalSeconds);
    }
    if (patch.listingRefreshMinHours !== undefined) {
      await writeSetting(KEYS.refreshMinHours, patch.listingRefreshMinHours);
    }
    if (patch.listingRefreshMaxHours !== undefined) {
      await writeSetting(KEYS.refreshMaxHours, patch.listingRefreshMaxHours);
    }
    if (patch.postsPerSchedulerTick !== undefined) {
      await writeSetting(KEYS.postsPerTick, patch.postsPerSchedulerTick);
    }
    if (patch.defaultCategory !== undefined) {
      if (!MARKETPLACE_CATEGORIES.includes(patch.defaultCategory as (typeof MARKETPLACE_CATEGORIES)[number])) {
        throw new ValidationError(`Invalid default category: ${patch.defaultCategory}`);
      }
      await writeSetting(KEYS.defaultCategory, patch.defaultCategory);
    }
    if (patch.defaultCondition !== undefined) {
      if (!MARKETPLACE_CONDITIONS.includes(patch.defaultCondition as (typeof MARKETPLACE_CONDITIONS)[number])) {
        throw new ValidationError(`Invalid default condition: ${patch.defaultCondition}`);
      }
      await writeSetting(KEYS.defaultCondition, patch.defaultCondition);
    }
    return this.getAutomationSettings();
  }

  async isPostsAutomationEnabled(): Promise<boolean> {
    const settings = await this.getAutomationSettings();
    return settings.masterEnabled && settings.postsEnabled;
  }

  async setPostsAutomationEnabled(enabled: boolean): Promise<boolean> {
    await writeSetting(KEYS.posts, enabled);
    return enabled;
  }

  async isMasterAutomationEnabled(): Promise<boolean> {
    return readSetting(KEYS.master, true);
  }
}

export const settingsService = new SettingsService();
