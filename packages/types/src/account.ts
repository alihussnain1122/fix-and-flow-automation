export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
  FLAGGED = 'flagged',
  SUSPENDED = 'suspended',
}

export interface Account {
  id: string;
  email: string;
  displayName: string | null;
  status: AccountStatus;
  proxyId: string | null;
  cookiesEncrypted: string | null;
  userAgent: string | null;
  lastLoginAt: Date | null;
  lastPostAt: Date | null;
  postsToday: number;
  dailyPostLimit: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccountDto {
  email: string;
  password: string;
  displayName?: string;
  proxyId?: string;
  userAgent?: string;
  dailyPostLimit?: number;
}

export interface UpdateAccountDto {
  displayName?: string;
  status?: AccountStatus;
  proxyId?: string | null;
  userAgent?: string;
  dailyPostLimit?: number;
  cookies?: string;
  metadata?: Record<string, unknown>;
}
