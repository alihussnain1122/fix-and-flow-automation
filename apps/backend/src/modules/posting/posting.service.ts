import { CreatePostDto, PostStatus } from '@fix-and-flow/types';
import { NotFoundError, ValidationError } from '@fix-and-flow/shared';
import { parsePagination } from '@fix-and-flow/shared';
import { logService } from '../../services/log.service';
import { LogCategory, LogLevel } from '@fix-and-flow/types';
import { accountService } from '../accounts/account.service';
import { proxyService } from '../proxies/proxy.service';
import { contentService } from '../content/content.service';
import { decrypt } from '../../utils/encryption';
import { postingRepository } from './posting.repository';
import { playwrightEngine } from './playwright.engine';
import { ListingData, PostingCredentials } from './posting.types';

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

  async create(dto: CreatePostDto) {
    await accountService.findById(dto.accountId);

    let title = dto.title;
    let description = dto.description;
    let price = dto.price;
    let imageUrls = dto.imageUrls;

    if (dto.contentTemplateId) {
      const template = await contentService.findById(dto.contentTemplateId);
      title = title ?? template.title;
      description = description ?? template.description;
      price = price ?? template.price ?? undefined;
      imageUrls = imageUrls ?? template.imageUrls;
    }

    if (!title || !description) {
      const rotated = await contentService.rotateContent();
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

    return post;
  }

  async executePost(postId: string): Promise<void> {
    const post = await this.findById(postId);
    const account = await accountService.findById(post.accountId);

    const canPost = await accountService.canPost(post.accountId);
    if (!canPost) {
      throw new ValidationError('Account has reached daily post limit or is not active');
    }

    await postingRepository.update(postId, { status: PostStatus.IN_PROGRESS });

    const credentials = await this.buildCredentials(post.accountId);
    const listing: ListingData = {
      title: post.title,
      description: post.description,
      price: post.price,
      imageUrls: post.imageUrls,
    };

    const result = await playwrightEngine.createListing(credentials, listing);

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
        message: `Post published successfully`,
        accountId: post.accountId,
        postId,
      });
    } else {
      await postingRepository.update(postId, {
        status: PostStatus.FAILED,
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

  private async buildCredentials(accountId: string): Promise<PostingCredentials> {
    const account = await accountService.findById(accountId);
    const cookies = await accountService.getDecryptedCookies(accountId);

    let proxy;
    if (account.proxyId) {
      const proxyData = await proxyService.findById(account.proxyId);
      proxy = {
        server: proxyService.getProxyServerUrl(proxyData),
        username: proxyData.username ?? undefined,
        password: proxyData.passwordEncrypted
          ? decrypt(proxyData.passwordEncrypted)
          : undefined,
      };
    }

    return {
      accountId,
      cookies: cookies ?? undefined,
      userAgent: account.userAgent ?? undefined,
      proxy,
    };
  }

  async runBasicInteraction(accountId?: string): Promise<void> {
    const credentials = accountId
      ? await this.buildCredentials(accountId)
      : { accountId: 'test' };

    await playwrightEngine.runBasicFacebookInteraction(credentials);

    await logService.create({
      level: LogLevel.INFO,
      category: LogCategory.PLAYWRIGHT,
      message: 'Basic Facebook interaction completed',
      accountId: accountId,
    });
  }
}

export const postingService = new PostingService();
