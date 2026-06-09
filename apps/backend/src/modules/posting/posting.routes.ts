import { Router } from 'express';
import { postingController } from './posting.controller';

const router = Router();

router.get('/', postingController.findAll);
router.get('/automation/settings', postingController.getAutomationSettings);
router.get('/automation/kpi', postingController.getAutomationKpi);
router.patch('/automation/settings', postingController.setAutomationSettings);
router.get('/:id', postingController.findById);
router.patch('/:id', postingController.update);
router.delete('/:id', postingController.delete);
router.post('/', postingController.create);
router.post('/test-interaction', postingController.testInteraction);
router.post('/:id/execute', postingController.execute);

export default router;
