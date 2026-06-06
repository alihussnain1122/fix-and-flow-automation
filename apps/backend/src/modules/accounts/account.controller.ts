import { Request, Response } from 'express';
import { asyncHandler, sendSuccess, sendPaginated } from '../../utils';
import { accountService } from './account.service';
import { CreateAccountDto, UpdateAccountDto } from './account.types';

export class AccountController {
  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, status, search } = req.query;
    const { items, total } = await accountService.findAll(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      { status: status as string, search: search as string },
    );
    sendPaginated(res, items, total, Number(page) || 1, Number(limit) || 20);
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const account = await accountService.findById(req.params.id);
    sendSuccess(res, account);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateAccountDto = req.body;
    const account = await accountService.create(dto);
    sendSuccess(res, account, 'Account created successfully', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const dto: UpdateAccountDto = req.body;
    const account = await accountService.update(req.params.id, dto);
    sendSuccess(res, account, 'Account updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await accountService.delete(req.params.id);
    sendSuccess(res, null, 'Account deleted successfully');
  });

  verify = asyncHandler(async (req: Request, res: Response) => {
    const result = await accountService.verifyAccount(req.params.id);
    sendSuccess(res, result, 'Account verification completed');
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await accountService.loginAccount(req.params.id);
    sendSuccess(
      res,
      result,
      result.success ? 'Facebook account connected' : 'Facebook login did not complete',
    );
  });

  activate = asyncHandler(async (req: Request, res: Response) => {
    const account = await accountService.activate(req.params.id);
    sendSuccess(res, account, 'Account activated');
  });

  assignProxy = asyncHandler(async (req: Request, res: Response) => {
    const { proxyId } = req.body;
    const account = await accountService.assignProxy(req.params.id, proxyId);
    sendSuccess(res, account, 'Proxy assigned');
  });
}

export const accountController = new AccountController();
