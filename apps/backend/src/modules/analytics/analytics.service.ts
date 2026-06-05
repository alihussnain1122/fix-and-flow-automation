import { analyticsRepository } from './analytics.repository';

export class AnalyticsService {
  async getDashboardStats() {
    return analyticsRepository.getDashboardStats();
  }

  async getPostsOverTime(days = 7) {
    return analyticsRepository.getPostsOverTime(days);
  }

  async getAccountPerformance() {
    return analyticsRepository.getAccountPerformance();
  }
}

export const analyticsService = new AnalyticsService();
