import { Message, MessageDirection, MessageStatus, ReplyTemplate } from '@fix-and-flow/types';

export interface MessageRow {
  id: string;
  account_id: string;
  conversation_id: string;
  sender_name: string | null;
  content: string;
  direction: string;
  status: string;
  is_auto_reply: boolean;
  template_id: string | null;
  facebook_message_id: string | null;
  received_at: Date;
  replied_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReplyTemplateRow {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

export type { Message, ReplyTemplate, MessageDirection, MessageStatus };
