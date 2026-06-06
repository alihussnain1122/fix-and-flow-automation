import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../../utils';
import { cityService } from './city.service';
import { CreateCityDto, UpdateCityDto } from '@fix-and-flow/types';

export class CityController {
  findAll = asyncHandler(async (req: Request, res: Response) => {
    const activeOnly = req.query.activeOnly === 'true';
    const cities = await cityService.findAll(activeOnly);
    sendSuccess(res, cities);
  });

  findById = asyncHandler(async (req: Request, res: Response) => {
    const city = await cityService.findById(req.params.id);
    sendSuccess(res, city);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const dto: CreateCityDto = req.body;
    const city = await cityService.create(dto);
    sendSuccess(res, city, 'City created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const dto: UpdateCityDto = req.body;
    const city = await cityService.update(req.params.id, dto);
    sendSuccess(res, city, 'City updated');
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await cityService.delete(req.params.id);
    sendSuccess(res, null, 'City deleted');
  });
}

export const cityController = new CityController();
