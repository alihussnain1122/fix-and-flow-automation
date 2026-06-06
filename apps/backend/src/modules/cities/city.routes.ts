import { Router } from 'express';
import { cityController } from './city.controller';

const router = Router();

router.get('/', cityController.findAll);
router.get('/:id', cityController.findById);
router.post('/', cityController.create);
router.patch('/:id', cityController.update);
router.delete('/:id', cityController.delete);

export default router;
