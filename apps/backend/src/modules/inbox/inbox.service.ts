import { MessageStatus, CreateReplyTemplateDto } from '@fix-and-flow/types';
import { NotFoundError } from '@fix-and-flow/shared';
import { parsePagination } from '@fix-and-flow/shared';
import { logService } from '../../services/log.service';
import { LogCategory, LogLevel } from '@fix-and-flow/types';
import { accountService } from '../accounts/account.service';
import { inboxRepository } from './inbox.repository';

export class InboxService {
  async findMessages(
    page?: number,
    limit?: number,
    filters?: { accountId?: string; status?: string },
  ) {
    const { offset, limit: l } = parsePagination(page, limit);
    return inboxRepository.findMessages(offset, l, filters);
  }

  async findMessageById(id: string) {
    const message = await inboxRepository.findMessageById(id);
    if (!message) throw new NotFoundError('Message', id);
    return inboxRepository.mapMessageRow(message);
  }

  async checkInbox(accountId: string): Promise<number> {
    await accountService.findById(accountId);

    // Placeholder for Playwright inbox scraping — will be extended in Phase 5
    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.INBOX,
      message: `Inbox check initiated for account ${accountId}`,
      accountId,
    });

    return 0;
  }

  async processInboundMessage(data: {
    accountId: string;
    conversationId: string;
    senderName?: string;
    content: string;
    facebookMessageId?: string;
  }) {
    const message = await inboxRepository.createMessage({
      accountId: data.accountId,
      conversationId: data.conversationId,
      senderName: data.senderName,
      content: data.content,
      facebookMessageId: data.facebookMessageId,
    });

    const autoReply = await this.generateAutoReply();
    if (autoReply) {
      await this.sendAutoReply(message.id, autoReply.templateId, autoReply.content);
    }

    return message;
  }

  async generateAutoReply(): Promise<{ templateId: string; content: string } | null> {
    const template = await inboxRepository.findNextReplyTemplate();
    if (!template) return null;

    return {
      templateId: template.id,
      content: template.content,
    };
  }

  async sendAutoReply(messageId: string, templateId: string, content: string) {
    const message = await this.findMessageById(messageId);

    await inboxRepository.updateMessage(messageId, {
      status: MessageStatus.REPLIED,
      repliedAt: new Date(),
      isAutoReply: true,
      templateId,
    });

    await inboxRepository.incrementTemplateUsage(templateId);

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.INBOX,
      message: `Auto-reply sent to conversation ${message.conversationId}`,
      accountId: message.accountId,
    });

    return { messageId, content, sent: true };
  }

  async getReplyTemplates() {
    return inboxRepository.findReplyTemplates();
  }

  async createReplyTemplate(dto: CreateReplyTemplateDto) {
    return inboxRepository.createReplyTemplate({
      name: dto.name,
      content: dto.content,
    });
  }

  async markAsRead(messageId: string) {
    const updated = await inboxRepository.updateMessage(messageId, {
      status: MessageStatus.READ,
    });
    if (!updated) throw new NotFoundError('Message', messageId);
    return updated;
  }
}

export const inboxService = new InboxService();
