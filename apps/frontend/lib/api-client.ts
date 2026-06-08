import { ApiResponse, PaginatedResponse } from '@fix-and-flow/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const json: ApiResponse<T> = await res.json().catch(() => ({ success: false, error: 'Request failed' }));
  if (!res.ok || !json.success) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json.data as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const api = {
  health: () => fetch(getHealthUrl()).then((r) => r.json()),

  analytics: {
    dashboard: () => request<Record<string, number>>('/analytics/dashboard'),
    postsOverTime: (days = 7) => request<Array<{ date: string; published: number; failed: number }>>(`/analytics/posts-over-time${qs({ days })}`),
    accountPerformance: () => request<Array<Record<string, unknown>>>('/analytics/account-performance'),
  },

  accounts: {
    list: (page = 1, limit = 20) =>
      request<PaginatedResponse<Record<string, unknown>>>(`/accounts${qs({ page, limit })}`),
    get: (id: string) => request<Record<string, unknown>>(`/accounts/${id}`),
    create: (body: Record<string, unknown>) =>
      request<Record<string, unknown>>('/accounts', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<null>(`/accounts/${id}`, { method: 'DELETE' }),
    verify: (id: string) => request<Record<string, unknown>>(`/accounts/${id}/verify`, { method: 'POST' }),
    login: (id: string) =>
      request<Record<string, unknown>>(`/accounts/${id}/login`, {
        method: 'POST',
        signal: AbortSignal.timeout(300000),
      }),
    activate: (id: string) => request<Record<string, unknown>>(`/accounts/${id}/activate`, { method: 'POST' }),
    assignProxy: (id: string, proxyId?: string) =>
      request<Record<string, unknown>>(`/accounts/${id}/assign-proxy`, {
        method: 'POST',
        body: JSON.stringify({ proxyId }),
      }),
  },

  proxies: {
    list: (page = 1, limit = 20) =>
      request<PaginatedResponse<Record<string, unknown>>>(`/proxies${qs({ page, limit })}`),
    create: (body: Record<string, unknown>) =>
      request<Record<string, unknown>>('/proxies', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => request<null>(`/proxies/${id}`, { method: 'DELETE' }),
    healthCheck: (id: string) =>
      request<Record<string, unknown>>(`/proxies/${id}/health-check`, { method: 'POST' }),
  },

  posts: {
    list: (page = 1, limit = 20) =>
      request<PaginatedResponse<Record<string, unknown>>>(`/posts${qs({ page, limit })}`),
    create: (body: Record<string, unknown>) =>
      request<Record<string, unknown>>('/posts', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, unknown>) =>
      request<Record<string, unknown>>(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<null>(`/posts/${id}`, { method: 'DELETE' }),
    execute: (id: string) => request<null>(`/posts/${id}/execute`, { method: 'POST' }),
    getAutomationSettings: () => request<{ enabled: boolean }>('/posts/automation/settings'),
    setAutomationSettings: (enabled: boolean) =>
      request<{ enabled: boolean }>('/posts/automation/settings', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
  },

  schedules: {
    list: (page = 1, limit = 20) =>
      request<PaginatedResponse<Record<string, unknown>>>(`/schedules${qs({ page, limit })}`),
    create: (body: Record<string, unknown>) =>
      request<Record<string, unknown>>('/schedules', { method: 'POST', body: JSON.stringify(body) }),
    pause: (id: string) => request<Record<string, unknown>>(`/schedules/${id}/pause`, { method: 'POST' }),
    resume: (id: string) => request<Record<string, unknown>>(`/schedules/${id}/resume`, { method: 'POST' }),
    delete: (id: string) => request<null>(`/schedules/${id}`, { method: 'DELETE' }),
  },

  inbox: {
    messages: (page = 1, limit = 20) =>
      request<PaginatedResponse<Record<string, unknown>>>(`/inbox/messages${qs({ page, limit })}`),
    check: (accountId: string) =>
      request<{ newMessages: number }>(`/inbox/check/${accountId}`, { method: 'POST' }),
    templates: () => request<Array<Record<string, unknown>>>('/inbox/templates'),
    createTemplate: (body: Record<string, unknown>) =>
      request<Record<string, unknown>>('/inbox/templates', { method: 'POST', body: JSON.stringify(body) }),
  },

  logs: {
    list: (page = 1, limit = 50) =>
      request<PaginatedResponse<Record<string, unknown>>>(`/logs${qs({ page, limit })}`),
  },

  cities: {
    list: () => request<Array<Record<string, unknown>>>('/cities'),
    validate: (query: string) =>
      request<{ valid: boolean; normalized?: string; reason?: string }>(
        `/cities/validate${qs({ q: query })}`,
      ),
    create: (body: Record<string, unknown>) =>
      request<Record<string, unknown>>('/cities', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => request<null>(`/cities/${id}`, { method: 'DELETE' }),
  },

  content: {
    list: (page = 1, limit = 20) =>
      request<PaginatedResponse<Record<string, unknown>>>(`/content${qs({ page, limit })}`),
    create: (body: Record<string, unknown>) =>
      request<Record<string, unknown>>('/content', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => request<null>(`/content/${id}`, { method: 'DELETE' }),
  },

  leads: {
    list: (page = 1, limit = 20) =>
      request<PaginatedResponse<Record<string, unknown>>>(`/leads${qs({ page, limit })}`),
    convert: (id: string) => request<Record<string, unknown>>(`/leads/${id}/convert`, { method: 'POST' }),
  },
};

export function getHealthUrl(): string {
  return API_URL.replace('/api/v1', '/health');
}
