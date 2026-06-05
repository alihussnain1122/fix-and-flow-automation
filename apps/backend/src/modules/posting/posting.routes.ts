import { Router } from 'express';
import { postingController } from './posting.controller';

const router = Router();

router.get('/', postingController.findAll);
router.get('/:id', postingController.findById);
router.post('/', postingController.create);
router.post('/test-interaction', postingController.testInteraction);
router.post('/:id/execute', postingController.execute);

export default router;
