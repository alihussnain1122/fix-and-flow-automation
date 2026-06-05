import { Request, Response } from 'express';
import { asyncHandler, sendSuccess, sendPaginated } from '../../utils';
import { postingService } from './posting.service';
import { CreatePostDto } from '@fix-and-flow/types';

export class PostingController {
  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, status, accountId } = req.query;
    const { items, total } = await postingService.findAll(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      { status: status as string, accountId: accountId as string },
    );
    sendPaginated(res, items, total, Number(page) || 1, Number(limit) || 20);
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const post = await postingService.findById(req.params.id);
    sendSuccess(res, post);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const dto: CreatePostDto = req.body;
    const post = await postingService.create(dto);
    sendSuccess(res, post, 'Post created successfully', 201);
  });

  execute = asyncHandler(async (req: Request, res: Response) => {
    await postingService.executePost(req.params.id);
    sendSuccess(res, null, 'Post execution started');
  });

  testInteraction = asyncHandler(async (req: Request, res: Response) => {
    const { accountId } = req.body;
    await postingService.runBasicInteraction(accountId);
    sendSuccess(res, null, 'Basic Facebook interaction completed');
  });
}

export const postingController = new PostingController();
