import { Router } from 'express';
import { accountRoutes } from './accounts';
import { proxyRoutes } from './proxies';
import { contentRoutes } from './content';
import { postingRoutes } from './posting';
import { schedulerRoutes } from './scheduler';
import { inboxRoutes } from './inbox';
import { analyticsRoutes } from './analytics';
import { logRoutes } from './logs';

const router = Router();

router.use('/accounts', accountRoutes);
router.use('/proxies', proxyRoutes);
router.use('/content', contentRoutes);
router.use('/posts', postingRoutes);
router.use('/schedules', schedulerRoutes);
router.use('/inbox', inboxRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/logs', logRoutes);

export default router;
