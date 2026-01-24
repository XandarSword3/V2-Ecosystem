/**
 * V2 Resort - Notification Preferences Service
 * Manages user notification preferences across all channels
 */

import { supabase } from '../lib/supabase';
import { activityLogger } from '../utils/activityLogger';

export interface NotificationPreferences {
  email: {
    enabled: boolean;
    booking_confirmations: boolean;
    booking_reminders: boolean;
    promotional: boolean;
    newsletters: boolean;
    order_updates: boolean;
    payment_receipts: boolean;
    security_alerts: boolean;
  };
  sms: {
    enabled: boolean;
    booking_confirmations: boolean;
    booking_reminders: boolean;
    order_ready: boolean;
    security_codes: boolean;
  };
  push: {
    enabled: boolean;
    order_updates: boolean;
    promotions: boolean;
    general_alerts: boolean;
  };
  in_app: {
    enabled: boolean;
    all_notifications: boolean;
  };
  quiet_hours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;   // HH:mm format
    timezone: string;
  };
  language: string;
  digest: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'never';
    day_of_week?: number; // 0-6 for weekly
    time: string; // HH:mm format
  };
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: {
    enabled: true,
    booking_confirmations: true,
    booking_reminders: true,
    promotional: true,
    newsletters: true,
    order_updates: true,
    payment_receipts: true,
    security_alerts: true,
  },
  sms: {
    enabled: false, // Require opt-in
    booking_confirmations: true,
    booking_reminders: true,
    order_ready: true,
    security_codes: true,
  },
  push: {
    enabled: true,
    order_updates: true,
    promotions: false,
    general_alerts: true,
  },
  in_app: {
    enabled: true,
    all_notifications: true,
  },
  quiet_hours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
    timezone: 'Europe/Rome',
  },
  language: 'en',
  digest: {
    enabled: false,
    frequency: 'never',
    time: '09:00',
  },
};

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export type NotificationType =
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancellation'
  | 'order_update'
  | 'order_ready'
  | 'payment_receipt'
  | 'promotional'
  | 'newsletter'
  | 'security_alert'
  | 'system_alert';

class NotificationPreferencesService {
  /**
   * Get user's notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const { data: user, error } = await supabase
      .from('users')
      .select('notification_preferences')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[NotificationPreferences] Error fetching preferences:', error);
      return DEFAULT_PREFERENCES;
    }

    // Merge with defaults to ensure all fields exist
    return this.mergeWithDefaults(user?.notification_preferences || {});
  }

  /**
   * Update user's notification preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    // Get current preferences
    const current = await this.getPreferences(userId);

    // Deep merge with updates
    const merged = this.deepMerge(current, updates);

    // Update in database
    const { error } = await supabase
      .from('users')
      .update({ notification_preferences: merged })
      .eq('id', userId);

    if (error) {
      throw error;
    }

    // Log the update
    await activityLogger.log({
      action: 'notification_preferences_updated',
      entity_type: 'user',
      entity_id: userId,
      user_id: userId,
      details: { updated_fields: Object.keys(updates) },
    });

    return merged;
  }

  /**
   * Check if user should receive notification on specific channel
   */
  async shouldNotify(
    userId: string,
    channel: NotificationChannel,
    notificationType: NotificationType
  ): Promise<boolean> {
    const prefs = await this.getPreferences(userId);

    // Check if channel is enabled
    if (!prefs[channel]?.enabled) {
      return false;
    }

    // Check quiet hours
    if (prefs.quiet_hours.enabled && this.isQuietHours(prefs.quiet_hours)) {
      // Only allow security alerts during quiet hours
      if (notificationType !== 'security_alert') {
        return false;
      }
    }

    // Check specific notification type preference
    return this.checkTypePreference(prefs, channel, notificationType);
  }

  /**
   * Check if it's currently quiet hours
   */
  private isQuietHours(quietHours: NotificationPreferences['quiet_hours']): boolean {
    if (!quietHours.enabled) {
      return false;
    }

    // Get current time in user's timezone
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: quietHours.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };

    const currentTime = new Intl.DateTimeFormat('en-US', options).format(now);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = quietHours.start.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;

    const [endHour, endMinute] = quietHours.end.split(':').map(Number);
    const endMinutes = endHour * 60 + endMinute;

    // Handle overnight quiet hours (e.g., 22:00 - 07:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Check type-specific preference
   */
  private checkTypePreference(
    prefs: NotificationPreferences,
    channel: NotificationChannel,
    notificationType: NotificationType
  ): boolean {
    const channelPrefs = prefs[channel] as Record<string, boolean>;

    // Map notification types to preference keys
    const typeMapping: Record<NotificationType, string[]> = {
      booking_confirmation: ['booking_confirmations'],
      booking_reminder: ['booking_reminders'],
      booking_cancellation: ['booking_confirmations'],
      order_update: ['order_updates'],
      order_ready: ['order_ready', 'order_updates'],
      payment_receipt: ['payment_receipts'],
      promotional: ['promotional', 'promotions'],
      newsletter: ['newsletters'],
      security_alert: ['security_alerts', 'security_codes'],
      system_alert: ['general_alerts', 'all_notifications'],
    };

    const keys = typeMapping[notificationType] || [];

    // Check if any of the mapped preferences is true
    for (const key of keys) {
      if (channelPrefs[key] === true) {
        return true;
      }
    }

    // Default to true if no specific preference found
    return keys.length === 0;
  }

  /**
   * Opt-in to SMS notifications
   */
  async optInSMS(userId: string, phoneNumber: string): Promise<void> {
    // Update phone number and enable SMS
    const { error: phoneError } = await supabase
      .from('users')
      .update({ phone: phoneNumber })
      .eq('id', userId);

    if (phoneError) {
      throw phoneError;
    }

    await this.updatePreferences(userId, {
      sms: {
        ...DEFAULT_PREFERENCES.sms,
        enabled: true,
      },
    });

    // Log consent
    await activityLogger.log({
      action: 'sms_opt_in',
      entity_type: 'user',
      entity_id: userId,
      user_id: userId,
      details: { phone: phoneNumber.slice(-4) }, // Log last 4 digits only
    });
  }

  /**
   * Opt-out of SMS notifications
   */
  async optOutSMS(userId: string): Promise<void> {
    await this.updatePreferences(userId, {
      sms: {
        ...DEFAULT_PREFERENCES.sms,
        enabled: false,
      },
    });

    await activityLogger.log({
      action: 'sms_opt_out',
      entity_type: 'user',
      entity_id: userId,
      user_id: userId,
    });
  }

  /**
   * Handle email unsubscribe
   */
  async handleUnsubscribe(
    userId: string,
    unsubscribeType: 'all' | 'promotional' | 'newsletter'
  ): Promise<void> {
    let updates: Partial<NotificationPreferences>;

    switch (unsubscribeType) {
      case 'all':
        updates = {
          email: {
            ...DEFAULT_PREFERENCES.email,
            enabled: false,
          },
        };
        break;
      case 'promotional':
        updates = {
          email: {
            ...(await this.getPreferences(userId)).email,
            promotional: false,
          },
        };
        break;
      case 'newsletter':
        updates = {
          email: {
            ...(await this.getPreferences(userId)).email,
            newsletters: false,
          },
        };
        break;
    }

    await this.updatePreferences(userId, updates);

    await activityLogger.log({
      action: 'email_unsubscribe',
      entity_type: 'user',
      entity_id: userId,
      user_id: userId,
      details: { type: unsubscribeType },
    });
  }

  /**
   * Get users who should receive a specific notification
   */
  async getUsersForNotification(
    userIds: string[],
    channel: NotificationChannel,
    notificationType: NotificationType
  ): Promise<string[]> {
    const results: string[] = [];

    // Batch fetch preferences
    const { data: users, error } = await supabase
      .from('users')
      .select('id, notification_preferences')
      .in('id', userIds);

    if (error) {
      console.error('[NotificationPreferences] Error fetching users:', error);
      return [];
    }

    for (const user of users || []) {
      const prefs = this.mergeWithDefaults(user.notification_preferences || {});

      // Check channel enabled
      if (!prefs[channel]?.enabled) continue;

      // Check quiet hours
      if (prefs.quiet_hours.enabled && this.isQuietHours(prefs.quiet_hours)) {
        if (notificationType !== 'security_alert') continue;
      }

      // Check type preference
      if (this.checkTypePreference(prefs, channel, notificationType)) {
        results.push(user.id);
      }
    }

    return results;
  }

  /**
   * Get notification preferences schema for UI
   */
  getPreferencesSchema(): {
    channels: Array<{
      key: NotificationChannel;
      label: string;
      description: string;
      options: Array<{ key: string; label: string; description: string }>;
    }>;
  } {
    return {
      channels: [
        {
          key: 'email',
          label: 'Email Notifications',
          description: 'Receive notifications via email',
          options: [
            { key: 'booking_confirmations', label: 'Booking Confirmations', description: 'Confirmation emails when you make a booking' },
            { key: 'booking_reminders', label: 'Booking Reminders', description: 'Reminders before your stay' },
            { key: 'order_updates', label: 'Order Updates', description: 'Updates about your food orders' },
            { key: 'payment_receipts', label: 'Payment Receipts', description: 'Receipts for payments' },
            { key: 'promotional', label: 'Promotional', description: 'Special offers and promotions' },
            { key: 'newsletters', label: 'Newsletters', description: 'Monthly newsletters and updates' },
            { key: 'security_alerts', label: 'Security Alerts', description: 'Important security notifications' },
          ],
        },
        {
          key: 'sms',
          label: 'SMS Notifications',
          description: 'Receive notifications via text message',
          options: [
            { key: 'booking_confirmations', label: 'Booking Confirmations', description: 'SMS when you make a booking' },
            { key: 'booking_reminders', label: 'Booking Reminders', description: 'SMS reminders before your stay' },
            { key: 'order_ready', label: 'Order Ready', description: 'SMS when your food order is ready' },
            { key: 'security_codes', label: 'Security Codes', description: 'Verification codes and 2FA' },
          ],
        },
        {
          key: 'push',
          label: 'Push Notifications',
          description: 'Receive push notifications on your device',
          options: [
            { key: 'order_updates', label: 'Order Updates', description: 'Push notifications for order status' },
            { key: 'promotions', label: 'Promotions', description: 'Special offers and deals' },
            { key: 'general_alerts', label: 'General Alerts', description: 'Important system notifications' },
          ],
        },
        {
          key: 'in_app',
          label: 'In-App Notifications',
          description: 'Notifications within the app',
          options: [
            { key: 'all_notifications', label: 'All Notifications', description: 'Show all notifications in-app' },
          ],
        },
      ],
    };
  }

  /**
   * Merge preferences with defaults
   */
  private mergeWithDefaults(prefs: Partial<NotificationPreferences>): NotificationPreferences {
    return this.deepMerge(DEFAULT_PREFERENCES, prefs);
  }

  /**
   * Deep merge utility
   */
  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key of Object.keys(source) as Array<keyof T>) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(targetValue, sourceValue as any);
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[keyof T];
      }
    }

    return result;
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();
