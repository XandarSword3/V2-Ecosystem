/**
 * Coupons Import Type Definitions
 */

export type DiscountType = 'percentage' | 'fixed';
export type AppliesTo = 'all' | 'restaurant' | 'pool' | 'chalets' | 'snack' | 'giftcards';

export interface ImportedCoupon {
  code?: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  expiresAt?: string;
  appliesTo?: AppliesTo;
  // Internal tracking
  _tempId?: string;
  _parseWarnings?: string[];
}

export interface CouponImportResult {
  items: ImportedCoupon[];
  warnings: string[];
  errors: string[];
  totalParsed: number;
  successful: number;
}

export interface CouponCommitImportRequest {
  items: ImportedCoupon[];
}
