import { AccountStatus, CreateAccountDto, UpdateAccountDto } from '@fix-and-flow/types';
import { NotFoundError, ValidationError, ConflictError } from '@fix-and-flow/shared';
import { isValidEmail, parsePagination } from '@fix-and-flow/shared';
import { encrypt, decrypt } from '../../utils/encryption';
import { getRandomUserAgent } from '../../utils/human-behavior';
import { logService } from '../../services/log.service';
import { LogCategory, LogLevel } from '@fix-and-flow/types';
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

    const account = await accountRepository.create({
      email: dto.email,
      passwordEncrypted: encrypt(dto.password),
      displayName: dto.displayName,
      proxyId: dto.proxyId,
      userAgent: dto.userAgent ?? getRandomUserAgent(),
      dailyPostLimit: dto.dailyPostLimit,
    });

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
    if (dto.proxyId !== undefined) updateData.proxyId = dto.proxyId;
    if (dto.userAgent !== undefined) updateData.userAgent = dto.userAgent;
    if (dto.dailyPostLimit !== undefined) updateData.dailyPostLimit = dto.dailyPostLimit;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;
    if (dto.cookies !== undefined) updateData.cookiesEncrypted = encrypt(dto.cookies);

    const updated = await accountRepository.update(id, updateData);
    if (!updated) throw new NotFoundError('Account', id);

    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    const deleted = await accountRepository.delete(id);

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.ACCOUNT,
      message: `Account deleted: ${id}`,
      accountId: id,
    });

    return deleted;
  }

  async getDecryptedPassword(id: string): Promise<string> {
    const encrypted = await accountRepository.getPasswordEncrypted(id);
    if (!encrypted) throw new NotFoundError('Account', id);
    return decrypt(encrypted);
  }

  async getDecryptedCookies(id: string): Promise<string | null> {
    const encrypted = await accountRepository.getCookiesEncrypted(id);
    if (!encrypted) return null;
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

  async incrementPostsToday(id: string) {
    const account = await this.findById(id);
    return accountRepository.update(id, {
      postsToday: account.postsToday + 1,
      lastPostAt: new Date(),
    });
  }

  async canPost(id: string): Promise<boolean> {
    const account = await this.findById(id);
    return (
      account.status === AccountStatus.ACTIVE && account.postsToday < account.dailyPostLimit
    );
  }
}

export const accountService = new AccountService();
