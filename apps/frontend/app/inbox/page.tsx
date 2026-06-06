import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InboxClient } from '@/components/pages/InboxClient';

export default function InboxPage() {
  return (
    <DashboardLayout title="Inbox" subtitle="Incoming messages and auto-reply templates">
      <InboxClient />
    </DashboardLayout>
  );
}
