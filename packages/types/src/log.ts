export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export enum LogCategory {
  SYSTEM = 'system',
  ACCOUNT = 'account',
  PROXY = 'proxy',
  POSTING = 'posting',
  SCHEDULER = 'scheduler',
  INBOX = 'inbox',
  PLAYWRIGHT = 'playwright',
}

export interface SystemLog {
  id: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  accountId: string | null;
  postId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateLogDto {
  level: LogLevel;
  category: LogCategory;
  message: string;
  accountId?: string;
  postId?: string;
  metadata?: Record<string, unknown>;
}
