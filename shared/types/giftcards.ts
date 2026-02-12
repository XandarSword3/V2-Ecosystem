// ============================================
// Gift Cards Domain Types
// ============================================

import type { UUID, BaseEntity } from './index';

export type GiftCardStatus = 'active' | 'used' | 'expired' | 'disabled' | 'redeemed' | 'cancelled' | 'suspended';

export interface GiftCard extends BaseEntity {
  code: string;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  status: GiftCardStatus;
  purchasedBy?: UUID;
  purchaserEmail?: string;
  recipientEmail?: string;
  recipientName?: string;
  message?: string;
  expiresAt: Date;
  activatedAt?: Date | null;
}

export type GiftCardTransactionType = 'purchase' | 'redeem' | 'refund' | 'expire';

export interface GiftCardTransaction {
  id: UUID;
  giftCardId: UUID;
  type: GiftCardTransactionType;
  amount: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: UUID;
  notes?: string;
  createdBy?: UUID;
  createdAt: Date;
}

export interface GiftCardTemplate extends BaseEntity {
  name: string;
  amount: number;
  imageUrl?: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}
