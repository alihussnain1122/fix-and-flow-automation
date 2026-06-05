import { Request, Response } from 'express';
import { asyncHandler, sendSuccess, sendPaginated } from '../../utils';
import { contentService } from './content.service';
import { CreateContentDto, UpdateContentDto } from './content.types';

export class ContentController {
  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, isActive, city } = req.query;
    const { items, total } = await contentService.findAll(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      {
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        city: city as string,
      },
    );
    sendPaginated(res, items, total, Number(page) || 1, Number(limit) || 20);
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const content = await contentService.findById(req.params.id);
    sendSuccess(res, content);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateContentDto = req.body;
    const content = await contentService.create(dto);
    sendSuccess(res, content, 'Content template created successfully', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const dto: UpdateContentDto = req.body;
    const content = await contentService.update(req.params.id, dto);
    sendSuccess(res, content, 'Content template updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await contentService.delete(req.params.id);
    sendSuccess(res, null, 'Content template deleted successfully');
  });

  rotate = asyncHandler(async (req: Request, res: Response) => {
    const { city } = req.query;
    const result = await contentService.rotateContent(city as string);
    sendSuccess(res, result);
  });
}

export const contentController = new ContentController();
