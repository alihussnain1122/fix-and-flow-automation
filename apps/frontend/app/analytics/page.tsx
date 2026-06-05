import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <DashboardLayout
      title="Analytics"
      subtitle="Performance metrics and reporting"
    >
      <div className="card p-8 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <BarChart3 className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics coming soon</h3>
        <p className="text-sm text-gray-500 max-w-md">
          Charts for posts over time, account performance, and success rates will be available
          once data is collected from the automation system.
        </p>
      </div>
    </DashboardLayout>
  );
}
