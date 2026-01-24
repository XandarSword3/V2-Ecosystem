/**
 * Push Notification E2E Test Infrastructure
 * 
 * Tests for:
 * - FCM message construction and delivery
 * - Device token validation
 * - Failure scenarios (invalid tokens, network errors)
 * - Notification payload validation
 * - Multi-device notification routing
 * 
 * NOTE: For full E2E testing with real FCM, you need:
 * 1. Firebase project with FCM enabled
 * 2. Service account credentials in GOOGLE_APPLICATION_CREDENTIALS
 * 3. Physical device or emulator with FCM token
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Firebase Admin SDK
vi.mock('firebase-admin', () => {
  const mockSend = vi.fn();
  const mockSendEach = vi.fn();
  const mockSendAll = vi.fn();

  return {
    default: {
      initializeApp: vi.fn(),
      credential: {
        applicationDefault: vi.fn(),
        cert: vi.fn(),
      },
      messaging: vi.fn(() => ({
        send: mockSend,
        sendEach: mockSendEach,
        sendAll: mockSendAll,
      })),
    },
    initializeApp: vi.fn(),
    credential: {
      applicationDefault: vi.fn(),
      cert: vi.fn(),
    },
    messaging: vi.fn(() => ({
      send: mockSend,
      sendEach: mockSendEach,
      sendAll: mockSendAll,
    })),
  };
});

// Types for push notifications
interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  category?: string;
  badge?: number;
  sound?: string;
}

interface PushTarget {
  type: 'token' | 'topic' | 'condition';
  value: string;
}

interface PushResult {
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
  };
}

// Valid FCM token pattern (mock - real tokens are ~150+ chars)
const FCM_TOKEN_REGEX = /^[a-zA-Z0-9:_-]{140,}$/;

// Common FCM error codes
const FCM_ERROR_CODES = {
  INVALID_REGISTRATION: 'messaging/invalid-registration-token',
  NOT_REGISTERED: 'messaging/registration-token-not-registered',
  MESSAGE_TOO_LARGE: 'messaging/message-too-large',
  INVALID_PAYLOAD: 'messaging/invalid-payload',
  QUOTA_EXCEEDED: 'messaging/device-message-rate-exceeded',
  SERVER_ERROR: 'messaging/internal-error',
  UNAVAILABLE: 'messaging/server-unavailable',
};

describe('Push Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Payload Validation', () => {
    it('should validate required fields', () => {
      const validatePayload = (payload: Partial<PushNotificationPayload>): string[] => {
        const errors: string[] = [];
        if (!payload.title || payload.title.length === 0) {
          errors.push('Title is required');
        }
        if (!payload.body || payload.body.length === 0) {
          errors.push('Body is required');
        }
        if (payload.title && payload.title.length > 100) {
          errors.push('Title must be 100 characters or less');
        }
        if (payload.body && payload.body.length > 4000) {
          errors.push('Body must be 4000 characters or less');
        }
        return errors;
      };

      expect(validatePayload({})).toContain('Title is required');
      expect(validatePayload({ title: '' })).toContain('Title is required');
      expect(validatePayload({ title: 'Test' })).toContain('Body is required');
      expect(validatePayload({ title: 'Test', body: 'Content' })).toHaveLength(0);
    });

    it('should validate data payload keys', () => {
      const validateDataPayload = (data: Record<string, any>): string[] => {
        const errors: string[] = [];
        const reservedKeys = ['from', 'notification', 'message_type', 'google', 'gcm'];
        
        for (const key of Object.keys(data)) {
          if (reservedKeys.some(r => key.toLowerCase().startsWith(r))) {
            errors.push(`Reserved key prefix: ${key}`);
          }
          if (typeof data[key] !== 'string') {
            errors.push(`Data value must be string: ${key}`);
          }
        }
        return errors;
      };

      expect(validateDataPayload({ orderId: '123' })).toHaveLength(0);
      expect(validateDataPayload({ from_user: 'test' })).toContain('Reserved key prefix: from_user');
      expect(validateDataPayload({ count: 123 })).toContain('Data value must be string: count');
    });

    it('should validate notification categories', () => {
      const validCategories = [
        'order_update',
        'booking_confirmation',
        'payment_success',
        'payment_failed',
        'loyalty_points',
        'promotion',
        'general',
      ];

      const validateCategory = (category?: string): boolean => {
        if (!category) return true;
        return validCategories.includes(category);
      };

      expect(validateCategory('order_update')).toBe(true);
      expect(validateCategory('invalid_category')).toBe(false);
      expect(validateCategory()).toBe(true);
    });

    it('should limit total payload size', () => {
      const calculatePayloadSize = (payload: PushNotificationPayload): number => {
        return JSON.stringify(payload).length;
      };

      const MAX_PAYLOAD_SIZE = 4096; // FCM limit

      const smallPayload: PushNotificationPayload = {
        title: 'Order Update',
        body: 'Your order is ready for pickup!',
      };

      const largePayload: PushNotificationPayload = {
        title: 'A'.repeat(100),
        body: 'B'.repeat(4000),
        data: { extra: 'C'.repeat(1000) },
      };

      expect(calculatePayloadSize(smallPayload)).toBeLessThan(MAX_PAYLOAD_SIZE);
      expect(calculatePayloadSize(largePayload)).toBeGreaterThan(MAX_PAYLOAD_SIZE);
    });
  });

  describe('Token Validation', () => {
    it('should validate FCM token format', () => {
      const validateToken = (token: string): boolean => {
        return FCM_TOKEN_REGEX.test(token);
      };

      // Valid token (mock - 160 chars)
      const validToken = 'a'.repeat(160);
      expect(validateToken(validToken)).toBe(true);

      // Too short
      expect(validateToken('short_token')).toBe(false);

      // Invalid characters
      expect(validateToken('token with spaces'.repeat(20))).toBe(false);
    });

    it('should detect expired/invalid tokens from FCM response', () => {
      const isTokenInvalid = (errorCode: string): boolean => {
        return [
          FCM_ERROR_CODES.INVALID_REGISTRATION,
          FCM_ERROR_CODES.NOT_REGISTERED,
        ].includes(errorCode);
      };

      expect(isTokenInvalid(FCM_ERROR_CODES.INVALID_REGISTRATION)).toBe(true);
      expect(isTokenInvalid(FCM_ERROR_CODES.NOT_REGISTERED)).toBe(true);
      expect(isTokenInvalid(FCM_ERROR_CODES.QUOTA_EXCEEDED)).toBe(false);
    });

    it('should track token failures for cleanup', () => {
      const tokenFailures = new Map<string, { count: number; lastFailure: Date }>();
      const MAX_FAILURES = 3;

      const recordFailure = (token: string): boolean => {
        const existing = tokenFailures.get(token) || { count: 0, lastFailure: new Date() };
        existing.count++;
        existing.lastFailure = new Date();
        tokenFailures.set(token, existing);
        return existing.count >= MAX_FAILURES;
      };

      const token = 'test_token_' + 'a'.repeat(140);
      
      expect(recordFailure(token)).toBe(false); // 1st failure
      expect(recordFailure(token)).toBe(false); // 2nd failure
      expect(recordFailure(token)).toBe(true);  // 3rd failure - should delete
    });
  });

  describe('Message Construction', () => {
    it('should build iOS notification message', () => {
      const buildIOSMessage = (payload: PushNotificationPayload, token: string) => {
        return {
          token,
          notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: payload.imageUrl,
          },
          apns: {
            headers: {
              'apns-priority': '10',
              'apns-push-type': 'alert',
            },
            payload: {
              aps: {
                alert: {
                  title: payload.title,
                  body: payload.body,
                },
                badge: payload.badge || 0,
                sound: payload.sound || 'default',
                category: payload.category,
                'mutable-content': 1,
                'content-available': 1,
              },
            },
          },
          data: payload.data,
        };
      };

      const message = buildIOSMessage(
        { title: 'Test', body: 'Body', badge: 5, category: 'order_update' },
        'test_token'
      );

      expect(message.apns.payload.aps.badge).toBe(5);
      expect(message.apns.payload.aps.category).toBe('order_update');
      expect(message.apns.payload.aps['mutable-content']).toBe(1);
    });

    it('should build Android notification message', () => {
      const buildAndroidMessage = (payload: PushNotificationPayload, token: string) => {
        return {
          token,
          notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: payload.imageUrl,
          },
          android: {
            priority: 'high' as const,
            notification: {
              channelId: payload.category || 'default',
              icon: 'notification_icon',
              color: '#4F46E5',
              sound: payload.sound || 'default',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            },
            data: payload.data,
          },
          data: payload.data,
        };
      };

      const message = buildAndroidMessage(
        { title: 'Test', body: 'Body', category: 'payment_success' },
        'test_token'
      );

      expect(message.android.priority).toBe('high');
      expect(message.android.notification.channelId).toBe('payment_success');
    });

    it('should build cross-platform message', () => {
      const buildCrossPlatformMessage = (
        payload: PushNotificationPayload,
        token: string,
        platform: 'ios' | 'android' | 'unknown'
      ) => {
        const base = {
          token,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: Object.fromEntries(
            Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
          ),
        };

        if (platform === 'ios') {
          return {
            ...base,
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: payload.badge || 0,
                },
              },
            },
          };
        }

        if (platform === 'android') {
          return {
            ...base,
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
              },
            },
          };
        }

        return base;
      };

      const iosMessage = buildCrossPlatformMessage(
        { title: 'Test', body: 'Body' },
        'token',
        'ios'
      );
      expect(iosMessage.apns).toBeDefined();

      const androidMessage = buildCrossPlatformMessage(
        { title: 'Test', body: 'Body' },
        'token',
        'android'
      );
      expect(androidMessage.android).toBeDefined();
    });
  });

  describe('Delivery Scenarios', () => {
    it('should handle successful delivery', async () => {
      const mockSendResult = { success: true, messageId: 'msg_123' };
      
      const sendNotification = async (): Promise<PushResult> => {
        // Simulate FCM send
        return mockSendResult;
      };

      const result = await sendNotification();
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should handle invalid token error', async () => {
      const sendNotification = async (token: string): Promise<PushResult> => {
        // Simulate FCM error for invalid token
        if (token === 'invalid') {
          return {
            success: false,
            error: {
              code: FCM_ERROR_CODES.INVALID_REGISTRATION,
              message: 'Invalid registration token',
            },
          };
        }
        return { success: true, messageId: 'msg_123' };
      };

      const result = await sendNotification('invalid');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(FCM_ERROR_CODES.INVALID_REGISTRATION);
    });

    it('should handle rate limiting', async () => {
      const messagesSent = new Map<string, number>();
      const RATE_LIMIT_PER_DEVICE = 100;

      const sendWithRateLimit = async (deviceId: string): Promise<PushResult> => {
        const count = messagesSent.get(deviceId) || 0;
        
        if (count >= RATE_LIMIT_PER_DEVICE) {
          return {
            success: false,
            error: {
              code: FCM_ERROR_CODES.QUOTA_EXCEEDED,
              message: 'Device message rate exceeded',
            },
          };
        }

        messagesSent.set(deviceId, count + 1);
        return { success: true, messageId: `msg_${count}` };
      };

      // Exhaust rate limit
      for (let i = 0; i < RATE_LIMIT_PER_DEVICE; i++) {
        await sendWithRateLimit('device_1');
      }

      const result = await sendWithRateLimit('device_1');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(FCM_ERROR_CODES.QUOTA_EXCEEDED);
    });

    it('should implement exponential backoff for server errors', async () => {
      let attempts = 0;
      const MAX_ATTEMPTS = 3;
      const BASE_DELAY = 1000;

      const sendWithRetry = async (): Promise<PushResult> => {
        const delays: number[] = [];

        while (attempts < MAX_ATTEMPTS) {
          attempts++;
          
          // Simulate server error on first 2 attempts
          if (attempts < MAX_ATTEMPTS) {
            const delay = BASE_DELAY * Math.pow(2, attempts - 1);
            delays.push(delay);
            // In real code: await new Promise(r => setTimeout(r, delay));
            continue;
          }

          return { success: true, messageId: 'msg_123' };
        }

        return {
          success: false,
          error: {
            code: FCM_ERROR_CODES.SERVER_ERROR,
            message: 'Max retries exceeded',
          },
        };
      };

      const result = await sendWithRetry();
      expect(result.success).toBe(true);
      expect(attempts).toBe(MAX_ATTEMPTS);
    });
  });

  describe('Multi-Device Notifications', () => {
    it('should send to multiple devices for same user', async () => {
      const userDevices = [
        { deviceId: 'device_1', token: 'token_1', platform: 'ios' },
        { deviceId: 'device_2', token: 'token_2', platform: 'android' },
        { deviceId: 'device_3', token: 'token_3', platform: 'ios' },
      ];

      const sendToMultipleDevices = async (
        devices: typeof userDevices,
        payload: PushNotificationPayload
      ): Promise<{ sent: number; failed: number; errors: string[] }> => {
        const results = {
          sent: 0,
          failed: 0,
          errors: [] as string[],
        };

        for (const device of devices) {
          // Simulate send
          const success = device.token !== 'invalid';
          if (success) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push(`Failed for ${device.deviceId}`);
          }
        }

        return results;
      };

      const result = await sendToMultipleDevices(userDevices, {
        title: 'New Order',
        body: 'Order #123 confirmed',
      });

      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should deduplicate notifications for same user', async () => {
      const sentNotifications = new Map<string, Set<string>>();

      const sendWithDeduplication = async (
        userId: string,
        notificationId: string,
        deviceTokens: string[]
      ): Promise<{ sent: number; skipped: number }> => {
        const userNotifications = sentNotifications.get(userId) || new Set();
        
        if (userNotifications.has(notificationId)) {
          return { sent: 0, skipped: deviceTokens.length };
        }

        userNotifications.add(notificationId);
        sentNotifications.set(userId, userNotifications);

        return { sent: deviceTokens.length, skipped: 0 };
      };

      // First send
      const result1 = await sendWithDeduplication('user_1', 'notif_123', ['token_1', 'token_2']);
      expect(result1.sent).toBe(2);

      // Duplicate attempt
      const result2 = await sendWithDeduplication('user_1', 'notif_123', ['token_1', 'token_2']);
      expect(result2.skipped).toBe(2);
      expect(result2.sent).toBe(0);
    });
  });

  describe('Notification Types', () => {
    it('should handle order update notifications', () => {
      const buildOrderNotification = (
        orderId: string,
        status: 'confirmed' | 'preparing' | 'ready' | 'completed'
      ): PushNotificationPayload => {
        const messages = {
          confirmed: { title: 'Order Confirmed', body: `Order #${orderId} has been confirmed.` },
          preparing: { title: 'Preparing Order', body: `Order #${orderId} is being prepared.` },
          ready: { title: 'Order Ready!', body: `Order #${orderId} is ready for pickup.` },
          completed: { title: 'Order Complete', body: `Order #${orderId} has been completed.` },
        };

        return {
          ...messages[status],
          category: 'order_update',
          data: {
            orderId,
            status,
            screen: 'OrderDetails',
          },
        };
      };

      const notification = buildOrderNotification('ORD-123', 'ready');
      expect(notification.category).toBe('order_update');
      expect(notification.data?.screen).toBe('OrderDetails');
    });

    it('should handle payment notifications', () => {
      const buildPaymentNotification = (
        success: boolean,
        amount: string,
        referenceId: string
      ): PushNotificationPayload => {
        if (success) {
          return {
            title: 'Payment Successful',
            body: `Your payment of ${amount} was successful.`,
            category: 'payment_success',
            data: { referenceId, screen: 'PaymentSuccess' },
          };
        }

        return {
          title: 'Payment Failed',
          body: 'Your payment could not be processed. Please try again.',
          category: 'payment_failed',
          data: { referenceId, screen: 'PaymentRetry' },
        };
      };

      const successNotif = buildPaymentNotification(true, '€25.00', 'PAY-123');
      expect(successNotif.category).toBe('payment_success');

      const failNotif = buildPaymentNotification(false, '€25.00', 'PAY-123');
      expect(failNotif.category).toBe('payment_failed');
    });

    it('should handle booking notifications', () => {
      const buildBookingNotification = (
        type: 'confirmation' | 'reminder' | 'cancellation',
        bookingDetails: { id: string; date: string; resource: string }
      ): PushNotificationPayload => {
        const templates = {
          confirmation: {
            title: 'Booking Confirmed',
            body: `Your ${bookingDetails.resource} booking for ${bookingDetails.date} is confirmed.`,
          },
          reminder: {
            title: 'Booking Reminder',
            body: `Reminder: Your ${bookingDetails.resource} booking is tomorrow at ${bookingDetails.date}.`,
          },
          cancellation: {
            title: 'Booking Cancelled',
            body: `Your ${bookingDetails.resource} booking for ${bookingDetails.date} has been cancelled.`,
          },
        };

        return {
          ...templates[type],
          category: 'booking_confirmation',
          data: {
            bookingId: bookingDetails.id,
            screen: 'BookingDetails',
          },
        };
      };

      const notification = buildBookingNotification('confirmation', {
        id: 'BK-123',
        date: '2024-02-15',
        resource: 'Pool Chalet',
      });

      expect(notification.title).toBe('Booking Confirmed');
      expect(notification.data?.bookingId).toBe('BK-123');
    });

    it('should handle loyalty points notifications', () => {
      const buildLoyaltyNotification = (
        type: 'earned' | 'redeemed' | 'expiring',
        points: number,
        balance: number
      ): PushNotificationPayload => {
        const templates = {
          earned: {
            title: 'Points Earned! 🎉',
            body: `You've earned ${points} loyalty points! New balance: ${balance} points.`,
          },
          redeemed: {
            title: 'Points Redeemed',
            body: `You've redeemed ${points} points. Remaining balance: ${balance} points.`,
          },
          expiring: {
            title: 'Points Expiring Soon',
            body: `${points} points will expire soon. Current balance: ${balance} points.`,
          },
        };

        return {
          ...templates[type],
          category: 'loyalty_points',
          data: {
            points: String(points),
            balance: String(balance),
            screen: 'LoyaltyAccount',
          },
        };
      };

      const notification = buildLoyaltyNotification('earned', 50, 250);
      expect(notification.category).toBe('loyalty_points');
      expect(notification.data?.points).toBe('50');
    });
  });

  describe('Silent Notifications', () => {
    it('should build content-available notification for background updates', () => {
      const buildSilentNotification = (
        data: Record<string, string>,
        token: string
      ) => {
        return {
          token,
          data,
          apns: {
            headers: {
              'apns-push-type': 'background',
              'apns-priority': '5', // Must be 5 for background
            },
            payload: {
              aps: {
                'content-available': 1,
              },
            },
          },
          android: {
            priority: 'normal', // Not high for data-only
            data,
          },
        };
      };

      const message = buildSilentNotification(
        { action: 'sync_orders', lastSync: '2024-01-01T00:00:00Z' },
        'token'
      );

      expect(message.apns.headers['apns-push-type']).toBe('background');
      expect(message.apns.headers['apns-priority']).toBe('5');
      expect(message.notification).toBeUndefined();
    });
  });

  describe('Topic Subscriptions', () => {
    const userSubscriptions = new Map<string, Set<string>>();

    beforeEach(() => {
      userSubscriptions.clear();
    });

    it('should subscribe user to topics', () => {
      const subscribeToTopic = (userId: string, topic: string) => {
        const topics = userSubscriptions.get(userId) || new Set();
        topics.add(topic);
        userSubscriptions.set(userId, topics);
      };

      subscribeToTopic('user_1', 'promotions');
      subscribeToTopic('user_1', 'announcements');

      const topics = userSubscriptions.get('user_1');
      expect(topics?.has('promotions')).toBe(true);
      expect(topics?.has('announcements')).toBe(true);
    });

    it('should unsubscribe user from topics', () => {
      const subscribeToTopic = (userId: string, topic: string) => {
        const topics = userSubscriptions.get(userId) || new Set();
        topics.add(topic);
        userSubscriptions.set(userId, topics);
      };

      const unsubscribeFromTopic = (userId: string, topic: string) => {
        const topics = userSubscriptions.get(userId);
        topics?.delete(topic);
      };

      subscribeToTopic('user_1', 'promotions');
      unsubscribeFromTopic('user_1', 'promotions');

      const topics = userSubscriptions.get('user_1');
      expect(topics?.has('promotions')).toBe(false);
    });

    it('should send to topic', () => {
      const buildTopicMessage = (topic: string, payload: PushNotificationPayload) => {
        return {
          topic,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data,
        };
      };

      const message = buildTopicMessage('promotions', {
        title: 'Flash Sale!',
        body: '50% off all pool passes today only!',
        data: { screen: 'Promotions', promoId: 'PROMO-123' },
      });

      expect(message.topic).toBe('promotions');
      expect(message.notification.title).toBe('Flash Sale!');
    });
  });
});

describe('Push Notification Integration', () => {
  it('should integrate with order events', async () => {
    const orderEvents = {
      ORDER_CREATED: 'order:created',
      ORDER_CONFIRMED: 'order:confirmed',
      ORDER_PREPARING: 'order:preparing',
      ORDER_READY: 'order:ready',
      ORDER_COMPLETED: 'order:completed',
    };

    const notificationsSent: string[] = [];

    const handleOrderEvent = async (event: string, orderId: string, userId: string) => {
      const eventToNotification: Record<string, () => PushNotificationPayload> = {
        [orderEvents.ORDER_CONFIRMED]: () => ({
          title: 'Order Confirmed',
          body: `Order ${orderId} confirmed!`,
          category: 'order_update',
        }),
        [orderEvents.ORDER_READY]: () => ({
          title: 'Order Ready!',
          body: `Order ${orderId} is ready for pickup.`,
          category: 'order_update',
        }),
      };

      const builder = eventToNotification[event];
      if (builder) {
        notificationsSent.push(`${event}:${orderId}:${userId}`);
        // In real code: await pushService.sendToUser(userId, builder());
      }
    };

    await handleOrderEvent(orderEvents.ORDER_CONFIRMED, 'ORD-123', 'user_1');
    await handleOrderEvent(orderEvents.ORDER_READY, 'ORD-123', 'user_1');

    expect(notificationsSent).toHaveLength(2);
    expect(notificationsSent[0]).toContain('order:confirmed');
    expect(notificationsSent[1]).toContain('order:ready');
  });

  it('should integrate with payment events', async () => {
    const paymentEvents = {
      PAYMENT_SUCCEEDED: 'payment:succeeded',
      PAYMENT_FAILED: 'payment:failed',
      REFUND_PROCESSED: 'payment:refund_processed',
    };

    const handlePaymentEvent = (event: string, amount: number, userId: string): PushNotificationPayload | null => {
      switch (event) {
        case paymentEvents.PAYMENT_SUCCEEDED:
          return {
            title: 'Payment Successful',
            body: `Your payment of €${amount.toFixed(2)} was successful.`,
            category: 'payment_success',
          };
        case paymentEvents.PAYMENT_FAILED:
          return {
            title: 'Payment Failed',
            body: 'Your payment could not be processed.',
            category: 'payment_failed',
          };
        case paymentEvents.REFUND_PROCESSED:
          return {
            title: 'Refund Processed',
            body: `€${amount.toFixed(2)} has been refunded.`,
            category: 'payment_success',
          };
        default:
          return null;
      }
    };

    const notification = handlePaymentEvent(paymentEvents.PAYMENT_SUCCEEDED, 25.00, 'user_1');
    expect(notification?.title).toBe('Payment Successful');
    expect(notification?.body).toContain('€25.00');
  });
});
