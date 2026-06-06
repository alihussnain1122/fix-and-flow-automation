import { query } from '../../config/database';
import { Lead, LeadStatus, CreateLeadDto, UpdateLeadDto } from '@fix-and-flow/types';
import { parsePagination } from '@fix-and-flow/shared';
import { NotFoundError } from '@fix-and-flow/shared';

type LeadRow = Parameters<LeadRepository['mapRow']>[0];

export class LeadRepository {
  mapRow(row: {
    id: string;
    account_id: string;
    message_id: string | null;
    conversation_id: string | null;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    status: string;
    source: string;
    notes: string | null;
    converted_at: Date | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }): Lead {
    return {
      id: row.id,
      accountId: row.account_id,
      messageId: row.message_id,
      conversationId: row.conversation_id,
      contactName: row.contact_name,
      phone: row.phone,
      email: row.email,
      status: row.status as LeadStatus,
      source: row.source,
      notes: row.notes,
      convertedAt: row.converted_at,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(page: number, limit: number, filters?: { status?: string; accountId?: string }) {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (filters?.status) {
      conditions.push(`status = $${i++}`);
      params.push(filters.status);
    }
    if (filters?.accountId) {
      conditions.push(`account_id = $${i++}`);
      params.push(filters.accountId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM leads ${where}`,
      params,
    );
    const result = await query(
      `SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...params, limit, offset],
    );

    return {
      items: result.rows.map((r) => this.mapRow(r as LeadRow)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async create(data: CreateLeadDto & { source?: string }) {
    const result = await query(
      `INSERT INTO leads (account_id, message_id, conversation_id, contact_name, phone, email, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        data.accountId,
        data.messageId ?? null,
        data.conversationId ?? null,
        data.contactName ?? null,
        data.phone ?? null,
        data.email ?? null,
        data.notes ?? null,
        data.source ?? 'inbox',
      ],
    );
    return this.mapRow(result.rows[0] as LeadRow);
  }

  async update(id: string, data: UpdateLeadDto) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (data.status !== undefined) {
      fields.push(`status = $${i++}`);
      params.push(data.status);
      if (data.status === LeadStatus.CONVERTED) {
        fields.push(`converted_at = $${i++}`);
        params.push(new Date());
      }
    }
    if (data.contactName !== undefined) {
      fields.push(`contact_name = $${i++}`);
      params.push(data.contactName);
    }
    if (data.phone !== undefined) {
      fields.push(`phone = $${i++}`);
      params.push(data.phone);
    }
    if (data.email !== undefined) {
      fields.push(`email = $${i++}`);
      params.push(data.email);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${i++}`);
      params.push(data.notes);
    }

    if (!fields.length) return null;

    params.push(id);
    const result = await query(
      `UPDATE leads SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    return result.rows[0]
      ? this.mapRow(result.rows[0] as LeadRow)
      : null;
  }
}

export const leadRepository = new LeadRepository();

export class LeadService {
  async findAll(page?: number, limit?: number, filters?: { status?: string; accountId?: string }) {
    const { page: p, limit: l } = parsePagination(page, limit);
    return leadRepository.findAll(p, l, filters);
  }

  async create(dto: CreateLeadDto) {
    return leadRepository.create(dto);
  }

  async update(id: string, dto: UpdateLeadDto) {
    const updated = await leadRepository.update(id, dto);
    if (!updated) throw new NotFoundError('Lead', id);
    return updated;
  }

  async convert(id: string, notes?: string) {
    return this.update(id, {
      status: LeadStatus.CONVERTED,
      notes,
    });
  }
}

export const leadService = new LeadService();
