import { AccountStatus, PostStatus, UpdatePostDto } from '@fix-and-flow/types';
import { NotFoundError, ValidationError } from '@fix-and-flow/shared';
import { parsePagination, MAX_RETRY_ATTEMPTS, MARKETPLACE_CATEGORIES, MARKETPLACE_CONDITIONS } from '@fix-and-flow/shared';
import { JobName } from '@fix-and-flow/types';
import { getPostingQueue } from '../../config/queue';
import { logService } from '../../services/log.service';
import { LogCategory, LogLevel } from '@fix-and-flow/types';
import { credentialsService } from '../../services/credentials.service';
import { settingsService } from '../../services/settings.service';
import { cityValidationService } from '../../services/city-validation.service';
import { accountService } from '../accounts/account.service';
import { contentService } from '../content/content.service';
import { postingRepository } from './posting.repository';
import { playwrightEngine } from './playwright.engine';

export class PostingService {
  private async resolveCity(cityInput?: string): Promise<string | undefined> {
    if (!cityInput?.trim()) return undefined;
    const result = await cityValidationService.validate(cityInput);
    if (!result.valid) {
      throw new ValidationError(result.reason ?? 'Invalid city');
    }
    return result.normalized ?? cityInput.trim();
  }

  private resolveCategory(categoryInput?: string): string {
    const trimmed = categoryInput?.trim();
    if (!trimmed) {
      throw new ValidationError('Category is required');
    }
    const match = MARKETPLACE_CATEGORIES.find(
      (item) => item.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) return match;

    if (trimmed.length < 2 || trimmed.length > 80) {
      throw new ValidationError('Custom category must be between 2 and 80 characters');
    }

    return trimmed;
  }

  private resolveCondition(conditionInput?: string): string {
    const trimmed = conditionInput?.trim();
    if (!trimmed) {
      throw new ValidationError('Condition is required');
    }
    const match = MARKETPLACE_CONDITIONS.find(
      (item) => item.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) return match;

    throw new ValidationError(
      `Condition must be one of: ${MARKETPLACE_CONDITIONS.join(', ')}`,
    );
  }

  private buildPostMetadata(
    city?: string,
    category?: string,
    condition?: string,
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    if (city) metadata.city = city;
    if (category) metadata.category = category;
    if (condition) metadata.condition = condition;
    return metadata;
  }

  async findAll(page?: number, limit?: number, filters?: { status?: string; accountId?: string }) {
    const { offset, limit: l } = parsePagination(page, limit);
    return postingRepository.findAll(offset, l, filters);
  }

  async findById(id: string) {
    const post = await postingRepository.findById(id);
    if (!post) throw new NotFoundError('Post', id);
    return postingRepository.mapRow(post);
  }

  async create(dto: import('@fix-and-flow/types').CreatePostDto) {
    const account = await accountService.findById(dto.accountId);

    let title = dto.title;
    let description = dto.description;
    let price = dto.price;
    let imageUrls = dto.imageUrls;
    let city: string | undefined;

    if (dto.contentTemplateId) {
      const template = await contentService.findById(dto.contentTemplateId);
      title = title ?? template.title;
      description = description ?? template.description;
      price = price ?? template.price ?? undefined;
      imageUrls = imageUrls ?? template.imageUrls;
      city = template.city ?? undefined;
    }

    if (!title || !description) {
      const rotated = await contentService.rotateContent(
        account.metadata?.city as string,
        dto.accountId,
      );
      if (!rotated) throw new ValidationError('No content available for posting');
      title = title ?? rotated.title;
      description = description ?? rotated.description;
      price = price ?? rotated.price ?? undefined;
      imageUrls = imageUrls ?? rotated.imageUrls;
    }

    city = dto.city ?? city ?? (account.metadata?.city as string | undefined);
    if (city) {
      city = await this.resolveCity(city);
    }
    if (!city) {
      throw new ValidationError('City is required for Marketplace posting');
    }
    const category = this.resolveCategory(dto.category);
    const condition = this.resolveCondition(dto.condition);

    const post = await postingRepository.create({
      accountId: dto.accountId,
      contentTemplateId: dto.contentTemplateId,
      title,
      description,
      price: price ?? null,
      imageUrls,
      scheduledAt: dto.scheduledAt,
      status: PostStatus.PENDING,
      metadata: this.buildPostMetadata(city, category, condition),
    });

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.POSTING,
      message: `Post created: ${title}`,
      accountId: dto.accountId,
      postId: post.id,
    });

    return { ...post, city, category, condition };
  }

  async update(id: string, dto: UpdatePostDto) {
    const post = await this.findById(id);

    let metadata: Record<string, unknown> | undefined;
    if (dto.city !== undefined || dto.category !== undefined || dto.condition !== undefined) {
      metadata = { ...post.metadata };
      if (dto.city !== undefined) {
        metadata.city = dto.city ? await this.resolveCity(dto.city) : undefined;
      }
      if (dto.category !== undefined) {
        metadata.category = this.resolveCategory(dto.category);
      }
      if (dto.condition !== undefined) {
        metadata.condition = this.resolveCondition(dto.condition);
      }
    }

    const updated = await postingRepository.update(id, {
      title: dto.title,
      description: dto.description,
      price: dto.price,
      imageUrls: dto.imageUrls,
      metadata,
      status: dto.status,
      facebookListingId: dto.facebookListingId,
      facebookListingUrl: dto.facebookListingUrl,
      errorMessage: dto.errorMessage,
      publishedAt: dto.publishedAt,
    });

    if (!updated) throw new NotFoundError('Post', id);
    return updated;
  }

  async delete(id: string) {
    const post = await this.findById(id);

    const deleted = await postingRepository.delete(id);
    if (!deleted) throw new NotFoundError('Post', id);

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.POSTING,
      message: `Post deleted: ${post.title}`,
      accountId: post.accountId,
      metadata: { deletedPostId: id, deletedPostTitle: post.title },
    });
  }

  async executePost(postId: string): Promise<void> {
    const post = await this.findById(postId);

    if (post.status !== PostStatus.PENDING && post.status !== PostStatus.QUEUED) {
      throw new ValidationError(`Post cannot be executed in status: ${post.status}`);
    }

    const account = await accountService.findById(post.accountId);

    if (account.status !== AccountStatus.ACTIVE) {
      throw new ValidationError(
        'Account is not connected. Open Accounts and click Connect Facebook before posting.',
      );
    }

    const cookies = await accountService.getDecryptedCookies(post.accountId);
    if (!cookies) {
      throw new ValidationError(
        'No saved Facebook session. Connect the account under Accounts → Connect Facebook first.',
      );
    }

    const canPost = await accountService.canPost(post.accountId);
    if (!canPost) {
      throw new ValidationError('Account has reached daily post limit or is not active');
    }

    await postingRepository.update(postId, { status: PostStatus.IN_PROGRESS });

    const creds = await credentialsService.buildForAccount(post.accountId);
    const listing = {
      title: post.title,
      description: post.description,
      price: post.price ?? 0,
      imageUrls: post.imageUrls,
      city:
        (post.metadata?.city as string) ??
        (account.metadata?.city as string) ??
        undefined,
      category: this.resolveCategory(post.metadata?.category as string | undefined),
      condition: this.resolveCondition(
        (post.metadata?.condition as string | undefined) ?? MARKETPLACE_CONDITIONS[0],
      ),
    };

    const result = await playwrightEngine.createListing(creds, listing, {
      onCookiesUpdated: async (updatedCookies) => {
        await credentialsService.saveCookiesFromSession(post.accountId, updatedCookies);
      },
      onAccountHealth: async (health) => {
        if (health.status === AccountStatus.BANNED) {
          await accountService.markAsBanned(post.accountId, health.reason);
        } else if (health.status === AccountStatus.FLAGGED) {
          await accountService.markAsFlagged(post.accountId, health.reason);
        }
      },
    }, { allowCredentialLogin: false });

    if (result.success) {
      await postingRepository.update(postId, {
        status: PostStatus.PUBLISHED,
        facebookListingUrl: result.listingUrl,
        facebookListingId: result.listingId,
        publishedAt: new Date(),
      });
      await accountService.incrementPostsToday(post.accountId);

      await logService.create({
        level: LogLevel.INFO,
        category: LogCategory.POSTING,
        message: 'Post published successfully',
        accountId: post.accountId,
        postId,
      });
    } else {
      const newStatus =
        post.retryCount + 1 >= MAX_RETRY_ATTEMPTS ? PostStatus.FAILED : PostStatus.PENDING;

      await postingRepository.update(postId, {
        status: newStatus,
        errorMessage: result.error,
        retryCount: post.retryCount + 1,
      });

      await logService.create({
        level: LogLevel.ERROR,
        category: LogCategory.POSTING,
        message: `Post failed: ${result.error}`,
        accountId: post.accountId,
        postId,
      });
    }
  }

  async getAutomationSettings(): Promise<{ enabled: boolean }> {
    const enabled = await settingsService.isPostsAutomationEnabled();
    return { enabled };
  }

  async setAutomationEnabled(enabled: boolean): Promise<{ enabled: boolean }> {
    await settingsService.setPostsAutomationEnabled(enabled);
    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.POSTING,
      message: enabled ? 'Automatic posting enabled' : 'Automatic posting disabled',
    });
    return { enabled };
  }

  /** Picks the oldest pending post and queues it when automation is enabled. */
  async processAutomationQueue(): Promise<number> {
    const enabled = await settingsService.isPostsAutomationEnabled();
    if (!enabled) return 0;

    const pending = await postingRepository.findPendingForAutomation(5);
    const queue = getPostingQueue();
    let processed = 0;

    for (const post of pending) {
      const account = await accountService.findById(post.accountId).catch(() => null);
      if (!account || account.status !== AccountStatus.ACTIVE) continue;

      const cookies = await accountService.getDecryptedCookies(post.accountId);
      if (!cookies) continue;

      const canPost = await accountService.canPost(post.accountId);
      if (!canPost) continue;

      await postingRepository.update(post.id, { status: PostStatus.QUEUED });

      await queue.add(JobName.CREATE_POST, {
        postId: post.id,
        accountId: post.accountId,
        title: post.title,
        description: post.description,
        price: post.price,
        imageUrls: post.imageUrls,
      });

      await logService.create({
        level: LogLevel.INFO,
        category: LogCategory.SCHEDULER,
        message: `Auto-post queued: "${post.title}"`,
        accountId: post.accountId,
        postId: post.id,
      });

      processed++;
      break;
    }

    return processed;
  }

  async runBasicInteraction(accountId?: string): Promise<void> {
    const creds = accountId
      ? await credentialsService.buildForAccount(accountId)
      : { accountId: 'test' };

    await playwrightEngine.runBasicFacebookInteraction(creds);

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.PLAYWRIGHT,
      message: 'Basic Facebook interaction completed',
      accountId,
    });
  }
}

export const postingService = new PostingService();
