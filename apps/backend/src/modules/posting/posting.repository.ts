import { query } from '../../config/database';
import { Post, PostStatus } from '@fix-and-flow/types';

export interface PostRow {
  id: string;
  account_id: string;
  content_template_id: string | null;
  title: string;
  description: string;
  price: string | null;
  image_urls: string[];
  status: string;
  facebook_listing_id: string | null;
  facebook_listing_url: string | null;
  scheduled_at: Date | null;
  published_at: Date | null;
  error_message: string | null;
  retry_count: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export class PostingRepository {
  mapRow(row: PostRow) {
    return {
      id: row.id,
      accountId: row.account_id,
      contentTemplateId: row.content_template_id,
      title: row.title,
      description: row.description,
      price: row.price ? parseFloat(row.price) : null,
      imageUrls: row.image_urls,
      status: row.status as PostStatus,
      facebookListingId: row.facebook_listing_id,
      facebookListingUrl: row.facebook_listing_url,
      scheduledAt: row.scheduled_at,
      publishedAt: row.published_at,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(
    offset: number,
    limit: number,
    filters?: { status?: string; accountId?: string },
  ): Promise<{ items: Post[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters?.accountId) {
      conditions.push(`account_id = $${paramIndex++}`);
      params.push(filters.accountId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM posts ${whereClause}`,
      params,
    );

    const result = await query<PostRow>(
      `SELECT * FROM posts ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset],
    );

    return {
      items: result.rows.map((row) => this.mapRow(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async findById(id: string): Promise<PostRow | null> {
    const result = await query<PostRow>(`SELECT * FROM posts WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  }

  async create(data: {
    accountId: string;
    contentTemplateId?: string;
    title: string;
    description: string;
    price?: number | null;
    imageUrls?: string[];
    scheduledAt?: Date;
    status?: string;
  }): Promise<Post> {
    const result = await query<PostRow>(
      `INSERT INTO posts (account_id, content_template_id, title, description, price, image_urls, scheduled_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.accountId,
        data.contentTemplateId ?? null,
        data.title,
        data.description,
        data.price ?? null,
        JSON.stringify(data.imageUrls ?? []),
        data.scheduledAt ?? null,
        data.status ?? PostStatus.PENDING,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async update(
    id: string,
    data: Partial<{
      status: string;
      facebookListingId: string;
      facebookListingUrl: string;
      errorMessage: string;
      publishedAt: Date;
      retryCount: number;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<Post | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      status: 'status',
      facebookListingId: 'facebook_listing_id',
      facebookListingUrl: 'facebook_listing_url',
      errorMessage: 'error_message',
      publishedAt: 'published_at',
      retryCount: 'retry_count',
      metadata: 'metadata',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      const value = data[key as keyof typeof data];
      if (value !== undefined) {
        fields.push(`${column} = $${paramIndex++}`);
        params.push(key === 'metadata' ? JSON.stringify(value) : value);
      }
    }

    if (fields.length === 0) return this.findById(id).then((r) => (r ? this.mapRow(r) : null));

    params.push(id);
    const result = await query<PostRow>(
      `UPDATE posts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }
}

export const postingRepository = new PostingRepository();
