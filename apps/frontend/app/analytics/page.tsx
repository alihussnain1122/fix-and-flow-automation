'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { api } from '@/lib/api-client';
import { StatCard } from '@/components/ui/StatCard';
import { BarChart3, TrendingUp, Users } from 'lucide-react';

export default function AnalyticsPage() {
  const [performance, setPerformance] = useState<Record<string, unknown>[]>([]);
  const [timeline, setTimeline] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    try {
      const [perf, time, dash] = await Promise.all([
        api.analytics.accountPerformance(),
        api.analytics.postsOverTime(7),
        api.analytics.dashboard(),
      ]);
      setPerformance(perf);
      setTimeline(time);
      setStats(dash);
    } catch { /* backend may be offline */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const successRate = stats && stats.totalPosts
    ? Math.round((stats.publishedPosts / stats.totalPosts) * 100)
    : 0;

  return (
    <DashboardLayout title="Analytics" subtitle="Performance metrics and reporting">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Success Rate" value={`${successRate}%`} icon={TrendingUp} color="green" />
        <StatCard title="Total Posts" value={stats?.totalPosts ?? '—'} icon={BarChart3} color="blue" />
        <StatCard title="Active Accounts" value={stats?.activeAccounts ?? '—'} icon={Users} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Posts Over Time (7 days)</h3>
          {timeline.length ? (
            <div className="space-y-2">
              {timeline.map((d) => (
                <div key={String(d.date)} className="flex justify-between text-sm py-2 border-b border-gray-100">
                  <span className="text-gray-600">{String(d.date)}</span>
                  <span>
                    <span className="text-green-600 font-medium">{String(d.published)} published</span>
                    {' / '}
                    <span className="text-red-600">{String(d.failed)} failed</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No post data yet.</p>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Account Performance</h3>
          {performance.length ? (
            <div className="space-y-2">
              {performance.map((a) => (
                <div key={String(a.accountId)} className="flex justify-between text-sm py-2 border-b border-gray-100">
                  <span className="text-gray-700 truncate max-w-[200px]">{String(a.email)}</span>
                  <span className="font-medium">{String(a.successRate)}% success</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No account performance data yet.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
