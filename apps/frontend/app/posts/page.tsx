import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PostsClient } from '@/components/pages/PostsClient';

export default function PostsPage() {
  return (
    <DashboardLayout title="Posts" subtitle="View and manage Marketplace listings">
      <PostsClient />
    </DashboardLayout>
  );
}
