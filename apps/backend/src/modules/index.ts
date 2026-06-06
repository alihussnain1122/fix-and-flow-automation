import { Router } from 'express';
import { accountRoutes } from './accounts';
import { proxyRoutes } from './proxies';
import { contentRoutes } from './content';
import { postingRoutes } from './posting';
import { schedulerRoutes } from './scheduler';
import { inboxRoutes } from './inbox';
import { analyticsRoutes } from './analytics';
import { logRoutes } from './logs';

import { cityRoutes } from './cities';
import { leadRoutes } from './leads';
import systemRoutes from './system/system.routes';

const router = Router();

router.use('/accounts', accountRoutes);
router.use('/proxies', proxyRoutes);
router.use('/content', contentRoutes);
router.use('/posts', postingRoutes);
router.use('/schedules', schedulerRoutes);
router.use('/inbox', inboxRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/logs', logRoutes);
router.use('/cities', cityRoutes);
router.use('/leads', leadRoutes);
router.use('/system', systemRoutes);

export default router;
