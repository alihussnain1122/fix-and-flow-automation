import { AccountStatus, PostStatus } from '@fix-and-flow/types';
import { NotFoundError, ValidationError } from '@fix-and-flow/shared';
import { parsePagination, MAX_RETRY_ATTEMPTS } from '@fix-and-flow/shared';
import { logService } from '../../services/log.service';
import { LogCategory, LogLevel } from '@fix-and-flow/types';
import { credentialsService } from '../../services/credentials.service';
import { accountService } from '../accounts/account.service';
import { contentService } from '../content/content.service';
import { postingRepository } from './posting.repository';
import { playwrightEngine } from './playwright.engine';

export class PostingService {
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

    const post = await postingRepository.create({
      accountId: dto.accountId,
      contentTemplateId: dto.contentTemplateId,
      title,
      description,
      price: price ?? null,
      imageUrls,
      scheduledAt: dto.scheduledAt,
      status: PostStatus.PENDING,
    });

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.POSTING,
      message: `Post created: ${title}`,
      accountId: dto.accountId,
      postId: post.id,
    });

    return { ...post, city };
  }

  async executePost(postId: string): Promise<void> {
    const post = await this.findById(postId);

    const canPost = await accountService.canPost(post.accountId);
    if (!canPost) {
      throw new ValidationError('Account has reached daily post limit or is not active');
    }

    await postingRepository.update(postId, { status: PostStatus.IN_PROGRESS });

    const creds = await credentialsService.buildForAccount(post.accountId);
    const listing = {
      title: post.title,
      description: post.description,
      price: post.price,
      imageUrls: post.imageUrls,
      city: (post.metadata?.city as string) ?? undefined,
    };

    const result = await playwrightEngine.createListing(creds, listing, {
      onCookiesUpdated: async (cookies) => {
        await credentialsService.saveCookiesFromSession(post.accountId, cookies);
      },
      onAccountHealth: async (health) => {
        if (health.status === AccountStatus.BANNED) {
          await accountService.markAsBanned(post.accountId, health.reason);
        } else if (health.status === AccountStatus.FLAGGED) {
          await accountService.markAsFlagged(post.accountId, health.reason);
        }
      },
    });

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
