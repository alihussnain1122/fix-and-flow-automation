export interface City {
  id: string;
  name: string;
  state: string | null;
  country: string;
  isActive: boolean;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCityDto {
  name: string;
  state?: string;
  country?: string;
}

export interface UpdateCityDto {
  name?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
}

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  CONVERTED = 'converted',
  LOST = 'lost',
}

export interface Lead {
  id: string;
  accountId: string;
  messageId: string | null;
  conversationId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  status: LeadStatus;
  source: string;
  notes: string | null;
  convertedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLeadDto {
  accountId: string;
  messageId?: string;
  conversationId?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface UpdateLeadDto {
  status?: LeadStatus;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}
