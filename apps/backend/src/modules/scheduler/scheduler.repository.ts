import { query } from '../../config/database';
import { ScheduleRow } from './scheduler.types';
import { Schedule, ScheduleStatus } from '@fix-and-flow/types';

export class SchedulerRepository {
  mapRow(row: ScheduleRow) {
    return {
      id: row.id,
      accountId: row.account_id,
      cronExpression: row.cron_expression,
      minIntervalMinutes: row.min_interval_minutes,
      maxIntervalMinutes: row.max_interval_minutes,
      dailyPostLimit: row.daily_post_limit,
      status: row.status as ScheduleStatus,
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(offset: number, limit: number): Promise<{ items: Schedule[]; total: number }> {
    const countResult = await query<{ count: string }>(`SELECT COUNT(*) as count FROM schedules`);

    const result = await query<ScheduleRow>(
      `SELECT * FROM schedules ORDER BY next_run_at ASC NULLS LAST
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return {
      items: result.rows.map((row) => this.mapRow(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async findById(id: string): Promise<ScheduleRow | null> {
    const result = await query<ScheduleRow>(`SELECT * FROM schedules WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  }

  async findByAccountId(accountId: string): Promise<ScheduleRow | null> {
    const result = await query<ScheduleRow>(
      `SELECT * FROM schedules WHERE account_id = $1`,
      [accountId],
    );
    return result.rows[0] ?? null;
  }

  async findDueSchedules(): Promise<ScheduleRow[]> {
    const result = await query<ScheduleRow>(
      `SELECT * FROM schedules
       WHERE status = 'active' AND (next_run_at IS NULL OR next_run_at <= NOW())
       ORDER BY next_run_at ASC NULLS FIRST`,
    );
    return result.rows;
  }

  async create(data: {
    accountId: string;
    cronExpression?: string;
    minIntervalMinutes?: number;
    maxIntervalMinutes?: number;
    dailyPostLimit?: number;
    nextRunAt?: Date;
  }): Promise<Schedule> {
    const result = await query<ScheduleRow>(
      `INSERT INTO schedules (account_id, cron_expression, min_interval_minutes, max_interval_minutes, daily_post_limit, next_run_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.accountId,
        data.cronExpression ?? null,
        data.minIntervalMinutes ?? 60,
        data.maxIntervalMinutes ?? 240,
        data.dailyPostLimit ?? 5,
        data.nextRunAt ?? new Date(),
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async update(
    id: string,
    data: Partial<{
      cronExpression: string;
      minIntervalMinutes: number;
      maxIntervalMinutes: number;
      dailyPostLimit: number;
      status: string;
      nextRunAt: Date;
      lastRunAt: Date;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<Schedule | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      cronExpression: 'cron_expression',
      minIntervalMinutes: 'min_interval_minutes',
      maxIntervalMinutes: 'max_interval_minutes',
      dailyPostLimit: 'daily_post_limit',
      status: 'status',
      nextRunAt: 'next_run_at',
      lastRunAt: 'last_run_at',
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
    const result = await query<ScheduleRow>(
      `UPDATE schedules SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await query(`DELETE FROM schedules WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export const schedulerRepository = new SchedulerRepository();
