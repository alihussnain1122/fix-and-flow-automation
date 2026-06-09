import { query } from '../../config/database';
import { logger } from '../../config/logger';

export class CityRepository {
  mapRow(row: {
    id: string;
    name: string;
    state: string | null;
    country: string;
    is_active: boolean;
    post_count: number;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      id: row.id,
      name: row.name,
      state: row.state,
      country: row.country,
      isActive: row.is_active,
      postCount: row.post_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(activeOnly = false) {
    const where = activeOnly ? 'WHERE is_active = true' : '';
    const result = await query(
      `SELECT * FROM cities ${where} ORDER BY name ASC`,
    );
    return result.rows.map((row) => this.mapRow(row as Parameters<typeof this.mapRow>[0]));
  }

  async findById(id: string) {
    const result = await query(`SELECT * FROM cities WHERE id = $1`, [id]);
    return result.rows[0]
      ? this.mapRow(result.rows[0] as Parameters<typeof this.mapRow>[0])
      : null;
  }

  async create(data: { name: string; state?: string; country?: string }) {
    const result = await query(
      `INSERT INTO cities (name, state, country) VALUES ($1, $2, $3) RETURNING *`,
      [data.name, data.state ?? null, data.country ?? 'US'],
    );
    return this.mapRow(result.rows[0] as Parameters<typeof this.mapRow>[0]);
  }

  async update(
    id: string,
    data: Partial<{ name: string; state: string; country: string; isActive: boolean }>,
  ) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${i++}`);
      params.push(data.name);
    }
    if (data.state !== undefined) {
      fields.push(`state = $${i++}`);
      params.push(data.state);
    }
    if (data.country !== undefined) {
      fields.push(`country = $${i++}`);
      params.push(data.country);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${i++}`);
      params.push(data.isActive);
    }

    if (fields.length === 0) return this.findById(id);

    params.push(id);
    const result = await query(
      `UPDATE cities SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    return result.rows[0]
      ? this.mapRow(result.rows[0] as Parameters<typeof this.mapRow>[0])
      : null;
  }

  async delete(id: string) {
    const result = await query(`DELETE FROM cities WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async incrementPostCount(id: string) {
    await query(`UPDATE cities SET post_count = post_count + 1 WHERE id = $1`, [id]);
  }

  async findNextRotatingCity(): Promise<{ id: string; label: string } | null> {
    const result = await query<{ id: string; name: string; state: string | null }>(
      `SELECT id, name, state FROM cities
       WHERE is_active = true
       ORDER BY post_count ASC, name ASC
       LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) return null;
    const label = row.state ? `${row.name}, ${row.state}` : row.name;
    return { id: row.id, label };
  }
}

export const cityRepository = new CityRepository();

export async function resetDailyPostCounts(): Promise<number> {
  const result = await query(`SELECT reset_daily_post_counts()`);
  logger.info('Daily post counts reset for all accounts');
  return result.rowCount ?? 0;
}
