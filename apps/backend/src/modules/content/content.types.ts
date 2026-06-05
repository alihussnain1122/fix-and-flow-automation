import { ContentTemplate, CreateContentDto, UpdateContentDto } from '@fix-and-flow/types';

export interface ContentRow {
  id: string;
  title: string;
  description: string;
  price: string | null;
  category: string | null;
  city: string | null;
  image_urls: string[];
  is_active: boolean;
  usage_count: number;
  last_used_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type { ContentTemplate, CreateContentDto, UpdateContentDto };
