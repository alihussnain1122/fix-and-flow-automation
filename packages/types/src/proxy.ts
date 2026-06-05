export enum ProxyType {
  RESIDENTIAL = 'residential',
  DATACENTER = 'datacenter',
  MOBILE = 'mobile',
}

export enum ProxyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FAILED = 'failed',
}

export interface Proxy {
  id: string;
  host: string;
  port: number;
  username: string | null;
  passwordEncrypted: string | null;
  type: ProxyType;
  status: ProxyStatus;
  country: string | null;
  city: string | null;
  assignedAccountId: string | null;
  lastCheckedAt: Date | null;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProxyDto {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type?: ProxyType;
  country?: string;
  city?: string;
}

export interface UpdateProxyDto {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  type?: ProxyType;
  status?: ProxyStatus;
  country?: string;
  city?: string;
}
