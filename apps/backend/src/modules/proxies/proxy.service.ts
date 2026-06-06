import { CreateProxyDto, UpdateProxyDto, ProxyStatus } from '@fix-and-flow/types';
import { NotFoundError, ValidationError } from '@fix-and-flow/shared';
import { isValidPort, parsePagination } from '@fix-and-flow/shared';
import { encrypt } from '../../utils/encryption';
import { checkProxyConnectivity, checkFacebookReachability, buildProxyUrl } from '../../utils/network';
import { logService } from '../../services/log.service';
import { LogCategory, LogLevel } from '@fix-and-flow/types';
import { accountService } from '../accounts/account.service';
import { proxyRepository } from './proxy.repository';

export class ProxyService {
  async findAll(page?: number, limit?: number, filters?: { status?: string; type?: string }) {
    const { offset, limit: l } = parsePagination(page, limit);
    return proxyRepository.findAll(offset, l, filters);
  }

  async findById(id: string) {
    const proxy = await proxyRepository.findById(id);
    if (!proxy) throw new NotFoundError('Proxy', id);
    return proxyRepository.mapRow(proxy);
  }

  async create(dto: CreateProxyDto) {
    if (!isValidPort(dto.port)) {
      throw new ValidationError('Invalid proxy port');
    }

    const proxy = await proxyRepository.create({
      host: dto.host,
      port: dto.port,
      username: dto.username,
      passwordEncrypted: dto.password ? encrypt(dto.password) : undefined,
      type: dto.type,
      country: dto.country,
      city: dto.city,
    });

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.PROXY,
      message: `Proxy created: ${dto.host}:${dto.port}`,
    });

    return proxy;
  }

  async update(id: string, dto: UpdateProxyDto) {
    await this.findById(id);

    const updateData: Parameters<typeof proxyRepository.update>[1] = {};
    if (dto.host !== undefined) updateData.host = dto.host;
    if (dto.port !== undefined) {
      if (!isValidPort(dto.port)) throw new ValidationError('Invalid proxy port');
      updateData.port = dto.port;
    }
    if (dto.username !== undefined) updateData.username = dto.username;
    if (dto.password !== undefined) updateData.passwordEncrypted = encrypt(dto.password);
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.country !== undefined) updateData.country = dto.country;
    if (dto.city !== undefined) updateData.city = dto.city;

    const updated = await proxyRepository.update(id, updateData);
    if (!updated) throw new NotFoundError('Proxy', id);
    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    return proxyRepository.delete(id);
  }

  async assignToAccount(proxyId: string, accountId: string) {
    const proxy = await this.findById(proxyId);
    if (proxy.assignedAccountId && proxy.assignedAccountId !== accountId) {
      throw new ValidationError('Proxy is already assigned to another account');
    }

    return proxyRepository.update(proxyId, {
      assignedAccountId: accountId,
    });
  }

  async releaseFromAccount(proxyId: string) {
    return proxyRepository.update(proxyId, {
      assignedAccountId: null,
    });
  }

  async markFailed(id: string) {
    const proxy = await this.findById(id);
    const failureCount = proxy.failureCount + 1;
    const status = failureCount >= 3 ? ProxyStatus.FAILED : proxy.status;

    return proxyRepository.update(id, {
      failureCount,
      status,
      lastCheckedAt: new Date(),
    });
  }

  async getAvailableProxy() {
    const proxy = await proxyRepository.findAvailable();
    return proxy ? proxyRepository.mapRow(proxy) : null;
  }

  getProxyServerUrl(proxy: { host: string; port: number }): string {
    return `http://${proxy.host}:${proxy.port}`;
  }

  async healthCheck(id: string) {
    const proxyRow = await proxyRepository.findById(id);
    if (!proxyRow) throw new NotFoundError('Proxy', id);

    const proxyUrl = buildProxyUrl(
      proxyRow.host,
      proxyRow.port,
      proxyRow.username,
      proxyRow.password_encrypted,
    );

    const [google, facebook] = await Promise.all([
      checkProxyConnectivity(
        proxyRow.host,
        proxyRow.port,
        proxyRow.username,
        proxyRow.password_encrypted,
      ),
      checkFacebookReachability(proxyUrl),
    ]);

    const ok = google.ok && facebook.ok;

    if (ok) {
      await proxyRepository.update(id, {
        lastCheckedAt: new Date(),
        failureCount: 0,
        status: ProxyStatus.ACTIVE,
      });
    } else {
      await this.markFailed(id);
    }

    await logService.create({
      level: ok ? LogLevel.INFO : LogLevel.WARN,
      category: LogCategory.PROXY,
      message: ok
        ? 'Proxy health check passed (Google + Facebook)'
        : `Proxy health check failed: ${facebook.error ?? google.error}`,
      metadata: { proxyId: id, googleOk: google.ok, facebookOk: facebook.ok },
    });

    return {
      ok,
      latencyMs: facebook.latencyMs,
      googleOk: google.ok,
      facebookOk: facebook.ok,
      error: facebook.error ?? google.error,
    };
  }

  async rotateForAccount(accountId: string) {
    const account = await accountService.findById(accountId);

    if (account.proxyId) {
      await this.releaseFromAccount(account.proxyId);
    }

    const newProxy = await this.getAvailableProxy();
    if (!newProxy) {
      throw new ValidationError('No available proxies for rotation');
    }

    await this.assignToAccount(newProxy.id, accountId);
    await accountService.update(accountId, { proxyId: newProxy.id });

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.PROXY,
      message: `Proxy rotated for account ${accountId}`,
      accountId,
      metadata: { newProxyId: newProxy.id },
    });

    return newProxy;
  }
}

export const proxyService = new ProxyService();
