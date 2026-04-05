import type { UUID, BaseEntity } from './index';
export type LoyaltyTierName = 'bronze' | 'silver' | 'gold' | 'platinum';
export type LoyaltyTransactionType = 'earn' | 'redeem' | 'expire' | 'adjust' | 'bonus';
export interface LoyaltyTier extends BaseEntity {
    name: string;
    minPoints: number;
    pointsMultiplier: number;
    benefits: string[];
    color: string;
    icon: string;
}
export interface LoyaltyAccount extends BaseEntity {
    userId: UUID;
    currentPoints: number;
    lifetimePoints: number;
    tierId?: UUID;
    memberSince: Date;
    lastActivity: Date;
    isActive: boolean;
}
export interface LoyaltyTransaction {
    id: UUID;
    accountId: UUID;
    type: LoyaltyTransactionType;
    points: number;
    balanceAfter: number;
    description?: string;
    referenceType?: string;
    referenceId?: UUID;
    expiresAt?: Date | null;
    createdBy?: UUID;
    createdAt: Date;
}
export interface LoyaltySettings extends BaseEntity {
    pointsPerDollar: number;
    redemptionRate: number;
    minRedemption: number;
    pointsExpiryDays?: number;
    signupBonus: number;
    birthdayBonus: number;
    isEnabled: boolean;
}
//# sourceMappingURL=loyalty.d.ts.map