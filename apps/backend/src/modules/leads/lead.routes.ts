import { Router } from 'express';
import { asyncHandler, sendSuccess, sendPaginated } from '../../utils';
import { leadService } from './lead.service';
import { CreateLeadDto, UpdateLeadDto } from '@fix-and-flow/types';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, status, accountId } = req.query;
    const { items, total } = await leadService.findAll(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      { status: status as string, accountId: accountId as string },
    );
    sendPaginated(res, items, total, Number(page) || 1, Number(limit) || 20);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const dto: CreateLeadDto = req.body;
    const lead = await leadService.create(dto);
    sendSuccess(res, lead, 'Lead created', 201);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const dto: UpdateLeadDto = req.body;
    const lead = await leadService.update(req.params.id, dto);
    sendSuccess(res, lead);
  }),
);

router.post(
  '/:id/convert',
  asyncHandler(async (req, res) => {
    const { notes } = req.body;
    const lead = await leadService.convert(req.params.id, notes);
    sendSuccess(res, lead, 'Lead converted');
  }),
);

export default router;
