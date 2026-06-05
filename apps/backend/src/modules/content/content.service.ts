import { CreateContentDto, UpdateContentDto, ContentRotationResult } from '@fix-and-flow/types';
import { NotFoundError, ValidationError } from '@fix-and-flow/shared';
import { parsePagination } from '@fix-and-flow/shared';
import { contentRepository } from './content.repository';

export class ContentService {
  async findAll(page?: number, limit?: number, filters?: { isActive?: boolean; city?: string }) {
    const { offset, limit: l } = parsePagination(page, limit);
    return contentRepository.findAll(offset, l, filters);
  }

  async findById(id: string) {
    const content = await contentRepository.findById(id);
    if (!content) throw new NotFoundError('Content template', id);
    return contentRepository.mapRow(content);
  }

  async create(dto: CreateContentDto) {
    if (!dto.title?.trim()) throw new ValidationError('Title is required');
    if (!dto.description?.trim()) throw new ValidationError('Description is required');

    return contentRepository.create({
      title: dto.title,
      description: dto.description,
      price: dto.price,
      category: dto.category,
      city: dto.city,
      imageUrls: dto.imageUrls,
    });
  }

  async update(id: string, dto: UpdateContentDto) {
    await this.findById(id);

    const updateData: Parameters<typeof contentRepository.update>[1] = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.imageUrls !== undefined) updateData.imageUrls = dto.imageUrls;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updated = await contentRepository.update(id, updateData);
    if (!updated) throw new NotFoundError('Content template', id);
    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    return contentRepository.delete(id);
  }

  async rotateContent(city?: string): Promise<ContentRotationResult | null> {
    const template = await contentRepository.findNextForRotation(city);
    if (!template) return null;

    const mapped = contentRepository.mapRow(template);

    await contentRepository.update(template.id, {
      usageCount: mapped.usageCount + 1,
      lastUsedAt: new Date(),
    });

    return {
      templateId: mapped.id,
      title: mapped.title,
      description: mapped.description,
      price: mapped.price,
      imageUrls: mapped.imageUrls,
    };
  }
}

export const contentService = new ContentService();
