import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardClient } from '@/components/pages/DashboardClient';

export default function DashboardPage() {
  return (
    <DashboardLayout title="Dashboard" subtitle="Overview of your automation system">
      <DashboardClient />
    </DashboardLayout>
  );
}
