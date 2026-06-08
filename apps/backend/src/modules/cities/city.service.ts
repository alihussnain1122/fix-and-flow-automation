import { CreateCityDto, UpdateCityDto } from '@fix-and-flow/types';
import { NotFoundError, ValidationError } from '@fix-and-flow/shared';
import { cityRepository } from './city.repository';
import { cityValidationService } from '../../services/city-validation.service';

export class CityService {
  async findAll(activeOnly = false) {
    return cityRepository.findAll(activeOnly);
  }

  async validateQuery(query: string) {
    return cityValidationService.validate(query);
  }

  async findById(id: string) {
    const city = await cityRepository.findById(id);
    if (!city) throw new NotFoundError('City', id);
    return city;
  }

  async create(dto: CreateCityDto) {
    if (!dto.name?.trim()) throw new ValidationError('City name is required');
    return cityRepository.create(dto);
  }

  async update(id: string, dto: UpdateCityDto) {
    await this.findById(id);
    const updated = await cityRepository.update(id, dto);
    if (!updated) throw new NotFoundError('City', id);
    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    return cityRepository.delete(id);
  }
}

export const cityService = new CityService();
