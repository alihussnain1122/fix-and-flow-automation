import { Request, Response } from 'express';
import { asyncHandler, sendSuccess, sendPaginated } from '../../utils';
import { inboxService } from './inbox.service';
import { CreateReplyTemplateDto } from '@fix-and-flow/types';

export class InboxController {
  findMessages = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, accountId, status } = req.query;
    const { items, total } = await inboxService.findMessages(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      { accountId: accountId as string, status: status as string },
    );
    sendPaginated(res, items, total, Number(page) || 1, Number(limit) || 20);
  });

  findMessageById = asyncHandler(async (req: Request, res: Response) => {
    const message = await inboxService.findMessageById(req.params.id);
    sendSuccess(res, message);
  });

  checkInbox = asyncHandler(async (req: Request, res: Response) => {
    const { accountId } = req.params;
    const count = await inboxService.checkInbox(accountId);
    sendSuccess(res, { newMessages: count }, 'Inbox check completed');
  });

  markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const message = await inboxService.markAsRead(req.params.id);
    sendSuccess(res, message, 'Message marked as read');
  });

  getReplyTemplates = asyncHandler(async (_req: Request, res: Response) => {
    const templates = await inboxService.getReplyTemplates();
    sendSuccess(res, templates);
  });

  createReplyTemplate = asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateReplyTemplateDto = req.body;
    const template = await inboxService.createReplyTemplate(dto);
    sendSuccess(res, template, 'Reply template created', 201);
  });
}

export const inboxController = new InboxController();
