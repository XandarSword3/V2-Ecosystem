/**
 * V2 Resort - Email Bounce Handling Service
 * Manages email bounces, complaints, and suppression list
 */

import { supabase } from '../lib/supabase';
import { activityLogger } from '../utils/activityLogger';
import { logger } from '../utils/logger';

export interface EmailBounce {
  id: string;
  email: string;
  bounce_type: BounceType;
  bounce_subtype?: string;
  reason: string;
  provider_message_id?: string;
  bounced_at: string;
  created_at: string;
}

export type BounceType = 'hard' | 'soft' | 'complaint' | 'unsubscribe';

export interface SuppressionEntry {
  email: string;
  reason: BounceType | 'manual';
  notes?: string;
  added_at: string;
  added_by?: string;
}

class BounceHandlerService {
  private readonly SOFT_BOUNCE_THRESHOLD = 3; // Suppress after 3 soft bounces
  private readonly SOFT_BOUNCE_WINDOW = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Handle bounce webhook from SendGrid/email provider
   */
  async handleBounce(data: {
    email: string;
    type: BounceType;
    subtype?: string;
    reason: string;
    messageId?: string;
    timestamp?: string;
  }): Promise<void> {
    logger.info(`[BounceHandler] Processing bounce for ${data.email}: ${data.type}`);

    // Record the bounce
    const { error: bounceError } = await supabase.from('email_bounces').insert({
      email: data.email.toLowerCase(),
      bounce_type: data.type,
      bounce_subtype: data.subtype,
      reason: data.reason,
      provider_message_id: data.messageId,
      bounced_at: data.timestamp || new Date().toISOString(),
    });

    if (bounceError) {
      logger.error('[BounceHandler] Failed to record bounce:', bounceError);
    }

    // Handle based on bounce type
    switch (data.type) {
      case 'hard':
        // Hard bounces are permanent - immediately add to suppression
        await this.addToSuppressionList(data.email, 'hard', data.reason);
        break;

      case 'soft':
        // Check if soft bounces exceed threshold
        await this.handleSoftBounce(data.email);
        break;

      case 'complaint':
        // Spam complaints - immediately suppress and mark user preference
        await this.addToSuppressionList(data.email, 'complaint', data.reason);
        await this.updateUserEmailPreference(data.email, false);
        break;

      case 'unsubscribe':
        // User clicked unsubscribe link
        await this.addToSuppressionList(data.email, 'unsubscribe', 'User unsubscribed');
        await this.updateUserEmailPreference(data.email, false);
        break;
    }

    // Log activity
    await activityLogger.log({
      action: 'email_bounced',
      entity_type: 'email',
      entity_id: data.messageId || data.email,
      details: {
        email: data.email,
        type: data.type,
        reason: data.reason,
      },
    });
  }

  /**
   * Handle soft bounce - check threshold and suppress if exceeded
   */
  private async handleSoftBounce(email: string): Promise<void> {
    const windowStart = new Date(Date.now() - this.SOFT_BOUNCE_WINDOW).toISOString();

    // Count recent soft bounces
    const { count, error } = await supabase
      .from('email_bounces')
      .select('*', { count: 'exact', head: true })
      .eq('email', email.toLowerCase())
      .eq('bounce_type', 'soft')
      .gte('bounced_at', windowStart);

    if (error) {
      logger.error('[BounceHandler] Failed to count soft bounces:', error);
      return;
    }

    if ((count || 0) >= this.SOFT_BOUNCE_THRESHOLD) {
      logger.info(`[BounceHandler] Soft bounce threshold reached for ${email}`);
      await this.addToSuppressionList(
        email,
        'soft',
        `${count} soft bounces in 7 days`
      );
    }
  }

  /**
   * Add email to suppression list
   */
  async addToSuppressionList(
    email: string,
    reason: BounceType | 'manual',
    notes?: string,
    addedBy?: string
  ): Promise<boolean> {
    email = email.toLowerCase();

    // Check if already suppressed
    const { data: existing } = await supabase
      .from('email_suppression_list')
      .select('email')
      .eq('email', email)
      .single();

    if (existing) {
      logger.debug(`[BounceHandler] Email already suppressed: ${email}`);
      return false;
    }

    const { error } = await supabase.from('email_suppression_list').insert({
      email,
      reason,
      notes,
      added_by: addedBy,
      added_at: new Date().toISOString(),
    });

    if (error) {
      logger.error('[BounceHandler] Failed to add to suppression list:', error);
      return false;
    }

    logger.info(`[BounceHandler] Added to suppression list: ${email} (${reason})`);
    return true;
  }

  /**
   * Remove email from suppression list
   */
  async removeFromSuppressionList(
    email: string,
    removedBy: string,
    reason: string
  ): Promise<boolean> {
    email = email.toLowerCase();

    const { data: entry, error: fetchError } = await supabase
      .from('email_suppression_list')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !entry) {
      return false;
    }

    const { error } = await supabase
      .from('email_suppression_list')
      .delete()
      .eq('email', email);

    if (error) {
      logger.error('[BounceHandler] Failed to remove from suppression list:', error);
      return false;
    }

    // Log the removal
    await activityLogger.log({
      action: 'email_unsuppressed',
      entity_type: 'email',
      entity_id: email,
      user_id: removedBy,
      details: {
        email,
        original_reason: entry.reason,
        removal_reason: reason,
      },
    });

    logger.info(`[BounceHandler] Removed from suppression list: ${email}`);
    return true;
  }

  /**
   * Check if email is suppressed
   */
  async isEmailSuppressed(email: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('email_suppression_list')
      .select('email')
      .eq('email', email.toLowerCase())
      .single();

    return !!data && !error;
  }

  /**
   * Get suppression entry for an email
   */
  async getSuppressionEntry(email: string): Promise<SuppressionEntry | null> {
    const { data, error } = await supabase
      .from('email_suppression_list')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  /**
   * Update user email preference in users table
   */
  private async updateUserEmailPreference(
    email: string,
    receiveEmails: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        email_preferences: {
          marketing: receiveEmails,
          transactional: true, // Always allow transactional
        },
        updated_at: new Date().toISOString(),
      })
      .eq('email', email.toLowerCase());

    if (error) {
      console.error('[BounceHandler] Failed to update user preference:', error);
    }
  }

  /**
   * Get bounce statistics
   */
  async getStatistics(period: 'day' | 'week' | 'month' = 'week'): Promise<{
    total_bounces: number;
    hard_bounces: number;
    soft_bounces: number;
    complaints: number;
    suppressed_emails: number;
    bounce_rate: number;
    by_day: Array<{ date: string; count: number }>;
  }> {
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    const fromDate = new Date(Date.now() - periodMs[period]).toISOString();

    // Get bounce counts by type
    const { data: bounces, error } = await supabase
      .from('email_bounces')
      .select('bounce_type, bounced_at')
      .gte('bounced_at', fromDate);

    if (error) {
      throw error;
    }

    // Get suppressed count
    const { count: suppressedCount } = await supabase
      .from('email_suppression_list')
      .select('*', { count: 'exact', head: true });

    // Get total emails sent (from a tracking table if available)
    // For now, we'll estimate from bounces
    interface BounceRecord {
      bounce_type?: string;
    }

    const stats = {
      total_bounces: bounces?.length || 0,
      hard_bounces: bounces?.filter((b: BounceRecord) => b.bounce_type === 'hard').length || 0,
      soft_bounces: bounces?.filter((b: BounceRecord) => b.bounce_type === 'soft').length || 0,
      complaints: bounces?.filter((b: BounceRecord) => b.bounce_type === 'complaint').length || 0,
      suppressed_emails: suppressedCount || 0,
      bounce_rate: 0, // Would need total sent to calculate
      by_day: this.groupByDay(bounces || []),
    };

    return stats;
  }

  /**
   * Group bounces by day
   */
  private groupByDay(
    bounces: Array<{ bounced_at: string }>
  ): Array<{ date: string; count: number }> {
    const grouped: Record<string, number> = {};

    for (const bounce of bounces) {
      const date = bounce.bounced_at.split('T')[0];
      grouped[date] = (grouped[date] || 0) + 1;
    }

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get suppression list with pagination
   */
  async getSuppressionList(options: {
    limit?: number;
    offset?: number;
    reason?: string;
    search?: string;
  }): Promise<{ data: SuppressionEntry[]; total: number }> {
    let query = supabase
      .from('email_suppression_list')
      .select('*', { count: 'exact' });

    if (options.reason) {
      query = query.eq('reason', options.reason);
    }

    if (options.search) {
      query = query.ilike('email', `%${options.search}%`);
    }

    query = query
      .order('added_at', { ascending: false })
      .range(
        options.offset || 0,
        (options.offset || 0) + (options.limit || 50) - 1
      );

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: data || [],
      total: count || 0,
    };
  }

  /**
   * Bulk import suppression list
   */
  async bulkImportSuppression(
    emails: string[],
    reason: BounceType | 'manual',
    importedBy: string
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const email of emails) {
      const added = await this.addToSuppressionList(
        email,
        reason,
        'Bulk import',
        importedBy
      );

      if (added) {
        imported++;
      } else {
        skipped++;
      }
    }

    await activityLogger.log({
      action: 'suppression_bulk_import',
      entity_type: 'email',
      entity_id: 'bulk',
      user_id: importedBy,
      details: {
        total: emails.length,
        imported,
        skipped,
        reason,
      },
    });

    return { imported, skipped };
  }

  /**
   * Export suppression list
   */
  async exportSuppressionList(): Promise<string> {
    const { data, error } = await supabase
      .from('email_suppression_list')
      .select('*')
      .order('added_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Convert to CSV
    const headers = ['email', 'reason', 'notes', 'added_at', 'added_by'];
    const rows = [headers.join(',')];

    for (const entry of data || []) {
      const row = [
        entry.email,
        entry.reason,
        entry.notes || '',
        entry.added_at,
        entry.added_by || '',
      ].map((field) => `"${String(field).replace(/"/g, '""')}"`);
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Validate email before sending (check suppression)
   */
  async canSendTo(email: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const suppression = await this.getSuppressionEntry(email);

    if (suppression) {
      return {
        allowed: false,
        reason: `Email suppressed: ${suppression.reason}`,
      };
    }

    return { allowed: true };
  }
}

export const bounceHandlerService = new BounceHandlerService();
