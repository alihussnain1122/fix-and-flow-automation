import { Router } from 'express';
import { contentController } from './content.controller';

const router = Router();

router.get('/', contentController.findAll);
router.get('/rotate', contentController.rotate);
router.get('/:id', contentController.findById);
router.post('/', contentController.create);
router.patch('/:id', contentController.update);
router.delete('/:id', contentController.delete);

export default router;
