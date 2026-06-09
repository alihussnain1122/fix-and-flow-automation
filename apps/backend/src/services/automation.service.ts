import { JobName } from '@fix-and-flow/types';
import { getInboxQueue, getPostingQueue } from '../config/queue';
import { logger } from '../config/logger';
import { settingsService } from './settings.service';
import { accountRepository } from '../modules/accounts/account.repository';
import { postingRepository } from '../modules/posting/posting.repository';
import { postingService } from '../modules/posting/posting.service';
import { proxyService } from '../modules/proxies/proxy.service';
import { schedulerService } from '../modules/scheduler/scheduler.service';
import { randomBetween } from '../utils/human-behavior';

export interface AutomationCycleResult {
  schedulesProcessed: number;
  postsQueued: number;
  listingsRefreshed: number;
  inboxChecksQueued: number;
  healthChecksQueued: number;
  proxyChecksRun: number;
  proxyRotations: number;
}

function parseMetaTime(metadata: Record<string, unknown>, key: string): number | null {
  const raw = metadata[key];
  if (!raw || typeof raw !== 'string') return null;
  const ts = Date.parse(raw);
  return Number.isNaN(ts) ? null : ts;
}

export class AutomationService {
  async runSchedulerCycle(): Promise<AutomationCycleResult> {
    const settings = await settingsService.getAutomationSettings();
    if (!settings.masterEnabled) {
      return {
        schedulesProcessed: 0,
        postsQueued: 0,
        listingsRefreshed: 0,
        inboxChecksQueued: 0,
        healthChecksQueued: 0,
        proxyChecksRun: 0,
        proxyRotations: 0,
      };
    }

    const schedulesProcessed = await schedulerService.processDueSchedules();
    const postsQueued = settings.postsEnabled ? await postingService.processAutomationQueue() : 0;
    const listingsRefreshed = settings.listingRefreshEnabled
      ? await this.processListingRefresh()
      : 0;
    const inboxChecksQueued = settings.inboxEnabled ? await this.processInboxPolling() : 0;
    const healthChecksQueued = settings.accountHealthEnabled
      ? await this.processAccountHealthChecks()
      : 0;
    const { proxyChecksRun, proxyRotations } = settings.proxyHealthEnabled
      ? await this.processProxyHealth()
      : { proxyChecksRun: 0, proxyRotations: 0 };

    const result: AutomationCycleResult = {
      schedulesProcessed,
      postsQueued,
      listingsRefreshed,
      inboxChecksQueued,
      healthChecksQueued,
      proxyChecksRun,
      proxyRotations,
    };

    const activity =
      schedulesProcessed +
      postsQueued +
      listingsRefreshed +
      inboxChecksQueued +
      healthChecksQueued +
      proxyChecksRun +
      proxyRotations;

    if (activity > 0) {
      logger.info(result, 'Automation cycle completed');
    }

    return result;
  }

  async processListingRefresh(): Promise<number> {
    const settings = await settingsService.getAutomationSettings();
    const refreshAfterHours = randomBetween(
      settings.listingRefreshMinHours,
      settings.listingRefreshMaxHours,
    );

    const due = await postingRepository.findPublishedDueForRefresh(refreshAfterHours, 5);
    let processed = 0;

    for (const post of due) {
      try {
        await postingService.createRefreshListing(post.id);
        processed++;
      } catch (error) {
        logger.warn({ postId: post.id, error }, 'Listing refresh failed');
      }
    }

    return processed;
  }

  async processInboxPolling(): Promise<number> {
    const settings = await settingsService.getAutomationSettings();
    const accounts = await accountRepository.findActiveForAutomation();
    const queue = getInboxQueue();
    const intervalMs = settings.inboxPollIntervalSeconds * 1000;
    let queued = 0;

    for (const account of accounts) {
      if (queued >= 5) break;

      const lastCheck = parseMetaTime(account.metadata, 'lastInboxCheckAt');
      if (lastCheck && Date.now() - lastCheck < intervalMs) continue;

      await queue.add(
        JobName.CHECK_INBOX,
        { accountId: account.id },
        { jobId: `inbox-${account.id}-${Date.now()}`, removeOnComplete: true },
      );

      await accountRepository.update(account.id, {
        metadata: { ...account.metadata, lastInboxCheckAt: new Date().toISOString() },
      });

      queued++;
    }

    return queued;
  }

  async processAccountHealthChecks(): Promise<number> {
    const accounts = await accountRepository.findActiveForAutomation();
    const queue = getPostingQueue();
    const intervalMs = 6 * 60 * 60 * 1000;
    let queued = 0;

    for (const account of accounts) {
      if (queued >= 3) break;

      const lastCheck = parseMetaTime(account.metadata, 'lastHealthCheckAt');
      if (lastCheck && Date.now() - lastCheck < intervalMs) continue;

      await queue.add(
        JobName.VERIFY_ACCOUNT,
        { accountId: account.id },
        { jobId: `verify-${account.id}-${Date.now()}`, removeOnComplete: true },
      );

      await accountRepository.update(account.id, {
        metadata: { ...account.metadata, lastHealthCheckAt: new Date().toISOString() },
      });

      queued++;
    }

    return queued;
  }

  async processProxyHealth(): Promise<{ proxyChecksRun: number; proxyRotations: number }> {
    const accounts = await accountRepository.findActiveForAutomation();
    let proxyChecksRun = 0;
    let proxyRotations = 0;

    for (const account of accounts) {
      if (proxyChecksRun >= 5) break;
      if (!account.proxyId) continue;

      const lastCheck = parseMetaTime(account.metadata, 'lastProxyCheckAt');
      if (lastCheck && Date.now() - lastCheck < 12 * 60 * 60 * 1000) continue;

      try {
        const result = await proxyService.healthCheck(account.proxyId);
        proxyChecksRun++;

        await accountRepository.update(account.id, {
          metadata: { ...account.metadata, lastProxyCheckAt: new Date().toISOString() },
        });

        if (!result.ok) {
          await proxyService.rotateForAccount(account.id);
          proxyRotations++;
        }
      } catch (error) {
        logger.warn({ accountId: account.id, error }, 'Proxy health check failed');
      }
    }

    return { proxyChecksRun, proxyRotations };
  }

  async getKpiSnapshot() {
    const settings = await settingsService.getAutomationSettings();
    const postsToday = await postingRepository.countPublishedToday();
    const activeAccounts = await accountRepository.findActiveForAutomation();

    return {
      settings,
      postsToday,
      dailyPostTarget: settings.dailyPostTarget,
      dailyPostProgressPct: Math.min(
        100,
        Math.round((postsToday / Math.max(settings.dailyPostTarget, 1)) * 100),
      ),
      activeAccounts: activeAccounts.length,
      accountUptimeTargetPct: settings.targets.ACCOUNT_UPTIME_PCT,
      autoReplyTargetSeconds: settings.targets.AUTO_REPLY_MAX_SECONDS,
      proxyRotationTargetPct: settings.targets.PROXY_ROTATION_SUCCESS_PCT,
    };
  }
}

export const automationService = new AutomationService();
