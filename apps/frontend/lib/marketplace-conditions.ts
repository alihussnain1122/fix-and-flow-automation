/** Matches backend MARKETPLACE_CONDITIONS */
export const MARKETPLACE_CONDITIONS = [
  'New',
  'Used - Like New',
  'Used - Good',
  'Used - Fair',
] as const;

export type MarketplaceCondition = (typeof MARKETPLACE_CONDITIONS)[number];
