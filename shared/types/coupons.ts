// ============================================
// Coupons Domain Types
// ============================================

import type { UUID, BaseEntity } from './index';

export type CouponDiscountType = 'percentage' | 'fixed' | 'free_item';
export type CouponScope = 'all' | 'menu_service' | 'accommodation' | 'pool' | 'kiosk';

export interface Coupon extends BaseEntity {
  code: string;
  name: string;
  description?: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  appliesTo: CouponScope;
  usageLimit?: number | null;
  usageCount: number;
  perUserLimit: number;
  validFrom: Date;
  validUntil?: Date | null;
  isActive: boolean;
  requiresMinItems: number;
  firstOrderOnly: boolean;
  createdBy?: UUID;
}

export interface CouponUsage {
  id: UUID;
  couponId: UUID;
  userId?: UUID;
  orderType: string;
  orderId: UUID;
  discountApplied: number;
  usedAt: Date;
}

export interface CouponValidationResult {
  isValid: boolean;
  coupon: Coupon | null;
  errorCode?: string;
  errorMessage?: string;
  discountAmount?: number;
}
