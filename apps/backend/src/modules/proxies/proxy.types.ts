import { Proxy, CreateProxyDto, UpdateProxyDto } from '@fix-and-flow/types';

export interface ProxyRow {
  id: string;
  host: string;
  port: number;
  username: string | null;
  password_encrypted: string | null;
  type: string;
  status: string;
  country: string | null;
  city: string | null;
  assigned_account_id: string | null;
  last_checked_at: Date | null;
  failure_count: number;
  created_at: Date;
  updated_at: Date;
}

export type { Proxy, CreateProxyDto, UpdateProxyDto };
