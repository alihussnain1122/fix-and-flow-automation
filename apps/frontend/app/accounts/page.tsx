import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users, Plus } from 'lucide-react';

export default function AccountsPage() {
  return (
    <DashboardLayout
      title="Accounts"
      subtitle="Manage Facebook accounts and credentials"
    >
      <div className="flex justify-end mb-6">
        <button type="button" className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      <EmptyState
        icon={Users}
        title="No accounts yet"
        description="Add your first Facebook account to start automating Marketplace listings. Each account can be assigned a dedicated proxy."
        action={
          <button type="button" className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        }
      />
    </DashboardLayout>
  );
}
