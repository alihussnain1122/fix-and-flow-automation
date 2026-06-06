import { accountService } from '../modules/accounts/account.service';
import { proxyService } from '../modules/proxies/proxy.service';
import { decrypt, encrypt } from '../utils/encryption';
import { env } from '../config/env';
import { parseProxyServerUrl } from '../utils/network';
import { PostingCredentials, ProxyConfig } from '../modules/posting/posting.types';

function resolveGlobalProxy(): ProxyConfig | undefined {
  if (!env.PLAYWRIGHT_GLOBAL_PROXY) return undefined;

  const parsed = parseProxyServerUrl(env.PLAYWRIGHT_GLOBAL_PROXY);
  if (!parsed) return { server: env.PLAYWRIGHT_GLOBAL_PROXY };

  const auth =
    parsed.username && parsed.password
      ? `${parsed.username}:${parsed.password}@`
      : parsed.username
        ? `${parsed.username}@`
        : '';

  return {
    server: `http://${parsed.host}:${parsed.port}`,
    username: parsed.username,
    password: parsed.password,
  };
}

export class CredentialsService {
  async buildForAccount(accountId: string): Promise<PostingCredentials & { password?: string }> {
    const account = await accountService.findById(accountId);
    const cookies = await accountService.getDecryptedCookies(accountId);
    let password: string | undefined;

    try {
      password = await accountService.getDecryptedPassword(accountId);
    } catch {
      password = undefined;
    }

    let proxy: ProxyConfig | undefined;
    if (account.proxyId) {
      const proxyData = await proxyService.findById(account.proxyId);
      proxy = {
        server: proxyService.getProxyServerUrl(proxyData),
        username: proxyData.username ?? undefined,
        password: proxyData.passwordEncrypted
          ? decrypt(proxyData.passwordEncrypted)
          : undefined,
      };
    } else {
      proxy = resolveGlobalProxy();
    }

    return {
      accountId,
      email: account.email,
      password,
      cookies: cookies ?? undefined,
      userAgent: account.userAgent ?? undefined,
      proxy,
    };
  }

  async saveCookies(accountId: string, cookiesJson: string): Promise<void> {
    await accountService.update(accountId, { cookies: cookiesJson });
  }

  async saveCookiesFromSession(accountId: string, cookies: unknown[]): Promise<void> {
    await this.saveCookies(accountId, JSON.stringify(cookies));
  }
}

export const credentialsService = new CredentialsService();
