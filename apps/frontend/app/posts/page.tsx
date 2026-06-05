import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileText, Plus } from 'lucide-react';

export default function PostsPage() {
  return (
    <DashboardLayout
      title="Posts"
      subtitle="View and manage Marketplace listings"
    >
      <div className="flex justify-end mb-6">
        <button type="button" className="btn-primary">
          <Plus className="w-4 h-4" />
          Create Post
        </button>
      </div>

      <EmptyState
        icon={FileText}
        title="No posts yet"
        description="Posts will appear here once you create listings or the scheduler queues automated posts for your accounts."
        action={
          <button type="button" className="btn-primary">
            <Plus className="w-4 h-4" />
            Create Post
          </button>
        }
      />
    </DashboardLayout>
  );
}
