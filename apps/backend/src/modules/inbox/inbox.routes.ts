import { Router } from 'express';
import { inboxController } from './inbox.controller';

const router = Router();

router.get('/messages', inboxController.findMessages);
router.get('/messages/:id', inboxController.findMessageById);
router.patch('/messages/:id/read', inboxController.markAsRead);
router.post('/check/:accountId', inboxController.checkInbox);
router.get('/templates', inboxController.getReplyTemplates);
router.post('/templates', inboxController.createReplyTemplate);

export default router;
