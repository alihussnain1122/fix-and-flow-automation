import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CitiesClient } from '@/components/pages/CitiesClient';

export default function CitiesPage() {
  return (
    <DashboardLayout title="Cities" subtitle="Target cities for Marketplace listings">
      <CitiesClient />
    </DashboardLayout>
  );
}
