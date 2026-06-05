import { Router } from 'express';
import { proxyController } from './proxy.controller';

const router = Router();

router.get('/', proxyController.findAll);
router.get('/:id', proxyController.findById);
router.post('/', proxyController.create);
router.patch('/:id', proxyController.update);
router.delete('/:id', proxyController.delete);

export default router;
