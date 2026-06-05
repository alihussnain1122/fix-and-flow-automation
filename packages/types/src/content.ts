export interface ContentTemplate {
  id: string;
  title: string;
  description: string;
  price: number | null;
  category: string | null;
  city: string | null;
  imageUrls: string[];
  isActive: boolean;
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContentDto {
  title: string;
  description: string;
  price?: number;
  category?: string;
  city?: string;
  imageUrls?: string[];
}

export interface UpdateContentDto {
  title?: string;
  description?: string;
  price?: number;
  category?: string;
  city?: string;
  imageUrls?: string[];
  isActive?: boolean;
}

export interface ContentRotationResult {
  templateId: string;
  title: string;
  description: string;
  price: number | null;
  imageUrls: string[];
}
