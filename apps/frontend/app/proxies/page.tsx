import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProxiesClient } from '@/components/pages/ProxiesClient';

export default function ProxiesPage() {
  return (
    <DashboardLayout title="Proxies" subtitle="Manage residential and datacenter proxies">
      <ProxiesClient />
    </DashboardLayout>
  );
}
