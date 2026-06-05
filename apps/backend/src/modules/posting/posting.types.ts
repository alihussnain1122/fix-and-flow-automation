import { Browser, BrowserContext, Page } from 'playwright';

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
