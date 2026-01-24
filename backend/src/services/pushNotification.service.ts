/**
 * Push Notification Service
 * 
 * Provides unified push notification delivery across platforms:
 * - Firebase Cloud Messaging (FCM) for Android
 * - Apple Push Notification Service (APNS) via FCM for iOS
 * - Web Push for PWA
 * 
 * @module services/pushNotification
 */

import { logger } from '../utils/logger.js';
import { getSupabase } from '../database/connection.js';
import { config } from '../config/index.js';

// Types for push notifications
export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  badge?: number;
  sound?: string;
  // iOS specific
  aps?: {
    alert?: { title: string; body: string };
    badge?: number;
    sound?: string;
    'content-available'?: number;
    'mutable-content'?: number;
  };
  // Android specific
  android?: {
    channelId?: string;
    priority?: 'default' | 'high';
    ttl?: number;
  };
}

export interface NotificationTarget {
  userId?: string;
  deviceTokens?: string[];
  topic?: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  failedTokens?: string[];
}

export type NotificationType = 
  | 'order_placed'
  | 'order_status_update'
  | 'order_ready'
  | 'booking_confirmed'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'promotion'
  | 'loyalty_points'
  | 'gift_card'
  | 'system';

// Firebase Admin SDK types - dynamically imported
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseAdmin: any = null;
let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK
 */
async function initializeFirebase(): Promise<boolean> {
  if (firebaseInitialized) return true;
  
  try {
    // Check if Firebase credentials are configured
    const serviceAccount = config.firebase?.serviceAccountPath || process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccount) {
      logger.info('Firebase not configured - push notifications will be logged only');
      return false;
    }

    // Dynamic import of firebase-admin (optional dependency)
    try {
      // @ts-expect-error - firebase-admin is an optional dependency
      firebaseAdmin = await import('firebase-admin');
    } catch {
      logger.info('firebase-admin package not installed - push notifications will be mocked');
      return false;
    }
    
    // Initialize with service account
    if (typeof serviceAccount === 'string' && serviceAccount.startsWith('{')) {
      // JSON string
      const credentials = JSON.parse(serviceAccount);
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(credentials),
      });
    } else {
      // File path - use dynamic import with assertion
      try {
        const fs = await import('fs');
        const credentialsJson = fs.readFileSync(serviceAccount, 'utf-8');
        const credentials = JSON.parse(credentialsJson);
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert(credentials),
        });
      } catch (fileError) {
        logger.warn('Could not load Firebase credentials file:', fileError);
        return false;
      }
    }
    
    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized successfully');
    return true;
  } catch (error) {
    logger.warn('Firebase initialization failed - push notifications disabled:', error);
    return false;
  }
}

/**
 * Get active device tokens for a user
 */
export async function getUserDeviceTokens(userId: string): Promise<{
  token: string;
  platform: 'ios' | 'android' | 'web';
  id: string;
}[]> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('device_tokens')
    .select('id, device_token, platform')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('notifications_enabled', true);

  if (error) {
    logger.error('Error fetching device tokens:', error);
    return [];
  }

  return (data || []).map(d => ({
    id: d.id,
    token: d.device_token,
    platform: d.platform as 'ios' | 'android' | 'web',
  }));
}

/**
 * Send push notification to specific device tokens
 */
export async function sendToTokens(
  tokens: string[],
  payload: PushNotificationPayload,
  options?: {
    notificationType?: NotificationType;
    referenceType?: string;
    referenceId?: string;
    userId?: string;
  }
): Promise<NotificationResult> {
  if (tokens.length === 0) {
    return { success: true, messageId: 'no_tokens' };
  }

  const isFirebaseReady = await initializeFirebase();
  
  if (!isFirebaseReady || !firebaseAdmin) {
    // Log notification for development/testing
    logger.info('Push notification (mock):', {
      tokens: tokens.slice(0, 3),
      tokenCount: tokens.length,
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
    
    // Log to database for audit
    await logNotification({
      title: payload.title,
      body: payload.body,
      data: payload.data,
      status: 'sent',
      provider: 'mock',
      userId: options?.userId,
      notificationType: options?.notificationType,
      referenceType: options?.referenceType,
      referenceId: options?.referenceId,
    });
    
    return { success: true, messageId: 'mock_' + Date.now() };
  }

  try {
    // Build FCM message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message: any = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      android: {
        priority: payload.android?.priority === 'high' ? 'high' : 'normal',
        notification: {
          channelId: payload.android?.channelId || 'default',
          sound: payload.sound || 'default',
        },
        ttl: (payload.android?.ttl || 3600) * 1000, // Convert to milliseconds
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            badge: payload.badge,
            sound: payload.sound || 'default',
            'content-available': payload.aps?.['content-available'],
            'mutable-content': payload.aps?.['mutable-content'],
          },
        },
      },
    };

    const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
    
    // Track failed tokens for cleanup
    const failedTokens: string[] = [];
    response.responses.forEach((resp: { success: boolean; error?: { code: string } }, idx: number) => {
      if (!resp.success && resp.error) {
        const errorCode = resp.error.code;
        // Mark tokens as invalid if they're unregistered
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          failedTokens.push(tokens[idx]);
        }
        logger.warn(`FCM send failed for token ${idx}:`, resp.error);
      }
    });

    // Deactivate invalid tokens
    if (failedTokens.length > 0) {
      await deactivateTokens(failedTokens);
    }

    // Log notification
    await logNotification({
      title: payload.title,
      body: payload.body,
      data: payload.data,
      status: response.successCount > 0 ? 'sent' : 'failed',
      provider: 'fcm',
      userId: options?.userId,
      notificationType: options?.notificationType,
      referenceType: options?.referenceType,
      referenceId: options?.referenceId,
      errorMessage: response.failureCount > 0 ? `${response.failureCount} failed` : undefined,
    });

    return {
      success: response.successCount > 0,
      messageId: `fcm_batch_${Date.now()}`,
      failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
    };
  } catch (error) {
    logger.error('FCM send error:', error);
    
    await logNotification({
      title: payload.title,
      body: payload.body,
      data: payload.data,
      status: 'failed',
      provider: 'fcm',
      userId: options?.userId,
      notificationType: options?.notificationType,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send push notification to a user (all their devices)
 */
export async function sendToUser(
  userId: string,
  payload: PushNotificationPayload,
  options?: {
    notificationType?: NotificationType;
    referenceType?: string;
    referenceId?: string;
  }
): Promise<NotificationResult> {
  const devices = await getUserDeviceTokens(userId);
  
  if (devices.length === 0) {
    logger.debug(`No active device tokens for user ${userId}`);
    return { success: true, messageId: 'no_devices' };
  }

  const tokens = devices.map(d => d.token);
  
  return sendToTokens(tokens, payload, {
    ...options,
    userId,
  });
}

/**
 * Send push notification to multiple users
 */
export async function sendToUsers(
  userIds: string[],
  payload: PushNotificationPayload,
  options?: {
    notificationType?: NotificationType;
    referenceType?: string;
    referenceId?: string;
  }
): Promise<{ successful: number; failed: number }> {
  let successful = 0;
  let failed = 0;

  // Process in batches to avoid overwhelming FCM
  const batchSize = 10;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    
    const results = await Promise.all(
      batch.map(userId => sendToUser(userId, payload, options))
    );

    results.forEach(result => {
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    });
  }

  return { successful, failed };
}

/**
 * Send notification to a topic (e.g., all users, specific role)
 */
export async function sendToTopic(
  topic: string,
  payload: PushNotificationPayload,
  options?: {
    notificationType?: NotificationType;
  }
): Promise<NotificationResult> {
  const isFirebaseReady = await initializeFirebase();
  
  if (!isFirebaseReady || !firebaseAdmin) {
    logger.info('Topic notification (mock):', { topic, ...payload });
    return { success: true, messageId: 'mock_topic_' + Date.now() };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message: any = {
      topic,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
    };

    const messageId = await firebaseAdmin.messaging().send(message);
    
    await logNotification({
      title: payload.title,
      body: payload.body,
      data: payload.data,
      status: 'sent',
      provider: 'fcm_topic',
      providerMessageId: messageId,
      notificationType: options?.notificationType,
    });

    return { success: true, messageId };
  } catch (error) {
    logger.error('FCM topic send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Deactivate invalid device tokens
 */
async function deactivateTokens(tokens: string[]): Promise<void> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('device_tokens')
    .update({ is_active: false })
    .in('device_token', tokens);

  if (error) {
    logger.error('Error deactivating tokens:', error);
  } else {
    logger.info(`Deactivated ${tokens.length} invalid device tokens`);
  }
}

/**
 * Log notification for audit trail
 */
async function logNotification(params: {
  title: string;
  body?: string;
  data?: Record<string, string>;
  status: string;
  provider: string;
  providerMessageId?: string;
  userId?: string;
  deviceTokenId?: string;
  notificationType?: string;
  referenceType?: string;
  referenceId?: string;
  errorMessage?: string;
}): Promise<void> {
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from('notification_logs')
    .insert({
      title: params.title,
      body: params.body,
      data: params.data || {},
      status: params.status,
      provider: params.provider,
      provider_message_id: params.providerMessageId,
      user_id: params.userId,
      device_token_id: params.deviceTokenId,
      notification_type: params.notificationType,
      reference_type: params.referenceType,
      reference_id: params.referenceId,
      error_message: params.errorMessage,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    });

  if (error) {
    logger.error('Error logging notification:', error);
  }
}

// Notification templates for common scenarios
export const NotificationTemplates = {
  orderPlaced: (orderId: string, orderNumber: string) => ({
    title: '🎉 Order Confirmed!',
    body: `Your order #${orderNumber} has been received and is being prepared.`,
    data: { type: 'order_placed', orderId, orderNumber },
  }),
  
  orderReady: (orderId: string, orderNumber: string) => ({
    title: '✅ Order Ready!',
    body: `Your order #${orderNumber} is ready for pickup!`,
    data: { type: 'order_ready', orderId, orderNumber },
  }),
  
  orderStatusUpdate: (orderId: string, orderNumber: string, status: string) => ({
    title: '📦 Order Update',
    body: `Your order #${orderNumber} status: ${status}`,
    data: { type: 'order_status_update', orderId, orderNumber, status },
  }),
  
  bookingConfirmed: (bookingId: string, chaletName: string, checkIn: string) => ({
    title: '🏠 Booking Confirmed!',
    body: `Your booking at ${chaletName} for ${checkIn} is confirmed.`,
    data: { type: 'booking_confirmed', bookingId, chaletName, checkIn },
  }),
  
  bookingReminder: (bookingId: string, chaletName: string, checkIn: string) => ({
    title: '⏰ Booking Reminder',
    body: `Don't forget! Your stay at ${chaletName} is tomorrow (${checkIn}).`,
    data: { type: 'booking_reminder', bookingId, chaletName, checkIn },
  }),
  
  paymentReceived: (amount: string, referenceId: string) => ({
    title: '💳 Payment Received',
    body: `We've received your payment of ${amount}. Thank you!`,
    data: { type: 'payment_received', amount, referenceId },
  }),
  
  loyaltyPointsEarned: (points: number, totalPoints: number) => ({
    title: '⭐ Points Earned!',
    body: `You earned ${points} loyalty points! Total: ${totalPoints}`,
    data: { type: 'loyalty_points', points: String(points), totalPoints: String(totalPoints) },
  }),
  
  promotion: (title: string, message: string, promoCode?: string) => ({
    title: `🎁 ${title}`,
    body: message,
    data: { type: 'promotion', promoCode: promoCode || '' },
  }),
};

export default {
  sendToTokens,
  sendToUser,
  sendToUsers,
  sendToTopic,
  getUserDeviceTokens,
  NotificationTemplates,
};
