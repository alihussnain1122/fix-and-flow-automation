import path from 'path';
import fs from 'fs';
import os from 'os';
import https from 'https';
import http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from '../config/logger';
import { decrypt } from '../utils/encryption';

export async function downloadImageToTemp(url: string): Promise<string> {
  const ext = path.extname(new URL(url).pathname) || '.jpg';
  const tempPath = path.join(os.tmpdir(), `fix-flow-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempPath);
    const client = url.startsWith('https') ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          downloadImageToTemp(response.headers.location).then(resolve).catch(reject);
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(tempPath);
        });
      })
      .on('error', (err) => {
        fs.unlink(tempPath, () => undefined);
        reject(err);
      });
  });
}

export async function cleanupTempFiles(paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (err) {
      logger.warn({ path: p, err }, 'Failed to cleanup temp file');
    }
  }
}

export async function checkProxyConnectivity(
  host: string,
  port: number,
  username?: string | null,
  passwordEncrypted?: string | null,
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const proxyUrl = buildProxyUrl(host, port, username, passwordEncrypted);
  return checkUrlThroughProxy('https://www.google.com/generate_204', proxyUrl);
}

export function buildProxyUrl(
  host: string,
  port: number,
  username?: string | null,
  passwordEncrypted?: string | null,
): string {
  const auth =
    username && passwordEncrypted
      ? `${username}:${decrypt(passwordEncrypted)}@`
      : username
        ? `${username}@`
        : '';
  return `http://${auth}${host}:${port}`;
}

export function parseProxyServerUrl(serverUrl: string): ProxyConfigParsed | null {
  try {
    const url = new URL(serverUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 80,
      username: url.username || undefined,
      password: url.password || undefined,
    };
  } catch {
    return null;
  }
}

export interface ProxyConfigParsed {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

function checkUrlThroughProxy(
  targetUrl: string,
  proxyUrl?: string,
): Promise<{ ok: boolean; latencyMs: number; error?: string; statusCode?: number }> {
  const start = Date.now();

  return new Promise((resolve) => {
    const options: https.RequestOptions = { timeout: 15000, rejectUnauthorized: true };
    if (proxyUrl) {
      options.agent = new HttpsProxyAgent(proxyUrl);
    }

    const req = https.get(targetUrl, options, (res) => {
      res.resume();
      resolve({
        ok: (res.statusCode ?? 0) < 500,
        latencyMs: Date.now() - start,
        statusCode: res.statusCode,
      });
    });

    req.on('error', (err) => {
      resolve({ ok: false, latencyMs: Date.now() - start, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, latencyMs: Date.now() - start, error: 'Timeout' });
    });
  });
}

export async function checkFacebookReachability(proxyUrl?: string): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
  url?: string;
}> {
  const targets = [
    'https://www.facebook.com/robots.txt',
    'https://m.facebook.com/robots.txt',
  ];

  for (const url of targets) {
    const result = await checkUrlThroughProxy(url, proxyUrl);
    if (result.ok) {
      return { ok: true, latencyMs: result.latencyMs, url };
    }
  }

  const last = await checkUrlThroughProxy(targets[0], proxyUrl);
  return {
    ok: false,
    latencyMs: last.latencyMs,
    error: last.error ?? 'Facebook unreachable',
    url: targets[0],
  };
}
