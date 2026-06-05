export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum MessageStatus {
  UNREAD = 'unread',
  READ = 'read',
  REPLIED = 'replied',
  ARCHIVED = 'archived',
}

export interface Message {
  id: string;
  accountId: string;
  conversationId: string;
  senderName: string | null;
  content: string;
  direction: MessageDirection;
  status: MessageStatus;
  isAutoReply: boolean;
  templateId: string | null;
  facebookMessageId: string | null;
  receivedAt: Date;
  repliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReplyTemplate {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReplyTemplateDto {
  name: string;
  content: string;
}
