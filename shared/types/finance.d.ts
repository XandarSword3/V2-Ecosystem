import type { UUID, BaseEntity } from './index';
export type CashDrawerStatus = 'open' | 'closed';
export type CashTransactionType = 'sale' | 'refund' | 'pay_in' | 'pay_out';
export type ChargebackStatus = 'needs_response' | 'under_review' | 'charge_refunded' | 'won' | 'lost';
export type ChargebackOutcome = 'won' | 'lost' | 'refunded';
export interface CashDrawer extends BaseEntity {
    deviceId: UUID;
    openedByUserId: UUID;
    openedAt: Date;
    closedAt?: Date;
    startingBalance: number;
    currentBalance: number;
    endingBalance?: number;
    discrepancy?: number;
    status: CashDrawerStatus;
    notes?: string;
}
export interface CashDrawerTransaction {
    id: UUID;
    drawerId: UUID;
    userId: UUID;
    type: CashTransactionType;
    amount: number;
    reasonCode?: string;
    orderId?: UUID;
    createdAt: Date;
}
export interface Chargeback extends BaseEntity {
    paymentId: UUID;
    stripeDisputeId: string;
    stripeChargeId: string;
    amount: number;
    currency: string;
    reason: string;
    status: ChargebackStatus;
    evidenceSubmitted?: ChargebackEvidence | null;
    dueDate: string;
    resolvedAt?: Date | null;
    outcome?: ChargebackOutcome | null;
}
export interface ChargebackEvidence {
    customerName?: string;
    customerEmail?: string;
    billingAddress?: string;
    productDescription?: string;
    serviceDate?: string;
    receipt?: string;
    customerSignature?: string;
    customerCommunication?: string;
    refundPolicy?: string;
    refundPolicyDisclosure?: string;
    uncategorizedText?: string;
    accessActivityLog?: string;
    submittedAt?: string;
}
//# sourceMappingURL=finance.d.ts.map