import { Router } from 'express';
import { analyticsController } from './analytics.controller';

const router = Router();

router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/posts-over-time', analyticsController.getPostsOverTime);
router.get('/account-performance', analyticsController.getAccountPerformance);

export default router;
