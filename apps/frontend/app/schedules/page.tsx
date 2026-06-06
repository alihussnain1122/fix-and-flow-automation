import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SchedulesClient } from '@/components/pages/SchedulesClient';

export default function SchedulesPage() {
  return (
    <DashboardLayout title="Schedules" subtitle="Automated posting schedules per account">
      <SchedulesClient />
    </DashboardLayout>
  );
}
