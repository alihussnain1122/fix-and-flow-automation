import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Inbox } from 'lucide-react';

export default function InboxPage() {
  return (
    <DashboardLayout
      title="Inbox"
      subtitle="Incoming messages and auto-reply templates"
    >
      <EmptyState
        icon={Inbox}
        title="No messages yet"
        description="Inbound Marketplace messages will appear here. Configure auto-reply templates to convert leads automatically."
      />
    </DashboardLayout>
  );
}
