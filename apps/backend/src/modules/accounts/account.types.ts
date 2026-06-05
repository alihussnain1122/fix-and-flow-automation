import { Account, CreateAccountDto, UpdateAccountDto } from '@fix-and-flow/types';

export interface AccountRow {
  id: string;
  email: string;
  password_encrypted: string;
  display_name: string | null;
  status: string;
  proxy_id: string | null;
  cookies_encrypted: string | null;
  user_agent: string | null;
  last_login_at: Date | null;
  last_post_at: Date | null;
  posts_today: number;
  daily_post_limit: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface AccountFilters {
  status?: string;
  proxyId?: string;
  search?: string;
}

export type { Account, CreateAccountDto, UpdateAccountDto };
