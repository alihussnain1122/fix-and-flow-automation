import { query } from '../../config/database';
import { ContentTemplate } from '@fix-and-flow/types';
import { ContentRow } from './content.types';

export class ContentRepository {
  mapRow(row: ContentRow) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      price: row.price ? parseFloat(row.price) : null,
      category: row.category,
      city: row.city,
      imageUrls: row.image_urls,
      isActive: row.is_active,
      usageCount: row.usage_count,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(
    offset: number,
    limit: number,
    filters?: { isActive?: boolean; city?: string },
  ): Promise<{ items: ContentTemplate[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(filters.isActive);
    }
    if (filters?.city) {
      conditions.push(`city = $${paramIndex++}`);
      params.push(filters.city);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM content_templates ${whereClause}`,
      params,
    );

    const result = await query<ContentRow>(
      `SELECT * FROM content_templates ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset],
    );

    return {
      items: result.rows.map((row) => this.mapRow(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async findById(id: string): Promise<ContentRow | null> {
    const result = await query<ContentRow>(
      `SELECT * FROM content_templates WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findNextForRotation(city?: string, accountId?: string): Promise<ContentRow | null> {
    const params: unknown[] = [];
    let paramIndex = 1;
    let cityFilter = '';
    let dedupFilter = '';

    if (city) {
      cityFilter = `AND (city = $${paramIndex} OR city IS NULL)`;
      params.push(city);
      paramIndex++;
    }

    if (accountId) {
      dedupFilter = `AND id NOT IN (
        SELECT content_template_id FROM content_usage_log
        WHERE account_id = $${paramIndex}
        AND used_at > NOW() - INTERVAL '7 days'
      )`;
      params.push(accountId);
      paramIndex++;
    }

    const result = await query<ContentRow>(
      `SELECT * FROM content_templates
       WHERE is_active = true ${cityFilter} ${dedupFilter}
       ORDER BY usage_count ASC, last_used_at ASC NULLS FIRST
       LIMIT 1`,
      params,
    );
    return result.rows[0] ?? null;
  }

  async create(data: {
    title: string;
    description: string;
    price?: number;
    category?: string;
    city?: string;
    imageUrls?: string[];
  }): Promise<ContentTemplate> {
    const result = await query<ContentRow>(
      `INSERT INTO content_templates (title, description, price, category, city, image_urls)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.title,
        data.description,
        data.price ?? null,
        data.category ?? null,
        data.city ?? null,
        JSON.stringify(data.imageUrls ?? []),
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async update(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      price: number | null;
      category: string;
      city: string;
      imageUrls: string[];
      isActive: boolean;
      usageCount: number;
      lastUsedAt: Date;
    }>,
  ): Promise<ContentTemplate | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      price: 'price',
      category: 'category',
      city: 'city',
      imageUrls: 'image_urls',
      isActive: 'is_active',
      usageCount: 'usage_count',
      lastUsedAt: 'last_used_at',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      const value = data[key as keyof typeof data];
      if (value !== undefined) {
        fields.push(`${column} = $${paramIndex++}`);
        params.push(key === 'imageUrls' ? JSON.stringify(value) : value);
      }
    }

    if (fields.length === 0) return this.findById(id).then((r) => (r ? this.mapRow(r) : null));

    params.push(id);
    const result = await query<ContentRow>(
      `UPDATE content_templates SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await query(`DELETE FROM content_templates WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const contentRepository = new ContentRepository();
