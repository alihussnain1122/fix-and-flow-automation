import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AccountsClient } from '@/components/pages/AccountsClient';

export default function AccountsPage() {
  return (
    <DashboardLayout title="Accounts" subtitle="Manage Facebook accounts and credentials">
      <AccountsClient />
    </DashboardLayout>
  );
}
