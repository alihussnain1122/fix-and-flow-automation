import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { Users, FileText, Globe, Inbox } from 'lucide-react';

export default function DashboardPage() {
  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Overview of your automation system"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Active Accounts" value="—" icon={Users} color="blue" />
        <StatCard title="Posts Today" value="—" icon={FileText} color="green" />
        <StatCard title="Active Proxies" value="—" icon={Globe} color="purple" />
        <StatCard title="Unread Messages" value="—" icon={Inbox} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <p className="text-sm text-gray-500">
            Connect to the backend API to see live analytics data.
          </p>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
          <div className="space-y-3">
            <StatusRow label="Backend API" status="pending" />
            <StatusRow label="PostgreSQL" status="pending" />
            <StatusRow label="Redis / BullMQ" status="pending" />
            <StatusRow label="Playwright Engine" status="pending" />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatusRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
        {status}
      </span>
    </div>
  );
}
