import { query } from '../../config/database';
import { MessageRow, ReplyTemplateRow } from './inbox.types';
import { Message, MessageDirection, MessageStatus, ReplyTemplate } from '@fix-and-flow/types';

export class InboxRepository {
  mapMessageRow(row: MessageRow) {
    return {
      id: row.id,
      accountId: row.account_id,
      conversationId: row.conversation_id,
      senderName: row.sender_name,
      content: row.content,
      direction: row.direction as MessageDirection,
      status: row.status as MessageStatus,
      isAutoReply: row.is_auto_reply,
      templateId: row.template_id,
      facebookMessageId: row.facebook_message_id,
      receivedAt: row.received_at,
      repliedAt: row.replied_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  mapTemplateRow(row: ReplyTemplateRow) {
    return {
      id: row.id,
      name: row.name,
      content: row.content,
      isActive: row.is_active,
      usageCount: row.usage_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findMessages(
    offset: number,
    limit: number,
    filters?: { accountId?: string; status?: string },
  ): Promise<{ items: Message[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.accountId) {
      conditions.push(`account_id = $${paramIndex++}`);
      params.push(filters.accountId);
    }
    if (filters?.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM messages ${whereClause}`,
      params,
    );

    const result = await query<MessageRow>(
      `SELECT * FROM messages ${whereClause}
       ORDER BY received_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset],
    );

    return {
      items: result.rows.map((row) => this.mapMessageRow(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async findMessageById(id: string): Promise<MessageRow | null> {
    const result = await query<MessageRow>(`SELECT * FROM messages WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  }

  async findByFacebookMessageId(facebookMessageId: string): Promise<MessageRow | null> {
    if (!facebookMessageId) return null;
    const result = await query<MessageRow>(
      `SELECT * FROM messages WHERE facebook_message_id = $1`,
      [facebookMessageId],
    );
    return result.rows[0] ?? null;
  }

  async createMessage(data: {
    accountId: string;
    conversationId: string;
    senderName?: string;
    content: string;
    direction?: string;
    facebookMessageId?: string;
  }): Promise<Message> {
    const result = await query<MessageRow>(
      `INSERT INTO messages (account_id, conversation_id, sender_name, content, direction, facebook_message_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.accountId,
        data.conversationId,
        data.senderName ?? null,
        data.content,
        data.direction ?? MessageDirection.INBOUND,
        data.facebookMessageId ?? null,
      ],
    );
    return this.mapMessageRow(result.rows[0]);
  }

  async updateMessage(
    id: string,
    data: Partial<{ status: string; repliedAt: Date; isAutoReply: boolean; templateId: string }>,
  ): Promise<Message | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      params.push(data.status);
    }
    if (data.repliedAt !== undefined) {
      fields.push(`replied_at = $${paramIndex++}`);
      params.push(data.repliedAt);
    }
    if (data.isAutoReply !== undefined) {
      fields.push(`is_auto_reply = $${paramIndex++}`);
      params.push(data.isAutoReply);
    }
    if (data.templateId !== undefined) {
      fields.push(`template_id = $${paramIndex++}`);
      params.push(data.templateId);
    }

    if (fields.length === 0) return null;

    params.push(id);
    const result = await query<MessageRow>(
      `UPDATE messages SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );
    return result.rows[0] ? this.mapMessageRow(result.rows[0]) : null;
  }

  async findReplyTemplates(): Promise<ReplyTemplate[]> {
    const result = await query<ReplyTemplateRow>(
      `SELECT * FROM reply_templates WHERE is_active = true ORDER BY usage_count ASC`,
    );
    return result.rows.map((row) => this.mapTemplateRow(row));
  }

  async findNextReplyTemplate(): Promise<ReplyTemplateRow | null> {
    const result = await query<ReplyTemplateRow>(
      `SELECT * FROM reply_templates
       WHERE is_active = true
       ORDER BY usage_count ASC
       LIMIT 1`,
    );
    return result.rows[0] ?? null;
  }

  async createReplyTemplate(data: {
    name: string;
    content: string;
  }): Promise<ReplyTemplate> {
    const result = await query<ReplyTemplateRow>(
      `INSERT INTO reply_templates (name, content) VALUES ($1, $2) RETURNING *`,
      [data.name, data.content],
    );
    return this.mapTemplateRow(result.rows[0]);
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    await query(`UPDATE reply_templates SET usage_count = usage_count + 1 WHERE id = $1`, [id]);
  }
}

export const inboxRepository = new InboxRepository();
