export interface DashboardStats {
  totalAccounts: number;
  activeAccounts: number;
  bannedAccounts: number;
  totalPosts: number;
  publishedPosts: number;
  failedPosts: number;
  pendingPosts: number;
  totalProxies: number;
  activeProxies: number;
  unreadMessages: number;
  postsToday: number;
}

export interface PostsOverTime {
  date: string;
  published: number;
  failed: number;
}

export interface AccountPerformance {
  accountId: string;
  email: string;
  postsPublished: number;
  postsFailed: number;
  successRate: number;
}
