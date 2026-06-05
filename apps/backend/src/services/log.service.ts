import { LogCategory, LogLevel, CreateLogDto, SystemLog } from '@fix-and-flow/types';
import { query } from '../config/database';
import { logger } from '../config/logger';

interface LogRow {
  id: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  account_id: string | null;
  post_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

function mapRow(row: LogRow): SystemLog {
  return {
    id: row.id,
    level: row.level,
    category: row.category,
    message: row.message,
    accountId: row.account_id,
    postId: row.post_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export class LogService {
  async create(dto: CreateLogDto): Promise<SystemLog> {
    const result = await query<LogRow>(
      `INSERT INTO logs (level, category, message, account_id, post_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.level,
        dto.category,
        dto.message,
        dto.accountId ?? null,
        dto.postId ?? null,
        JSON.stringify(dto.metadata ?? {}),
      ],
    );

    const log = mapRow(result.rows[0]);

    const logMethod = dto.level === LogLevel.ERROR ? 'error' : dto.level === LogLevel.WARN ? 'warn' : 'info';
    logger[logMethod]({ category: dto.category, accountId: dto.accountId, postId: dto.postId }, dto.message);

    return log;
  }

  async findAll(
    page = 1,
    limit = 20,
    filters?: { level?: LogLevel; category?: LogCategory; accountId?: string },
  ): Promise<{ items: SystemLog[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.level) {
      conditions.push(`level = $${paramIndex++}`);
      params.push(filters.level);
    }
    if (filters?.category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(filters.category);
    }
    if (filters?.accountId) {
      conditions.push(`account_id = $${paramIndex++}`);
      params.push(filters.accountId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM logs ${whereClause}`,
      params,
    );

    const result = await query<LogRow>(
      `SELECT * FROM logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset],
    );

    return {
      items: result.rows.map(mapRow),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }
}

export const logService = new LogService();
