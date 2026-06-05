import { Router } from 'express';
import { accountController } from './account.controller';

const router = Router();

router.get('/', accountController.findAll);
router.get('/:id', accountController.findById);
router.post('/', accountController.create);
router.patch('/:id', accountController.update);
router.delete('/:id', accountController.delete);

export default router;
