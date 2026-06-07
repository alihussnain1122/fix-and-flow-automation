import { Browser, BrowserContext, Page } from 'playwright';
import { AccountHealthResult } from './account-health';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

export interface PostingCredentials {
  accountId: string;
  email?: string;
  password?: string;
  cookies?: string;
  userAgent?: string;
  proxy?: ProxyConfig;
}

export interface ListingData {
  title: string;
  description: string;
  price: number | null;
  imageUrls: string[];
  category?: string;
  city?: string;
}

export interface PostingResult {
  success: boolean;
  listingId?: string;
  listingUrl?: string;
  error?: string;
}

export interface PlaywrightConfig {
  headless: boolean;
  slowMo: number;
  timeout: number;
}

export interface SessionCallbacks {
  onCookiesUpdated?: (cookies: unknown[]) => Promise<void>;
  onAccountHealth?: (health: AccountHealthResult) => Promise<void>;
}

export interface InboxMessage {
  conversationId: string;
  senderName: string;
  content: string;
  facebookMessageId?: string;
}

export interface InboxScrapeResult {
  messages: InboxMessage[];
  accountHealth: AccountHealthResult;
  cookies?: unknown[];
}

export interface VerifyAccountResult {
  success: boolean;
  status: string;
  isLoggedIn: boolean;
  reason?: string;
  cookies?: unknown[];
  diagnostics?: {
    facebookReachable?: boolean;
    usedProxy?: boolean;
    proxyFallback?: boolean;
    facebookUrl?: string;
    recommendation?: string;
  };
}

export interface SessionRunOptions {
  onProxyFailure?: () => Promise<void>;
  headless?: boolean;
}

export interface FacebookLoginResult {
  success: boolean;
  status: string;
  isLoggedIn: boolean;
  reason?: string;
  cookiesSaved?: number;
  loginMethod: 'playwright';
  manualAuthCompleted?: boolean;
  manualCaptchaCompleted?: boolean;
  captchaMode?: 'manual' | 'auto';
  diagnostics?: VerifyAccountResult['diagnostics'];
}
