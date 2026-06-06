import { Router } from 'express';
import { accountController } from './account.controller';

const router = Router();

router.get('/', accountController.findAll);
router.get('/:id', accountController.findById);
router.post('/', accountController.create);
router.patch('/:id', accountController.update);
router.post('/:id/verify', accountController.verify);
router.post('/:id/login', accountController.login);
router.post('/:id/activate', accountController.activate);
router.post('/:id/assign-proxy', accountController.assignProxy);
router.delete('/:id', accountController.delete);

export default router;
