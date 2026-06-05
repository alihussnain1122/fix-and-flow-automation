import { Request, Response } from 'express';
import { asyncHandler, sendSuccess, sendPaginated } from '../../utils';
import { schedulerService } from './scheduler.service';
import { CreateScheduleDto, UpdateScheduleDto } from './scheduler.types';

export class SchedulerController {
  findAll = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query;
    const { items, total } = await schedulerService.findAll(
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
    sendPaginated(res, items, total, Number(page) || 1, Number(limit) || 20);
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const schedule = await schedulerService.findById(req.params.id);
    sendSuccess(res, schedule);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateScheduleDto = req.body;
    const schedule = await schedulerService.create(dto);
    sendSuccess(res, schedule, 'Schedule created successfully', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const dto: UpdateScheduleDto = req.body;
    const schedule = await schedulerService.update(req.params.id, dto);
    sendSuccess(res, schedule, 'Schedule updated successfully');
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await schedulerService.delete(req.params.id);
    sendSuccess(res, null, 'Schedule deleted successfully');
  });

  pause = asyncHandler(async (req: Request, res: Response) => {
    const schedule = await schedulerService.pause(req.params.id);
    sendSuccess(res, schedule, 'Schedule paused');
  });

  resume = asyncHandler(async (req: Request, res: Response) => {
    const schedule = await schedulerService.resume(req.params.id);
    sendSuccess(res, schedule, 'Schedule resumed');
  });

  processDue = asyncHandler(async (_req: Request, res: Response) => {
    const processed = await schedulerService.processDueSchedules();
    sendSuccess(res, { processed }, `Processed ${processed} due schedules`);
  });
}

export const schedulerController = new SchedulerController();
