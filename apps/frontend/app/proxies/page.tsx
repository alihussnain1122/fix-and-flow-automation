import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Globe, Plus } from 'lucide-react';

export default function ProxiesPage() {
  return (
    <DashboardLayout title="Proxies" subtitle="Manage residential and datacenter proxies">
      <div className="flex justify-end mb-6">
        <button type="button" className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Proxy
        </button>
      </div>

      <EmptyState
        icon={Globe}
        title="No proxies configured"
        description="Assign one proxy per account to rotate IPs and avoid detection. Supports residential, datacenter, and mobile proxies."
      />
    </DashboardLayout>
  );
}
