import type { UUID, BaseEntity } from './index';
export type CampaignType = 'promotional' | 'announcement' | 'newsletter' | 'survey';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
export type JourneyStatus = 'draft' | 'active' | 'paused' | 'archived';
export type JourneyTriggerType = 'event' | 'schedule' | 'segment_entry';
export interface GuestSegment extends BaseEntity {
    propertyId: UUID;
    name: string;
    description?: string;
    segmentType: 'dynamic' | 'static';
    rules: SegmentRule[];
    guestCount: number;
    lastCalculatedAt?: Date;
    isActive: boolean;
}
export interface SegmentRule {
    field: string;
    operator: string;
    value: unknown;
}
export interface EmailTemplate extends BaseEntity {
    propertyId: UUID;
    name: string;
    category: 'transactional' | 'marketing' | 'operational';
    subject: string;
    previewText?: string;
    htmlContent: string;
    textContent?: string;
    variables: string[];
    designData?: Record<string, unknown>;
    thumbnailUrl?: string;
    isActive: boolean;
    version: number;
}
export interface Campaign extends BaseEntity {
    propertyId: UUID;
    name: string;
    description?: string;
    campaignType: CampaignType;
    templateId?: UUID;
    segmentId?: UUID;
    customAudience?: UUID[];
    subjectLine?: string;
    previewText?: string;
    fromName?: string;
    fromEmail?: string;
    replyTo?: string;
    scheduleType: 'immediate' | 'scheduled';
    scheduledAt?: Date;
    sentAt?: Date;
    status: CampaignStatus;
    enableAbTest: boolean;
    abVariants?: Record<string, unknown>[];
    abTestPercentage: number;
    abWinnerMetric?: string;
    abTestDurationHours: number;
    totalRecipients: number;
}
export interface CampaignAnalytics {
    campaignId: UUID;
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    totalUnsubscribed: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
}
export interface EmailJourney extends BaseEntity {
    propertyId: UUID;
    name: string;
    description?: string;
    journeyType: string;
    triggerType: JourneyTriggerType;
    triggerConfig: Record<string, unknown>;
    entrySegmentId?: UUID;
    exitConditions: Record<string, unknown>[];
    status: JourneyStatus;
    priority: number;
    allowReentry: boolean;
    reentryDelayDays?: number;
    maxSendsPerGuest: number;
    startDate?: string;
    endDate?: string;
}
export interface JourneyStep extends BaseEntity {
    journeyId: UUID;
    stepOrder: number;
    stepType: 'send_email' | 'wait' | 'condition' | 'split' | 'update_profile' | 'exit';
    name?: string;
    config: Record<string, unknown>;
    templateId?: UUID;
    waitDuration?: string;
    waitUntilTime?: string;
    waitForEvent?: string;
    conditionRules?: Record<string, unknown>;
    trueNextStepId?: UUID;
    falseNextStepId?: UUID;
    sendsCount: number;
    opensCount: number;
    clicksCount: number;
    conversionsCount: number;
}
//# sourceMappingURL=marketing.d.ts.map