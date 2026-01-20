/**
 * Push Notification Service (MOCKED for Expo Go SDK 54 Compatibility)
 * 
 * NOTE: The original expo-notifications implementation is disabled
 * because Android Push Notifications are removed from Expo Go in SDK 53+.
 * To restore functionality, use a Development Build or run on a physical device with a dev client.
 */

// import * as Notifications from 'expo-notifications'; // DISABLED to prevent crash
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { deviceApi } from '../api/client';
import { router } from 'expo-router';

// Mock Types
namespace Notifications {
  export type NotificationResponse = any;
}

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
  console.log('Push notifications disabled in Expo Go (Mocked)');
  return false;
}

/**
 * Get the push notification token
 */
export async function getPushToken(): Promise<string | null> {
  console.log('getPushToken called (Mocked)');
  return null;
}

/**
 * Get FCM token (for production builds with Firebase)
 */
export async function getFCMToken(): Promise<string | null> {
  return null;
}

/**
 * Register device with backend
 */
export async function registerDevice(): Promise<boolean> {
  console.log('registerDevice called (Mocked)');
  return false;
}

/**
 * Update push token (call when token refreshes)
 */
export async function updatePushToken(token: string): Promise<boolean> {
  return false;
}

/**
 * Unregister device (call on logout)
 */
export async function unregisterDevice(): Promise<boolean> {
  return false; // Mocked
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
    'OrderDetails': `/orders/${data.orderId}`,
    'BookingDetails': `/bookings/${data.bookingId}`,
    'PaymentSuccess': '/payment/success',
    'PaymentRetry': '/payment/retry',
    'LoyaltyAccount': '/loyalty',
    'Promotions': '/promotions',
    'Menu': '/restaurant/menu',
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
  // Mock listeners
  return () => {
    // No-op cleanup
  };
}

/**
 * Check for initial notification (app opened from notification)
 */
export async function getInitialNotification(): Promise<Notifications.NotificationResponse | null> {
  return null;
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  // No-op
}

/**
 * Clear all notifications
 */
export async function clearNotifications(): Promise<void> {
  // No-op
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
