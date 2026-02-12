// ============================================
// GDPR Compliance Domain Types
// ============================================

import type { UUID } from './index';

export type DataExportStatus = 'pending' | 'processing' | 'completed' | 'expired' | 'failed';
export type DataDeletionStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';

export interface DataExportRequest {
  id: UUID;
  userId?: UUID;
  userEmail: string;
  status: DataExportStatus;
  filePath?: string;
  fileExpiresAt?: Date;
  errorMessage?: string;
  requestedAt: Date;
  processedAt?: Date;
  downloadedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface DataDeletionRequest {
  id: UUID;
  userId?: UUID;
  userEmail: string;
  status: DataDeletionStatus;
  reason?: string;
  rejectionReason?: string;
  dataCategories: string[];
  retentionExceptions: string[];
  requestedAt: Date;
  approvedAt?: Date;
  approvedBy?: UUID;
  completedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

export type ConsentType = 'marketing_email' | 'marketing_sms' | 'analytics' | 'third_party_sharing';

export interface GdprConsent {
  id: UUID;
  userId: UUID;
  consentType: ConsentType;
  granted: boolean;
  grantedAt?: Date;
  withdrawnAt?: Date;
  source?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GdprProcessingLog {
  id: UUID;
  userId?: UUID;
  activityType: string; // 'data_access' | 'data_export' | 'data_deletion' | 'consent_change'
  description?: string;
  dataCategories: string[];
  legalBasis?: string;
  processor?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

export interface GdprRetentionPolicy {
  id: UUID;
  dataCategory: string;
  retentionPeriodDays: number;
  legalBasis?: string;
  description?: string;
  autoDelete: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
