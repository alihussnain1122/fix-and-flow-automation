import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Calendar, Plus } from 'lucide-react';

export default function SchedulesPage() {
  return (
    <DashboardLayout
      title="Schedules"
      subtitle="Automated posting schedules per account"
    >
      <div className="flex justify-end mb-6">
        <button type="button" className="btn-primary">
          <Plus className="w-4 h-4" />
          Create Schedule
        </button>
      </div>

      <EmptyState
        icon={Calendar}
        title="No schedules configured"
        description="Set up posting schedules with random intervals (3–5 posts/day per account) using the BullMQ job queue."
      />
    </DashboardLayout>
  );
}
