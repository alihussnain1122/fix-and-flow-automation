import { query } from '../../config/database';
import { AccountRow, AccountFilters } from './account.types';
import { Account, AccountStatus } from '@fix-and-flow/types';

export class AccountRepository {
  mapRow(row: AccountRow) {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      status: row.status as AccountStatus,
      proxyId: row.proxy_id,
      cookiesEncrypted: row.cookies_encrypted,
      userAgent: row.user_agent,
      lastLoginAt: row.last_login_at,
      lastPostAt: row.last_post_at,
      postsToday: row.posts_today,
      dailyPostLimit: row.daily_post_limit,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(
    offset: number,
    limit: number,
    filters?: AccountFilters,
  ): Promise<{ items: Account[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters?.proxyId) {
      conditions.push(`proxy_id = $${paramIndex++}`);
      params.push(filters.proxyId);
    }
    if (filters?.search) {
      conditions.push(`(email ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM accounts ${whereClause}`,
      params,
    );

    const result = await query<AccountRow>(
      `SELECT id, email, password_encrypted, display_name, status, proxy_id,
              cookies_encrypted, user_agent, last_login_at, last_post_at,
              posts_today, daily_post_limit, metadata, created_at, updated_at
       FROM accounts ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset],
    );

    return {
      items: result.rows.map((row) => this.mapRow(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async findById(id: string): Promise<AccountRow | null> {
    const result = await query<AccountRow>(
      `SELECT * FROM accounts WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<AccountRow | null> {
    const result = await query<AccountRow>(
      `SELECT * FROM accounts WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async create(data: {
    email: string;
    passwordEncrypted: string;
    displayName?: string;
    proxyId?: string;
    userAgent?: string;
    dailyPostLimit?: number;
  }): Promise<Account> {
    const result = await query<AccountRow>(
      `INSERT INTO accounts (email, password_encrypted, display_name, proxy_id, user_agent, daily_post_limit)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.email,
        data.passwordEncrypted,
        data.displayName ?? null,
        data.proxyId ?? null,
        data.userAgent ?? null,
        data.dailyPostLimit ?? 5,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async update(
    id: string,
    data: Partial<{
      displayName: string;
      status: string;
      proxyId: string | null;
      cookiesEncrypted: string;
      userAgent: string;
      dailyPostLimit: number;
      lastLoginAt: Date;
      lastPostAt: Date;
      postsToday: number;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<Account | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      displayName: 'display_name',
      status: 'status',
      proxyId: 'proxy_id',
      cookiesEncrypted: 'cookies_encrypted',
      userAgent: 'user_agent',
      dailyPostLimit: 'daily_post_limit',
      lastLoginAt: 'last_login_at',
      lastPostAt: 'last_post_at',
      postsToday: 'posts_today',
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
    const result = await query<AccountRow>(
      `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await query(`DELETE FROM accounts WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getPasswordEncrypted(id: string): Promise<string | null> {
    const result = await query<{ password_encrypted: string }>(
      `SELECT password_encrypted FROM accounts WHERE id = $1`,
      [id],
    );
    return result.rows[0]?.password_encrypted ?? null;
  }

  async getCookiesEncrypted(id: string): Promise<string | null> {
    const result = await query<{ cookies_encrypted: string }>(
      `SELECT cookies_encrypted FROM accounts WHERE id = $1`,
      [id],
    );
    return result.rows[0]?.cookies_encrypted ?? null;
  }
}

export const accountRepository = new AccountRepository();
