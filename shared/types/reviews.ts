// ============================================
// Reviews Domain Types
// ============================================

import type { UUID, BaseEntity } from './index';

export type ReviewServiceType = 'general' | 'menu_service' | 'accommodation' | 'pool' | 'kiosk';

export interface Review extends BaseEntity {
  userId: UUID;
  rating: number;
  text: string;
  serviceType: ReviewServiceType;
  isApproved: boolean;
}

export interface ReviewWithUser extends Review {
  user?: {
    id?: UUID;
    fullName?: string;
    email?: string;
    profileImageUrl?: string;
  };
}

export interface ReviewResponse extends BaseEntity {
  reviewId: UUID;
  respondedBy: UUID;
  responseText: string;
  isPublic: boolean;
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
}

export interface ReviewFilters {
  status?: 'pending' | 'approved' | 'all';
  serviceType?: ReviewServiceType;
  userId?: UUID;
}
