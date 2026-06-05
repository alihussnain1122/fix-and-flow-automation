import { query } from '../../config/database';
import { DashboardStats, PostsOverTime, AccountPerformance } from './analytics.types';

export class AnalyticsRepository {
  async getDashboardStats(): Promise<DashboardStats> {
    const result = await query<{
      total_accounts: string;
      active_accounts: string;
      banned_accounts: string;
      total_posts: string;
      published_posts: string;
      failed_posts: string;
      pending_posts: string;
      total_proxies: string;
      active_proxies: string;
      unread_messages: string;
      posts_today: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM accounts) as total_accounts,
        (SELECT COUNT(*) FROM accounts WHERE status = 'active') as active_accounts,
        (SELECT COUNT(*) FROM accounts WHERE status = 'banned') as banned_accounts,
        (SELECT COUNT(*) FROM posts) as total_posts,
        (SELECT COUNT(*) FROM posts WHERE status = 'published') as published_posts,
        (SELECT COUNT(*) FROM posts WHERE status = 'failed') as failed_posts,
        (SELECT COUNT(*) FROM posts WHERE status IN ('pending', 'queued', 'in_progress')) as pending_posts,
        (SELECT COUNT(*) FROM proxies) as total_proxies,
        (SELECT COUNT(*) FROM proxies WHERE status = 'active') as active_proxies,
        (SELECT COUNT(*) FROM messages WHERE status = 'unread') as unread_messages,
        (SELECT COUNT(*) FROM posts WHERE published_at >= CURRENT_DATE) as posts_today
    `);

    const row = result.rows[0];
    return {
      totalAccounts: parseInt(row.total_accounts, 10),
      activeAccounts: parseInt(row.active_accounts, 10),
      bannedAccounts: parseInt(row.banned_accounts, 10),
      totalPosts: parseInt(row.total_posts, 10),
      publishedPosts: parseInt(row.published_posts, 10),
      failedPosts: parseInt(row.failed_posts, 10),
      pendingPosts: parseInt(row.pending_posts, 10),
      totalProxies: parseInt(row.total_proxies, 10),
      activeProxies: parseInt(row.active_proxies, 10),
      unreadMessages: parseInt(row.unread_messages, 10),
      postsToday: parseInt(row.posts_today, 10),
    };
  }

  async getPostsOverTime(days = 7): Promise<PostsOverTime[]> {
    const result = await query<{ date: string; published: string; failed: string }>(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM posts
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
    );

    return result.rows.map((row) => ({
      date: row.date,
      published: parseInt(row.published, 10),
      failed: parseInt(row.failed, 10),
    }));
  }

  async getAccountPerformance(): Promise<AccountPerformance[]> {
    const result = await query<{
      account_id: string;
      email: string;
      posts_published: string;
      posts_failed: string;
    }>(`
      SELECT
        a.id as account_id,
        a.email,
        COUNT(p.id) FILTER (WHERE p.status = 'published') as posts_published,
        COUNT(p.id) FILTER (WHERE p.status = 'failed') as posts_failed
      FROM accounts a
      LEFT JOIN posts p ON p.account_id = a.id
      GROUP BY a.id, a.email
      ORDER BY posts_published DESC
    `);

    return result.rows.map((row) => {
      const published = parseInt(row.posts_published, 10);
      const failed = parseInt(row.posts_failed, 10);
      const total = published + failed;
      return {
        accountId: row.account_id,
        email: row.email,
        postsPublished: published,
        postsFailed: failed,
        successRate: total > 0 ? Math.round((published / total) * 100) : 0,
      };
    });
  }
}

export const analyticsRepository = new AnalyticsRepository();
