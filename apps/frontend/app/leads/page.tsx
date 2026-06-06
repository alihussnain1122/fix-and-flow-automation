import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LeadsClient } from '@/components/pages/CitiesClient';

export default function LeadsPage() {
  return (
    <DashboardLayout title="Leads" subtitle="Inbox leads converted to calls">
      <LeadsClient />
    </DashboardLayout>
  );
}
