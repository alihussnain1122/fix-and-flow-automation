import { Request, Response } from 'express';
import { asyncHandler, sendSuccess, sendPaginated } from '../../utils';
import { proxyService } from './proxy.service';
import { CreateProxyDto, UpdateProxyDto } from './proxy.types';

export class ProxyController {
  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, status, type } = req.query;
    const { items, total } = await proxyService.findAll(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      { status: status as string, type: type as string },
    );
    sendPaginated(res, items, total, Number(page) || 1, Number(limit) || 20);
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const proxy = await proxyService.findById(req.params.id);
    sendSuccess(res, proxy);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateProxyDto = req.body;
    const proxy = await proxyService.create(dto);
    sendSuccess(res, proxy, 'Proxy created successfully', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const dto: UpdateProxyDto = req.body;
    const proxy = await proxyService.update(req.params.id, dto);
    sendSuccess(res, proxy, 'Proxy updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await proxyService.delete(req.params.id);
    sendSuccess(res, null, 'Proxy deleted successfully');
  });

  healthCheck = asyncHandler(async (req: Request, res: Response) => {
    const result = await proxyService.healthCheck(req.params.id);
    sendSuccess(res, result, 'Health check completed');
  });

  rotate = asyncHandler(async (req: Request, res: Response) => {
    const { accountId } = req.body;
    const proxy = await proxyService.rotateForAccount(accountId);
    sendSuccess(res, proxy, 'Proxy rotated');
  });
}

export const proxyController = new ProxyController();
