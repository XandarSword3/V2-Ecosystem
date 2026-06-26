import { getSupabase } from '../../database/connection.js';
import { createWriteStream, unlink, readFile, mkdirSync, existsSync } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import archiver from 'archiver';
import crypto from 'crypto';
import os from 'os';

// Lazy-initialized Supabase client - use proxy to defer getSupabase() call
const supabase = new Proxy({} as ReturnType<typeof getSupabase>, {
  get(_, prop) { return getSupabase()[prop as keyof ReturnType<typeof getSupabase>]; }
});

const unlinkAsync = promisify(unlink);
const readFileAsync = promisify(readFile);

export interface ExportRequest {
  id: string;
  user_id: string;
  user_email: string;
  status: 'pending' | 'processing' | 'completed' | 'expired' | 'failed';
  file_path?: string;
  file_expires_at?: string;
  error_message?: string;
  requested_at: string;
  processed_at?: string;
  downloaded_at?: string;
}

export interface DeletionRequest {
  id: string;
  user_id: string;
  user_email: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  reason?: string;
  rejection_reason?: string;
  data_categories: string[];
  retention_exceptions: string[];
  requested_at: string;
  approved_at?: string;
  approved_by?: string;
  completed_at?: string;
}

export interface Consent {
  id: string;
  user_id: string;
  consent_type: string;
  granted: boolean;
  granted_at?: string;
  withdrawn_at?: string;
  source?: string;
}

export interface RetentionPolicy {
  id: string;
  data_category: string;
  retention_period_days: number;
  legal_basis: string;
  description: string;
  auto_delete: boolean;
  is_active: boolean;
}

const EXPORT_FILE_TTL_HOURS = 72; // Files expire after 72 hours
const EXPORT_DIR = process.env.GDPR_EXPORT_DIR || join(os.tmpdir(), 'gdpr-exports');

// ==================== DATA EXPORT ====================

export async function requestDataExport(
  userId: string,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<ExportRequest> {
  // Check for existing pending/processing request
  const { data: existing } = await supabase
    .from('gdpr_export_requests')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .single();

  if (existing) {
    throw new Error('You already have a pending export request. Please wait for it to complete.');
  }

  const { data, error } = await supabase
    .from('gdpr_export_requests')
    .insert({
      user_id: userId,
      user_email: email,
      status: 'pending',
      ip_address: ipAddress,
      user_agent: userAgent
    })
    .select()
    .single();

  if (error) throw error;

  // Log the activity
  await logProcessingActivity(userId, 'data_export', 'Data export requested', ['all'], 'consent');

  return data;
}

export async function processExportRequest(requestId: string): Promise<void> {
  const client = supabase;

  // Update status to processing
  await client
    .from('gdpr_export_requests')
    .update({ status: 'processing' })
    .eq('id', requestId);

  try {
    const { data: request, error: reqError } = await client
      .from('gdpr_export_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqError || !request) throw new Error('Export request not found');

    const userId = request.user_id;

    // Collect all user data
    const userData = await collectUserData(userId);

    // Create export file
    const filePath = await createExportArchive(requestId, userData);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + EXPORT_FILE_TTL_HOURS);

    // Update request with file info
    await client
      .from('gdpr_export_requests')
      .update({
        status: 'completed',
        file_path: filePath,
        file_expires_at: expiresAt.toISOString(),
        processed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    // Log the activity
    await logProcessingActivity(userId, 'data_export', 'Data export completed', ['all'], 'consent');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await client
      .from('gdpr_export_requests')
      .update({
        status: 'failed',
        error_message: errorMessage,
        processed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    throw error;
  }
}

async function collectUserData(userId: string): Promise<Record<string, any>> {
  const client = supabase;
  const data: Record<string, any> = {};

  // User profile
  const { data: user } = await client
    .from('users')
    .select('id, email, full_name, phone, role, created_at, updated_at')
    .eq('id', userId)
    .single();
  data.profile = user;

  // Transactions (unified source — covers all engine types)
  const { data: transactions } = await client
    .from('transactions')
    .select('*')
    .eq('customer_id', userId);

  const txs = transactions || [];
  data.reservations = txs.filter(t => t.engine_type === 'time_exclusive_reservation');
  data.orders       = txs.filter(t => t.engine_type === 'instant_transaction');
  data.tickets      = txs.filter(t => t.engine_type === 'shared_capacity_access');
  data.memberships  = txs.filter(t => t.engine_type === 'ongoing_entitlement');

  // Payments — match by reference_id since payments.customer_id does not exist
  const txIds = txs.map(t => t.id);
  if (txIds.length > 0) {
    const { data: payments } = await client
      .from('payments')
      .select('id, amount, currency, status, method, processed_at, reference_type, reference_id')
      .in('reference_id', txIds);
    data.payments = payments || [];
  } else {
    data.payments = [];
  }

  // Loyalty account and transactions
  const { data: loyaltyAccount } = await client
    .from('loyalty_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  data.loyalty_account = loyaltyAccount || null;

  if (loyaltyAccount?.id) {
    const { data: loyaltyTx } = await client
      .from('loyalty_transactions')
      .select('*')
      .eq('account_id', loyaltyAccount.id);
    data.loyalty_transactions = loyaltyTx || [];
  } else {
    data.loyalty_transactions = [];
  }

  // Gift card transactions
  const { data: giftCardTx } = await client
    .from('gift_card_transactions')
    .select('*')
    .eq('user_id', userId);
  data.gift_card_transactions = giftCardTx || [];

  // Consents
  const { data: consents } = await client
    .from('gdpr_consents')
    .select('*')
    .eq('user_id', userId);
  data.consents = consents || [];

  // Support tickets
  const { data: tickets } = await client
    .from('support_inquiries')
    .select('*')
    .eq('user_id', userId);
  data.support_tickets = tickets || [];

  // Feedback/Reviews
  const { data: reviews } = await client
    .from('reviews')
    .select('*')
    .eq('customer_id', userId);
  data.reviews = reviews || [];

  // Activity/Audit log
  const { data: activities } = await client
    .from('gdpr_processing_activities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000);
  data.activity_log = activities || [];

  return data;
}

async function createExportArchive(requestId: string, userData: Record<string, any>): Promise<string> {
  const fileName = `gdpr-export-${requestId}-${Date.now()}.zip`;

  if (!existsSync(EXPORT_DIR)) {
    try {
      mkdirSync(EXPORT_DIR, { recursive: true });
    } catch (e) {
      console.error('Failed to create export directory:', e);
    }
  }

  const filePath = join(EXPORT_DIR, fileName);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(filePath));
    archive.on('error', reject);

    archive.pipe(output);

    // Add data as JSON files
    for (const [category, data] of Object.entries(userData)) {
      const content = JSON.stringify(data, null, 2);
      archive.append(content, { name: `${category}.json` });
    }

    // Add a README
    const readme = `GDPR Data Export
================
Export ID: ${requestId}
Generated: ${new Date().toISOString()}

This archive contains all personal data associated with your account.

Files included:
- profile.json: Your account information
- reservations.json: Your booking history (Accommodation)
- orders.json: Your purchase history (Menu Service/Retail)
- tickets.json: Your access history (Pool/Events)
- payments.json: Your payment records (card numbers redacted)
- consents.json: Your consent preferences
- support_tickets.json: Your support requests
- reviews.json: Your reviews and feedback
- activity_log.json: Recent account activity

For questions, contact our Data Protection Officer.
`;
    archive.append(readme, { name: 'README.txt' });

    archive.finalize();
  });
}

export async function getExportFile(requestId: string, userId: string): Promise<Buffer | null> {
  const { data: request, error } = await supabase
    .from('gdpr_export_requests')
    .select('*')
    .eq('id', requestId)
    .eq('user_id', userId)
    .single();

  if (error || !request || request.status !== 'completed') {
    return null;
  }

  // Check if expired
  if (request.file_expires_at && new Date(request.file_expires_at) < new Date()) {
    // Mark as expired
    await supabase
      .from('gdpr_export_requests')
      .update({ status: 'expired' })
      .eq('id', requestId);
    return null;
  }

  try {
    const fileContent = await readFileAsync(request.file_path);

    // Mark as downloaded
    await supabase
      .from('gdpr_export_requests')
      .update({ downloaded_at: new Date().toISOString() })
      .eq('id', requestId);

    return fileContent;
  } catch (err) {
    return null;
  }
}

export async function getExportRequests(userId: string): Promise<ExportRequest[]> {
  const { data, error } = await supabase
    .from('gdpr_export_requests')
    .select('*')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ==================== DATA DELETION ====================

export async function requestDataDeletion(
  userId: string,
  email: string,
  reason: string,
  categories: string[] = ['all'],
  ipAddress?: string,
  userAgent?: string
): Promise<DeletionRequest> {
  // Check for existing pending request
  const { data: existing } = await supabase
    .from('gdpr_deletion_requests')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved', 'processing'])
    .single();

  if (existing) {
    throw new Error('You already have a pending deletion request.');
  }

  // Get retention exceptions (data that cannot be deleted due to legal requirements)
  const { data: policies } = await supabase
    .from('gdpr_retention_policies')
    .select('data_category, retention_period_days, legal_basis')
    .eq('is_active', true);

  const retentionExceptions: string[] = [];
  for (const policy of policies || []) {
    if (policy.legal_basis === 'Legal obligation') {
      retentionExceptions.push(`${policy.data_category}: Retained for ${policy.retention_period_days} days due to ${policy.legal_basis}`);
    }
  }

  const { data, error } = await supabase
    .from('gdpr_deletion_requests')
    .insert({
      user_id: userId,
      user_email: email,
      status: 'pending',
      reason,
      data_categories: categories,
      retention_exceptions: retentionExceptions,
      ip_address: ipAddress,
      user_agent: userAgent
    })
    .select()
    .single();

  if (error) throw error;

  await logProcessingActivity(userId, 'data_deletion', 'Deletion request submitted', categories, 'consent');

  return data;
}

export async function approveDeletionRequest(
  requestId: string,
  approvedBy: string
): Promise<DeletionRequest> {
  const client = supabase;

  const { data, error } = await client
    .from('gdpr_deletion_requests')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function rejectDeletionRequest(
  requestId: string,
  rejectedBy: string,
  rejectionReason: string
): Promise<DeletionRequest> {
  const client = supabase;

  const { data, error } = await client
    .from('gdpr_deletion_requests')
    .update({
      status: 'rejected',
      rejection_reason: rejectionReason
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) throw error;

  // Log the activity
  const request = await client
    .from('gdpr_deletion_requests')
    .select('user_id')
    .eq('id', requestId)
    .single();

  if (request.data) {
    await logProcessingActivity(request.data.user_id, 'data_deletion', `Deletion rejected: ${rejectionReason}`, [], 'legitimate_interest');
  }

  return data;
}

export async function processApprovedDeletions(): Promise<void> {
  const client = supabase;

  const { data: requests } = await client
    .from('gdpr_deletion_requests')
    .select('*')
    .eq('status', 'approved');

  for (const request of requests || []) {
    await processSingleDeletion(request.id);
  }
}

async function processSingleDeletion(requestId: string): Promise<void> {
  const client = supabase;

  await client
    .from('gdpr_deletion_requests')
    .update({ status: 'processing' })
    .eq('id', requestId);

  try {
    const { data: request } = await client
      .from('gdpr_deletion_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (!request) throw new Error('Request not found');

    const userId = request.user_id;
    const categories = request.data_categories;

    // Delete data based on categories (respecting retention requirements)
    if (categories.includes('all') || categories.includes('profile')) {
      // Anonymize user instead of hard delete (keep for order history integrity)
      await client
        .from('users')
        .update({
          email: `deleted-${crypto.randomUUID()}@anonymized.local`,
          full_name: "Deleted User",
          last_name: 'User',
          phone: null,
          is_active: false
        })
        .eq('id', userId);
    }

    if (categories.includes('all') || categories.includes('marketing')) {
      // Delete marketing consents
      await client
        .from('gdpr_consents')
        .delete()
        .eq('user_id', userId)
        .in('consent_type', ['marketing_email', 'marketing_sms']);
    }

    if (categories.includes('all') || categories.includes('analytics')) {
      // Delete analytics consent and data
      await client
        .from('gdpr_consents')
        .delete()
        .eq('user_id', userId)
        .eq('consent_type', 'analytics');
    }

    // Mark as completed
    await client
      .from('gdpr_deletion_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    await logProcessingActivity(userId, 'data_deletion', 'Data deletion completed', categories, 'consent');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await client
      .from('gdpr_deletion_requests')
      .update({
        status: 'pending', // Reset to pending for retry
        rejection_reason: `Processing failed: ${errorMessage}`
      })
      .eq('id', requestId);
  }
}

export async function getDeletionRequests(userId?: string): Promise<DeletionRequest[]> {
  let query = supabase
    .from('gdpr_deletion_requests')
    .select('*')
    .order('requested_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ==================== CONSENT MANAGEMENT ====================

export async function getConsents(userId: string): Promise<Consent[]> {
  const { data, error } = await supabase
    .from('gdpr_consents')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
}

export async function updateConsent(
  userId: string,
  consentType: string,
  granted: boolean,
  source: string = 'settings',
  ipAddress?: string,
  userAgent?: string
): Promise<Consent> {
  const now = new Date().toISOString();

  const updateData: any = {
    user_id: userId,
    consent_type: consentType,
    granted,
    source,
    ip_address: ipAddress,
    user_agent: userAgent,
    updated_at: now
  };

  if (granted) {
    updateData.granted_at = now;
    updateData.withdrawn_at = null;
  } else {
    updateData.withdrawn_at = now;
  }

  const { data, error } = await supabase
    .from('gdpr_consents')
    .upsert(updateData, {
      onConflict: 'user_id,consent_type'
    })
    .select()
    .single();

  if (error) throw error;

  await logProcessingActivity(
    userId,
    'consent_change',
    `Consent ${granted ? 'granted' : 'withdrawn'} for ${consentType}`,
    [consentType],
    'consent'
  );

  return data;
}

export async function updateMultipleConsents(
  userId: string,
  consents: { type: string; granted: boolean }[],
  source: string = 'settings',
  ipAddress?: string,
  userAgent?: string
): Promise<Consent[]> {
  const results: Consent[] = [];

  for (const consent of consents) {
    const result = await updateConsent(userId, consent.type, consent.granted, source, ipAddress, userAgent);
    results.push(result);
  }

  return results;
}

export async function hasConsent(userId: string, consentType: string): Promise<boolean> {
  const { data } = await supabase
    .from('gdpr_consents')
    .select('granted')
    .eq('user_id', userId)
    .eq('consent_type', consentType)
    .single();

  return data?.granted === true;
}

// ==================== RETENTION POLICIES ====================

export async function getRetentionPolicies(): Promise<RetentionPolicy[]> {
  const { data, error } = await supabase
    .from('gdpr_retention_policies')
    .select('*')
    .eq('is_active', true)
    .order('data_category');

  if (error) throw error;
  return data || [];
}

export async function updateRetentionPolicy(
  id: string,
  updates: Partial<RetentionPolicy>
): Promise<RetentionPolicy> {
  const client = supabase;

  const { data, error } = await client
    .from('gdpr_retention_policies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function runRetentionCleanup(): Promise<{ deleted: number; categories: string[] }> {
  const client = supabase;

  const { data: policies } = await client
    .from('gdpr_retention_policies')
    .select('*')
    .eq('is_active', true)
    .eq('auto_delete', true);

  let totalDeleted = 0;
  const categories: string[] = [];

  for (const policy of policies || []) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retention_period_days);
    const cutoffStr = cutoffDate.toISOString();

    // FIX: Iteration 15 - Actually delete expired data per category
    // Previously this was a no-op: computed cutoff but never used it (GDPR violation)
    let deleted = 0;
    try {
      switch (policy.data_category) {
        case 'activity_log': {
          const { count } = await client
            .from('gdpr_processing_activities')
            .delete({ count: 'exact' })
            .lt('created_at', cutoffStr);
          deleted = count || 0;
          break;
        }
        case 'support_tickets': {
          const { count } = await client
            .from('support_tickets')
            .delete({ count: 'exact' })
            .eq('status', 'closed')
            .lt('updated_at', cutoffStr);
          deleted = count || 0;
          break;
        }
        case 'analytics':
        case 'marketing': {
          const { count } = await client
            .from('gdpr_consents')
            .delete({ count: 'exact' })
            .eq('consent_type', policy.data_category)
            .eq('granted', false)
            .lt('updated_at', cutoffStr);
          deleted = count || 0;
          break;
        }
        case 'export_requests': {
          const { count } = await client
            .from('gdpr_export_requests')
            .delete({ count: 'exact' })
            .in('status', ['expired', 'failed'])
            .lt('requested_at', cutoffStr);
          deleted = count || 0;
          break;
        }
        default:
          // Unknown category — log but skip to avoid deleting wrong data
          break;
      }
    } catch (err) {
      // Log but continue with other policies
      console.error(`GDPR retention cleanup failed for category ${policy.data_category}:`, err);
    }

    totalDeleted += deleted;
    categories.push(policy.data_category);
  }

  return { deleted: totalDeleted, categories };
}

// ==================== PROCESSING LOG ====================

export async function logProcessingActivity(
  userId: string,
  activityType: string,
  description: string,
  dataCategories: string[],
  legalBasis: string,
  details?: Record<string, any>
): Promise<void> {
  const client = supabase;

  await client.from('gdpr_processing_activities').insert({
    user_id: userId,
    activity_type: activityType,
    description,
    data_categories: dataCategories,
    legal_basis: legalBasis,
    metadata: { processor: 'system', ...(details || {}) }
  });
}

export async function getProcessingLog(
  userId?: string,
  limit: number = 100
): Promise<any[]> {
  let query = supabase
    .from('gdpr_processing_activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ==================== DATA SHARING LOG ====================

export async function logDataSharing(
  userId: string,
  thirdParty: string,
  purpose: string,
  dataShared: string[],
  legalBasis: string
): Promise<void> {
  await supabase.from('gdpr_data_sharing_log').insert({
    user_id: userId,
    third_party: thirdParty,
    purpose,
    data_shared: dataShared,
    legal_basis: legalBasis
  });
}

export async function getDataSharingLog(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('gdpr_data_sharing_log')
    .select('*')
    .eq('user_id', userId)
    .order('shared_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ==================== CLEANUP JOBS ====================

export async function cleanupExpiredExports(): Promise<number> {
  const client = supabase;

  const { data: expiredRequests } = await client
    .from('gdpr_export_requests')
    .select('id, file_path')
    .eq('status', 'completed')
    .lt('file_expires_at', new Date().toISOString());

  let cleaned = 0;
  for (const request of expiredRequests || []) {
    try {
      if (request.file_path) {
        await unlinkAsync(request.file_path);
      }
      await client
        .from('gdpr_export_requests')
        .update({ status: 'expired', file_path: null })
        .eq('id', request.id);
      cleaned++;
    } catch (err) {
      console.error(`Failed to cleanup export ${request.id}:`, err);
    }
  }

  return cleaned;
}

// ==================== IP HASHING (GDPR Data Minimisation) ====================

/**
 * Hash an IP address using SHA-256 with a salt.
 * GDPR Article 5(1)(c) requires data minimisation — storing full IP addresses
 * when only a record of the network context is needed violates this principle.
 * We hash the IP so the record is non-reversible but still useful for
 * detecting duplicate consent submissions from the same network.
 */
function hashIpAddress(ip: string | undefined): string | null {
  if (!ip) return null;
  // Use a static salt to allow duplicate detection without storing raw IPs
  const salt = process.env.GDPR_IP_HASH_SALT || 'v2-gdpr-consent-salt';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').substring(0, 16);
}

// ==================== COOKIE CONSENT RECORDING ====================

export interface CookieConsentInput {
  userId?: string;
  consentVersion: string;
  categoriesAccepted: string[];
  categoriesRejected: string[];
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Record a cookie consent decision.
 * Works for both authenticated and anonymous users.
 * IP addresses are hashed before storage per GDPR data minimisation.
 */
export async function recordCookieConsent(input: CookieConsentInput): Promise<{ id: string }> {
  const client = supabase;

  const hashedIp = hashIpAddress(input.ipAddress);

  const { data, error } = await client
    .from('gdpr_cookie_consents')
    .insert({
      user_id: input.userId || null,
      consent_version: input.consentVersion,
      categories_accepted: input.categoriesAccepted,
      categories_rejected: input.categoriesRejected,
      ip_address_hash: hashedIp,
      user_agent: input.userAgent?.substring(0, 512) || null, // Truncate user-agent
      granted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to record cookie consent:', error);
    throw new Error('Failed to record cookie consent');
  }

  return { id: data.id };
}

