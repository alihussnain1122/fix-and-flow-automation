'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, getHealthUrl } from '@/lib/api-client';
import { StatCard } from '@/components/ui/StatCard';
import { Users, FileText, Globe, Inbox } from 'lucide-react';

export function DashboardClient() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [statsRes, healthRes] = await Promise.all([
        api.analytics.dashboard().catch(() => null),
        fetch(getHealthUrl()).then((r) => r.json()).catch(() => null),
      ]);
      if (statsRes) setStats(statsRes);
      if (healthRes?.data) setHealth(healthRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <>
      {error && (
        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-200">
          Backend unavailable — start the API with <code className="font-mono">npm run dev:backend</code>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Active Accounts" value={stats?.activeAccounts ?? '—'} icon={Users} color="blue" />
        <StatCard title="Posts Today" value={stats?.postsToday ?? '—'} icon={FileText} color="green" />
        <StatCard title="Active Proxies" value={stats?.activeProxies ?? '—'} icon={Globe} color="purple" />
        <StatCard title="Unread Messages" value={stats?.unreadMessages ?? '—'} icon={Inbox} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Overview</h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-gray-500">Total Posts</dt><dd className="font-semibold">{stats?.totalPosts ?? '—'}</dd></div>
            <div><dt className="text-gray-500">Published</dt><dd className="font-semibold text-green-600">{stats?.publishedPosts ?? '—'}</dd></div>
            <div><dt className="text-gray-500">Failed</dt><dd className="font-semibold text-red-600">{stats?.failedPosts ?? '—'}</dd></div>
            <div><dt className="text-gray-500">Pending</dt><dd className="font-semibold">{stats?.pendingPosts ?? '—'}</dd></div>
            <div><dt className="text-gray-500">Banned Accounts</dt><dd className="font-semibold">{stats?.bannedAccounts ?? '—'}</dd></div>
            <div><dt className="text-gray-500">Total Proxies</dt><dd className="font-semibold">{stats?.totalProxies ?? '—'}</dd></div>
          </dl>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
          <div className="space-y-3">
            <StatusRow label="Backend API" ok={health?.status === 'healthy'} />
            <StatusRow label="Environment" value={String(health?.environment ?? 'unknown')} />
            <StatusRow label="Last Check" value={health?.timestamp ? new Date(String(health.timestamp)).toLocaleTimeString() : '—'} />
          </div>
        </div>
      </div>
    </>
  );
}

function StatusRow({ label, ok, value }: { label: string; ok?: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      {ok !== undefined ? (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {ok ? 'Online' : 'Offline'}
        </span>
      ) : (
        <span className="text-xs text-gray-500">{value}</span>
      )}
    </div>
  );
}
