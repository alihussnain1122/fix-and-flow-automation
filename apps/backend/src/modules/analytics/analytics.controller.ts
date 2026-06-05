import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils';
import { analyticsService } from './analytics.service';

export class AnalyticsController {
  getDashboardStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await analyticsService.getDashboardStats();
    sendSuccess(res, stats);
  });

  getPostsOverTime = asyncHandler(async (req: Request, res: Response) => {
    const days = req.query.days ? Number(req.query.days) : 7;
    const data = await analyticsService.getPostsOverTime(days);
    sendSuccess(res, data);
  });

  getAccountPerformance = asyncHandler(async (_req: Request, res: Response) => {
    const data = await analyticsService.getAccountPerformance();
    sendSuccess(res, data);
  });
}

export const analyticsController = new AnalyticsController();
