import { MessageStatus, CreateReplyTemplateDto, AccountStatus } from '@fix-and-flow/types';
import { NotFoundError } from '@fix-and-flow/shared';
import { parsePagination } from '@fix-and-flow/shared';
import { logService } from '../../services/log.service';
import { LogCategory, LogLevel } from '@fix-and-flow/types';
import { credentialsService } from '../../services/credentials.service';
import { accountService } from '../accounts/account.service';
import { playwrightEngine } from '../posting/playwright.engine';
import { leadService } from '../leads/lead.service';
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
    const creds = await credentialsService.buildForAccount(accountId);

    const scrapeResult = await playwrightEngine.scrapeInbox(creds, {
      onCookiesUpdated: async (cookies) => {
        await credentialsService.saveCookiesFromSession(accountId, cookies);
      },
      onAccountHealth: async (health) => {
        if (health.status === AccountStatus.BANNED) {
          await accountService.markAsBanned(accountId, health.reason);
        } else if (health.status === AccountStatus.FLAGGED) {
          await accountService.markAsFlagged(accountId, health.reason);
        }
      },
    });

    let newCount = 0;

    for (const msg of scrapeResult.messages) {
      const existing = await inboxRepository.findByFacebookMessageId(msg.facebookMessageId ?? '');
      if (existing) continue;

      const saved = await inboxRepository.createMessage({
        accountId,
        conversationId: msg.conversationId,
        senderName: msg.senderName,
        content: msg.content,
        facebookMessageId: msg.facebookMessageId,
      });

      newCount++;

      const autoReply = await this.generateAutoReply();
      if (autoReply) {
        const sent = await playwrightEngine.sendInboxReply(
          creds,
          msg.conversationId,
          autoReply.content,
          {
            onCookiesUpdated: async (cookies) => {
              await credentialsService.saveCookiesFromSession(accountId, cookies);
            },
          },
        );

        if (sent) {
          await this.sendAutoReply(saved.id, autoReply.templateId, autoReply.content);
          await this.tryConvertToLead(saved.id, accountId, msg);
        }
      }
    }

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.INBOX,
      message: `Inbox check completed: ${newCount} new messages`,
      accountId,
      metadata: { newCount, totalScraped: scrapeResult.messages.length },
    });

    return newCount;
  }

  private async tryConvertToLead(
    messageId: string,
    accountId: string,
    msg: { conversationId: string; senderName: string; content: string },
  ) {
    const phoneMatch = msg.content.match(/(\+?\d[\d\s\-().]{8,}\d)/);
    const emailMatch = msg.content.match(/[\w.+-]+@[\w-]+\.[\w.]+/);

    if (phoneMatch || emailMatch) {
      await leadService.create({
        accountId,
        messageId,
        conversationId: msg.conversationId,
        contactName: msg.senderName,
        phone: phoneMatch?.[1]?.replace(/\s/g, ''),
        email: emailMatch?.[0],
        notes: `Auto-detected from inbox: "${msg.content.slice(0, 100)}"`,
      });
    }
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
