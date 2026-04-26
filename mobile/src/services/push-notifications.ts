/**
 * Push Notification Service
 *
 * Works on development builds and production builds. In Expo Go, token
 * retrieval may be unavailable on some platforms; errors are handled gracefully.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { deviceApi } from '../api/client';
import { router } from 'expo-router';

// Notification categories for iOS
export const NOTIFICATION_CATEGORIES = {
  ORDER_UPDATE: 'order_update',
  BOOKING_CONFIRMATION: 'booking_confirmation',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  LOYALTY_POINTS: 'loyalty_points',
  PROMOTION: 'promotion',
};

/**
 * Request notification permissions
 */
export async function requestPermissions(): Promise<boolean> {
  try {
    const existingStatus = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus.status;

    if (existingStatus.status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.warn('Failed to request notification permissions:', error);
    return false;
  }
}

/**
 * Get the push notification token
 */
export async function getPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      return null;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync();

    return tokenResponse.data || null;
  } catch (error) {
    console.warn('Failed to get Expo push token:', error);
    return null;
  }
}

/**
 * Get FCM token (for production builds with Firebase)
 */
export async function getFCMToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    // expo-notifications does not expose raw FCM token directly in managed workflow.
    // We return Expo push token for backend mapping.
    return await getPushToken();
  } catch {
    return null;
  }
}

/**
 * Register device with backend
 */
export async function registerDevice(): Promise<boolean> {
  try {
    const token = await getPushToken();
    if (!token) return false;

    const result = await deviceApi.register({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceName: Device.deviceName || undefined,
    });

    return !!result.success;
  } catch (error) {
    console.warn('Failed to register device for push:', error);
    return false;
  }
}

/**
 * Update push token (call when token refreshes)
 */
export async function updatePushToken(token: string): Promise<boolean> {
  try {
    const result = await deviceApi.updateToken(token);
    return !!result.success;
  } catch (error) {
    console.warn('Failed to update push token:', error);
    return false;
  }
}

/**
 * Unregister device (call on logout)
 */
export async function unregisterDevice(): Promise<boolean> {
  try {
    const result = await deviceApi.unregister();
    return !!result.success;
  } catch (error) {
    console.warn('Failed to unregister device:', error);
    return false;
  }
}

/**
 * Handle notification data and navigate
 */
export function handleNotificationData(data: Record<string, any>): void {
  const screen = data.screen as string;
  
  if (!screen) {
    return;
  }

  // Map notification screen to app routes
  const routeMap: Record<string, string> = {
    'OrderDetails': `/restaurant/orders`,
    'BookingDetails': `/chalets`,
    'PaymentSuccess': '/profile',
    'PaymentRetry': '/profile',
    'LoyaltyAccount': '/loyalty',
    'Promotions': '/restaurant',
    'Menu': '/restaurant',
    'Pool': '/pool',
    'Chalets': '/chalets',
  };

  const route = routeMap[screen];
  
  if (route) {
    // Navigate using expo-router
    try {
      router.push(route as any);
    } catch (e) {
      console.error('Error navigating to route:', route, e);
    }
  }
}

/**
 * Notification listeners setup
 */
export function setupNotificationListeners(): () => void {
  const receiveSubscription = Notifications.addNotificationReceivedListener(() => {
    // Optional foreground handling hook can be expanded by feature screens.
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, any>;
    handleNotificationData(data || {});
  });

  return () => {
    receiveSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Check for initial notification (app opened from notification)
 */
export async function getInitialNotification(): Promise<Notifications.NotificationResponse | null> {
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Notifications.setBadgeCountAsync(Math.max(0, count));
    }
  } catch (error) {
    console.warn('Failed to set badge count:', error);
  }
}

/**
 * Clear all notifications
 */
export async function clearNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
    if (Platform.OS === 'ios') {
      await Notifications.setBadgeCountAsync(0);
    }
  } catch (error) {
    console.warn('Failed to clear notifications:', error);
  }
}

export default {
  requestPermissions,
  getPushToken,
  getFCMToken,
  registerDevice,
  updatePushToken,
  unregisterDevice,
  handleNotificationData,
  setupNotificationListeners,
  getInitialNotification,
  setBadgeCount,
  clearNotifications,
  NOTIFICATION_CATEGORIES,
};
