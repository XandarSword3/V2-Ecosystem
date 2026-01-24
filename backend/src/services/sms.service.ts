/**
 * V2 Resort - SMS Notification Service
 * Twilio integration for SMS notifications
 */

import { Twilio } from 'twilio';
import { supabase } from '../lib/supabase';
import { activityLogger } from '../utils/activityLogger';

// Twilio client - initialized lazily
let twilioClient: Twilio | null = null;

const getTwilioClient = (): Twilio => {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }

    twilioClient = new Twilio(accountSid, authToken);
  }
  return twilioClient;
};

export interface SMSMessage {
  id?: string;
  to: string;
  body: string;
  template?: string;
  template_data?: Record<string, any>;
  status?: SMSStatus;
  provider_message_id?: string;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
}

export type SMSStatus = 
  | 'pending'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered';

// SMS templates
const SMS_TEMPLATES: Record<string, (data: Record<string, any>) => string> = {
  'booking-confirmation': (data) =>
    `V2 Resort: Your booking #${data.booking_id} is confirmed for ${data.check_in_date}. Check-in: ${data.check_in_time}. Questions? Call ${data.resort_phone}`,

  'booking-reminder': (data) =>
    `V2 Resort: Reminder - Your stay begins ${data.check_in_date}. Looking forward to hosting you! Check-in from ${data.check_in_time}.`,

  'pool-ticket': (data) =>
    `V2 Resort Pool: Your ticket for ${data.session_date} ${data.session_time} is ready. Show this SMS or your QR code at entry. Ticket #${data.ticket_id}`,

  'order-ready': (data) =>
    `V2 Resort Kitchen: Your order #${data.order_id} is ready for pickup${data.location ? ` at ${data.location}` : ''}!`,

  'payment-confirmation': (data) =>
    `V2 Resort: Payment of ${data.amount} received. Transaction #${data.transaction_id}. Thank you!`,

  'password-reset': (data) =>
    `V2 Resort: Your password reset code is ${data.code}. Valid for 10 minutes. Don't share this code.`,

  '2fa-code': (data) =>
    `V2 Resort: Your verification code is ${data.code}. Valid for 5 minutes.`,

  'cancellation': (data) =>
    `V2 Resort: Your booking #${data.booking_id} has been cancelled. ${data.refund_amount ? `Refund of ${data.refund_amount} will be processed.` : ''}`,

  'alert': (data) =>
    `V2 Resort Alert: ${data.message}`,
};

class SMSService {
  private fromNumber: string;
  private isEnabled: boolean = false;

  constructor() {
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.isEnabled = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      this.fromNumber
    );

    if (!this.isEnabled) {
      console.warn('[SMSService] Twilio not configured - SMS disabled');
    }
  }

  /**
   * Send SMS using a template
   */
  async sendTemplatedSMS(
    to: string,
    template: string,
    data: Record<string, any>,
    userId?: string
  ): Promise<SMSMessage> {
    const templateFn = SMS_TEMPLATES[template];
    if (!templateFn) {
      throw new Error(`SMS template not found: ${template}`);
    }

    const body = templateFn(data);
    return this.sendSMS(to, body, template, data, userId);
  }

  /**
   * Send raw SMS
   */
  async sendSMS(
    to: string,
    body: string,
    template?: string,
    templateData?: Record<string, any>,
    userId?: string
  ): Promise<SMSMessage> {
    // Normalize phone number
    to = this.normalizePhoneNumber(to);

    if (!this.isValidPhoneNumber(to)) {
      throw new Error(`Invalid phone number: ${to}`);
    }

    // Check if user has opted in to SMS
    if (userId) {
      const hasConsent = await this.checkSMSConsent(userId);
      if (!hasConsent) {
        console.log(`[SMSService] User ${userId} has not opted in to SMS`);
        return {
          to,
          body,
          template,
          status: 'failed',
          error_message: 'User has not opted in to SMS notifications',
        };
      }
    }

    // Record in database
    const { data: smsRecord, error: insertError } = await supabase
      .from('sms_messages')
      .insert({
        to,
        body,
        template,
        template_data: templateData,
        status: 'pending',
        user_id: userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[SMSService] Failed to record SMS:', insertError);
    }

    // If SMS is not enabled, just log and return
    if (!this.isEnabled) {
      console.log(`[SMSService] SMS disabled - would send to ${to}: ${body}`);
      if (smsRecord) {
        await supabase
          .from('sms_messages')
          .update({ status: 'failed', error_message: 'SMS service not configured' })
          .eq('id', smsRecord.id);
      }
      return {
        id: smsRecord?.id,
        to,
        body,
        template,
        status: 'failed',
        error_message: 'SMS service not configured',
      };
    }

    try {
      const client = getTwilioClient();
      const message = await client.messages.create({
        body,
        to,
        from: this.fromNumber,
        statusCallback: `${process.env.BACKEND_URL}/webhooks/twilio/status`,
      });

      // Update record with provider message ID
      if (smsRecord) {
        await supabase
          .from('sms_messages')
          .update({
            provider_message_id: message.sid,
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', smsRecord.id);
      }

      // Log activity
      await activityLogger.log({
        action: 'sms_sent',
        entity_type: 'sms',
        entity_id: smsRecord?.id || message.sid,
        user_id: userId,
        details: {
          to,
          template,
          provider_id: message.sid,
        },
      });

      console.log(`[SMSService] SMS sent to ${to}: ${message.sid}`);

      return {
        id: smsRecord?.id,
        to,
        body,
        template,
        status: 'sent',
        provider_message_id: message.sid,
        sent_at: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('[SMSService] Failed to send SMS:', error);

      // Update record with error
      if (smsRecord) {
        await supabase
          .from('sms_messages')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', smsRecord.id);
      }

      return {
        id: smsRecord?.id,
        to,
        body,
        template,
        status: 'failed',
        error_message: error.message,
      };
    }
  }

  /**
   * Handle Twilio status webhook
   */
  async handleStatusWebhook(data: {
    MessageSid: string;
    MessageStatus: string;
    ErrorCode?: string;
    ErrorMessage?: string;
  }): Promise<void> {
    const status = this.mapTwilioStatus(data.MessageStatus);

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    if (data.ErrorMessage) {
      updateData.error_message = data.ErrorMessage;
    }

    const { error } = await supabase
      .from('sms_messages')
      .update(updateData)
      .eq('provider_message_id', data.MessageSid);

    if (error) {
      console.error('[SMSService] Failed to update SMS status:', error);
    }

    console.log(`[SMSService] Status update: ${data.MessageSid} -> ${status}`);
  }

  /**
   * Map Twilio status to our status
   */
  private mapTwilioStatus(twilioStatus: string): SMSStatus {
    const statusMap: Record<string, SMSStatus> = {
      queued: 'queued',
      sending: 'sent',
      sent: 'sent',
      delivered: 'delivered',
      undelivered: 'undelivered',
      failed: 'failed',
    };

    return statusMap[twilioStatus] || 'pending';
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Add + if not present and starts with country code
    if (!normalized.startsWith('+')) {
      // Assume country code based on configuration
      const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '1'; // US default
      normalized = `+${defaultCountryCode}${normalized}`;
    }

    return normalized;
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phone: string): boolean {
    // E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }

  /**
   * Check if user has consented to SMS
   */
  private async checkSMSConsent(userId: string): Promise<boolean> {
    const { data: user, error } = await supabase
      .from('users')
      .select('notification_preferences')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return false;
    }

    return user.notification_preferences?.sms !== false;
  }

  /**
   * Get SMS statistics
   */
  async getStatistics(period: 'day' | 'week' | 'month' = 'week'): Promise<{
    total_sent: number;
    delivered: number;
    failed: number;
    pending: number;
    delivery_rate: number;
    by_template: Record<string, number>;
    by_status: Record<string, number>;
  }> {
    const periodMs = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    const fromDate = new Date(Date.now() - periodMs[period]).toISOString();

    const { data: messages, error } = await supabase
      .from('sms_messages')
      .select('status, template')
      .gte('created_at', fromDate);

    if (error) {
      throw error;
    }

    interface SmsRecord {
      status?: string;
    }

    const stats = {
      total_sent: messages?.filter((m: SmsRecord) => m.status !== 'pending').length || 0,
      delivered: messages?.filter((m: SmsRecord) => m.status === 'delivered').length || 0,
      failed: messages?.filter((m: SmsRecord) => m.status === 'failed' || m.status === 'undelivered').length || 0,
      pending: messages?.filter((m: SmsRecord) => m.status === 'pending' || m.status === 'queued').length || 0,
      delivery_rate: 0,
      by_template: {} as Record<string, number>,
      by_status: {} as Record<string, number>,
    };

    // Calculate delivery rate
    if (stats.total_sent > 0) {
      stats.delivery_rate = (stats.delivered / stats.total_sent) * 100;
    }

    // Group by template and status
    for (const msg of messages || []) {
      if (msg.template) {
        stats.by_template[msg.template] = (stats.by_template[msg.template] || 0) + 1;
      }
      stats.by_status[msg.status] = (stats.by_status[msg.status] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get SMS history for a user
   */
  async getUserSMSHistory(
    userId: string,
    limit: number = 20
  ): Promise<SMSMessage[]> {
    const { data, error } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Check if SMS service is enabled
   */
  isServiceEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get available SMS templates
   */
  getAvailableTemplates(): string[] {
    return Object.keys(SMS_TEMPLATES);
  }

  /**
   * Preview template with sample data
   */
  previewTemplate(template: string, data: Record<string, any>): string | null {
    const templateFn = SMS_TEMPLATES[template];
    if (!templateFn) {
      return null;
    }
    return templateFn(data);
  }
}

export const smsService = new SMSService();
