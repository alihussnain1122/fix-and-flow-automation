import { query } from '../../config/database';
import { ProxyRow } from './proxy.types';
import { Proxy, ProxyStatus, ProxyType } from '@fix-and-flow/types';

export class ProxyRepository {
  mapRow(row: ProxyRow) {
    return {
      id: row.id,
      host: row.host,
      port: row.port,
      username: row.username,
      passwordEncrypted: row.password_encrypted,
      type: row.type as ProxyType,
      status: row.status as ProxyStatus,
      country: row.country,
      city: row.city,
      assignedAccountId: row.assigned_account_id,
      lastCheckedAt: row.last_checked_at,
      failureCount: row.failure_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(
    offset: number,
    limit: number,
    filters?: { status?: string; type?: string },
  ): Promise<{ items: Proxy[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters?.type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(filters.type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM proxies ${whereClause}`,
      params,
    );

    const result = await query<ProxyRow>(
      `SELECT * FROM proxies ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset],
    );

    return {
      items: result.rows.map((row) => this.mapRow(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async findById(id: string): Promise<ProxyRow | null> {
    const result = await query<ProxyRow>(`SELECT * FROM proxies WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  }

  async findAvailable(): Promise<ProxyRow | null> {
    const result = await query<ProxyRow>(
      `SELECT * FROM proxies
       WHERE status = 'active' AND assigned_account_id IS NULL
       ORDER BY failure_count ASC, created_at ASC
       LIMIT 1`,
    );
    return result.rows[0] ?? null;
  }

  async create(data: {
    host: string;
    port: number;
    username?: string;
    passwordEncrypted?: string;
    type?: string;
    country?: string;
    city?: string;
  }): Promise<Proxy> {
    const result = await query<ProxyRow>(
      `INSERT INTO proxies (host, port, username, password_encrypted, type, country, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.host,
        data.port,
        data.username ?? null,
        data.passwordEncrypted ?? null,
        data.type ?? 'residential',
        data.country ?? null,
        data.city ?? null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async update(
    id: string,
    data: Partial<{
      host: string;
      port: number;
      username: string;
      passwordEncrypted: string;
      type: string;
      status: string;
      country: string;
      city: string;
      assignedAccountId: string | null;
      lastCheckedAt: Date;
      failureCount: number;
    }>,
  ): Promise<Proxy | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      host: 'host',
      port: 'port',
      username: 'username',
      passwordEncrypted: 'password_encrypted',
      type: 'type',
      status: 'status',
      country: 'country',
      city: 'city',
      assignedAccountId: 'assigned_account_id',
      lastCheckedAt: 'last_checked_at',
      failureCount: 'failure_count',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      const value = data[key as keyof typeof data];
      if (value !== undefined) {
        fields.push(`${column} = $${paramIndex++}`);
        params.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id).then((r) => (r ? this.mapRow(r) : null));

    params.push(id);
    const result = await query<ProxyRow>(
      `UPDATE proxies SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await query(`DELETE FROM proxies WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const proxyRepository = new ProxyRepository();
