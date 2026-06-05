export enum PostStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  PUBLISHED = 'published',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface Post {
  id: string;
  accountId: string;
  contentTemplateId: string | null;
  title: string;
  description: string;
  price: number | null;
  imageUrls: string[];
  status: PostStatus;
  facebookListingId: string | null;
  facebookListingUrl: string | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  errorMessage: string | null;
  retryCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePostDto {
  accountId: string;
  contentTemplateId?: string;
  title?: string;
  description?: string;
  price?: number;
  imageUrls?: string[];
  scheduledAt?: Date;
}

export interface UpdatePostDto {
  status?: PostStatus;
  facebookListingId?: string;
  facebookListingUrl?: string;
  errorMessage?: string;
  publishedAt?: Date;
}
