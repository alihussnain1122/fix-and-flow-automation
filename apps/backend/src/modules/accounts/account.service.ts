import { AccountStatus, CreateAccountDto, UpdateAccountDto, ScheduleStatus } from '@fix-and-flow/types';
import { NotFoundError, ValidationError, ConflictError } from '@fix-and-flow/shared';
import { isValidEmail, parsePagination } from '@fix-and-flow/shared';
import { encrypt } from '../../utils/encryption';
import { getRandomUserAgent } from '../../utils/human-behavior';
import { logService } from '../../services/log.service';
import { LogCategory, LogLevel } from '@fix-and-flow/types';
import { credentialsService } from '../../services/credentials.service';
import { playwrightEngine } from '../posting/playwright.engine';
import { proxyService } from '../proxies/proxy.service';
import { schedulerRepository } from '../scheduler/scheduler.repository';
import { logger } from '../../config/logger';
import { accountRepository } from './account.repository';

export class AccountService {
  async findAll(page?: number, limit?: number, filters?: { status?: string; search?: string }) {
    const { page: p, limit: l, offset } = parsePagination(page, limit);
    return accountRepository.findAll(offset, l, filters);
  }

  async findById(id: string) {
    const account = await accountRepository.findById(id);
    if (!account) throw new NotFoundError('Account', id);
    return accountRepository.mapRow(account);
  }

  async create(dto: CreateAccountDto) {
    if (!isValidEmail(dto.email)) {
      throw new ValidationError('Invalid email address');
    }

    const existing = await accountRepository.findByEmail(dto.email);
    if (existing) throw new ConflictError(`Account with email '${dto.email}' already exists`);

    let proxyId = dto.proxyId;
    if (!proxyId) {
      const available = await proxyService.getAvailableProxy();
      if (available) {
        proxyId = available.id;
      }
    }

    const account = await accountRepository.create({
      email: dto.email,
      passwordEncrypted: encrypt(dto.password),
      displayName: dto.displayName,
      proxyId,
      userAgent: dto.userAgent ?? getRandomUserAgent(),
    });

    if (proxyId) {
      await proxyService.assignToAccount(proxyId, account.id);
    }

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.ACCOUNT,
      message: `Account created: ${dto.email}`,
      accountId: account.id,
    });

    return account;
  }

  async update(id: string, dto: UpdateAccountDto) {
    await this.findById(id);

    const updateData: Parameters<typeof accountRepository.update>[1] = {};

    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.proxyId !== undefined) {
      const current = await this.findById(id);
      if (current.proxyId && current.proxyId !== dto.proxyId) {
        await proxyService.releaseFromAccount(current.proxyId);
      }
      if (dto.proxyId) {
        await proxyService.assignToAccount(dto.proxyId, id);
      }
      updateData.proxyId = dto.proxyId;
    }
    if (dto.userAgent !== undefined) updateData.userAgent = dto.userAgent;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;
    if (dto.cookies !== undefined) updateData.cookiesEncrypted = encrypt(dto.cookies);

    const updated = await accountRepository.update(id, updateData);
    if (!updated) throw new NotFoundError('Account', id);

    return updated;
  }

  async delete(id: string) {
    const account = await this.findById(id);
    if (account.proxyId) {
      await proxyService.releaseFromAccount(account.proxyId);
    }
    const deleted = await accountRepository.delete(id);

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.ACCOUNT,
      message: `Account deleted: ${id}`,
      accountId: undefined,
      metadata: { deletedAccountId: id },
    });

    return deleted;
  }

  async getDecryptedPassword(id: string): Promise<string> {
    const encrypted = await accountRepository.getPasswordEncrypted(id);
    if (!encrypted) throw new NotFoundError('Account', id);
    const { decrypt } = await import('../../utils/encryption');
    return decrypt(encrypted);
  }

  async getDecryptedCookies(id: string): Promise<string | null> {
    const encrypted = await accountRepository.getCookiesEncrypted(id);
    if (!encrypted) return null;
    const { decrypt } = await import('../../utils/encryption');
    return decrypt(encrypted);
  }

  async markAsBanned(id: string, reason?: string) {
    const updated = await accountRepository.update(id, {
      status: AccountStatus.BANNED,
      metadata: { banReason: reason, bannedAt: new Date().toISOString() },
    });

    await logService.create({
      level: LogLevel.WARN,
      category: LogCategory.ACCOUNT,
      message: `Account banned: ${reason ?? 'No reason provided'}`,
      accountId: id,
    });

    return updated;
  }

  async markAsFlagged(id: string, reason?: string) {
    return accountRepository.update(id, {
      status: AccountStatus.FLAGGED,
      metadata: { flagReason: reason, flaggedAt: new Date().toISOString() },
    });
  }

  async activate(id: string) {
    const updated = await accountRepository.update(id, {
      status: AccountStatus.ACTIVE,
      lastLoginAt: new Date(),
    });

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.ACCOUNT,
      message: 'Account activated',
      accountId: id,
    });

    return updated;
  }

  async verifyAccount(id: string) {
    const account = await this.findById(id);
    const creds = await credentialsService.buildForAccount(id);

    if (account.proxyId) {
      try {
        const health = await proxyService.healthCheck(account.proxyId);
        if (!health.ok) {
          await logService.create({
            level: LogLevel.WARN,
            category: LogCategory.PROXY,
            message: `Proxy health check failed before verification: ${health.error}`,
            accountId: id,
          });
        }
      } catch {
        logger.warn({ accountId: id, proxyId: account.proxyId }, 'Proxy health check skipped');
      }
    }

    const result = await playwrightEngine.verifyAccount(
      creds,
      {
        onCookiesUpdated: async (cookies) => {
          await credentialsService.saveCookiesFromSession(id, cookies);
        },
        onAccountHealth: async (health) => {
          if (health.status === AccountStatus.BANNED) {
            await this.markAsBanned(id, health.reason);
          } else if (health.status === AccountStatus.FLAGGED) {
            await this.markAsFlagged(id, health.reason);
          } else if (health.isLoggedIn) {
            await this.activate(id);
          }
        },
      },
      {
        onProxyFailure: async () => {
          if (account.proxyId) {
            await proxyService.markFailed(account.proxyId);
            await logService.create({
              level: LogLevel.WARN,
              category: LogCategory.PROXY,
              message: 'Proxy marked failed during account verification — retried without proxy',
              accountId: id,
            });
          }
        },
      },
    );

    await logService.create({
      level: result.success ? LogLevel.INFO : LogLevel.WARN,
      category: LogCategory.ACCOUNT,
      message: `Account verification: ${result.status} — ${result.reason ?? 'OK'}`,
      accountId: id,
    });

    return result;
  }

  async loginAccount(id: string) {
    const account = await this.findById(id);
    const creds = await credentialsService.buildForAccount(id);

    if (!creds.password) {
      throw new ValidationError('Account password is required to connect Facebook');
    }

    if (account.proxyId) {
      try {
        const health = await proxyService.healthCheck(account.proxyId);
        if (!health.ok) {
          await logService.create({
            level: LogLevel.WARN,
            category: LogCategory.PROXY,
            message: `Proxy health check failed before login: ${health.error}`,
            accountId: id,
          });
        }
      } catch {
        logger.warn({ accountId: id, proxyId: account.proxyId }, 'Proxy health check skipped');
      }
    }

    const result = await playwrightEngine.loginAccount(
      creds,
      {
        onCookiesUpdated: async (cookies) => {
          await credentialsService.saveCookiesFromSession(id, cookies);
        },
        onAccountHealth: async (health) => {
          if (health.status === AccountStatus.BANNED) {
            await this.markAsBanned(id, health.reason);
          } else if (health.status === AccountStatus.FLAGGED) {
            await this.markAsFlagged(id, health.reason);
          } else if (health.isLoggedIn) {
            await this.activate(id);
          }
        },
      },
      {
        onProxyFailure: async () => {
          if (account.proxyId) {
            await proxyService.markFailed(account.proxyId);
            await logService.create({
              level: LogLevel.WARN,
              category: LogCategory.PROXY,
              message: 'Proxy marked failed during Facebook login — retried without proxy',
              accountId: id,
            });
          }
        },
      },
    );

    await logService.create({
      level: result.success ? LogLevel.INFO : LogLevel.WARN,
      category: LogCategory.ACCOUNT,
      message: `Facebook login: ${result.status} — ${result.reason ?? 'OK'}`,
      accountId: id,
    });

    return result;
  }

  async assignProxy(id: string, proxyId?: string) {
    await this.findById(id);

    let targetProxyId = proxyId;
    if (!targetProxyId) {
      const available = await proxyService.getAvailableProxy();
      if (!available) throw new ValidationError('No available proxies');
      targetProxyId = available.id;
    }

    return this.update(id, { proxyId: targetProxyId });
  }

  async incrementPostsToday(id: string) {
    const account = await this.findById(id);
    return accountRepository.update(id, {
      postsToday: account.postsToday + 1,
      lastPostAt: new Date(),
    });
  }

  async getScheduleDailyLimit(accountId: string): Promise<number | null> {
    const scheduleRow = await schedulerRepository.findByAccountId(accountId);
    if (!scheduleRow) return null;
    return schedulerRepository.mapRow(scheduleRow).dailyPostLimit;
  }

  async canPost(id: string): Promise<boolean> {
    const account = await this.findById(id);
    if (account.status !== AccountStatus.ACTIVE) return false;

    const scheduleRow = await schedulerRepository.findByAccountId(id);
    if (!scheduleRow) return false;

    const schedule = schedulerRepository.mapRow(scheduleRow);
    if (schedule.status !== ScheduleStatus.ACTIVE) return false;

    return account.postsToday < schedule.dailyPostLimit;
  }
}

export const accountService = new AccountService();
