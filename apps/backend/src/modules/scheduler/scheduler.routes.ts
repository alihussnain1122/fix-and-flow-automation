import { Router } from 'express';
import { schedulerController } from './scheduler.controller';

const router = Router();

router.get('/', schedulerController.findAll);
router.post('/process-due', schedulerController.processDue);
router.get('/:id', schedulerController.findById);
router.post('/', schedulerController.create);
router.patch('/:id', schedulerController.update);
router.delete('/:id', schedulerController.delete);
router.post('/:id/pause', schedulerController.pause);
router.post('/:id/resume', schedulerController.resume);

export default router;
