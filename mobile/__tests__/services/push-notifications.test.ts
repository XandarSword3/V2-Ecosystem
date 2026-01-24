/**
 * Push Notifications Service Tests
 */
import {
  requestPermissions,
  getPushToken,
  getFCMToken,
  registerDevice,
  updatePushToken,
  unregisterDevice,
  handleNotificationData,
  NOTIFICATION_CATEGORIES,
} from '../../src/services/push-notifications';
import { router } from 'expo-router';
import { deviceApi } from '../../src/api/client';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

// Mock device API
jest.mock('../../src/api/client', () => ({
  deviceApi: {
    register: jest.fn(),
    unregister: jest.fn(),
  },
}));

const mockRouter = router as jest.Mocked<typeof router>;
const mockDeviceApi = deviceApi as jest.Mocked<typeof deviceApi>;

describe('Push Notifications Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('NOTIFICATION_CATEGORIES', () => {
    it('should have order_update category', () => {
      expect(NOTIFICATION_CATEGORIES.ORDER_UPDATE).toBe('order_update');
    });

    it('should have booking_confirmation category', () => {
      expect(NOTIFICATION_CATEGORIES.BOOKING_CONFIRMATION).toBe('booking_confirmation');
    });

    it('should have payment categories', () => {
      expect(NOTIFICATION_CATEGORIES.PAYMENT_SUCCESS).toBe('payment_success');
      expect(NOTIFICATION_CATEGORIES.PAYMENT_FAILED).toBe('payment_failed');
    });

    it('should have loyalty_points category', () => {
      expect(NOTIFICATION_CATEGORIES.LOYALTY_POINTS).toBe('loyalty_points');
    });

    it('should have promotion category', () => {
      expect(NOTIFICATION_CATEGORIES.PROMOTION).toBe('promotion');
    });
  });

  describe('requestPermissions', () => {
    it('should return false (mocked)', async () => {
      const result = await requestPermissions();
      expect(result).toBe(false);
    });
  });

  describe('getPushToken', () => {
    it('should return null (mocked)', async () => {
      const result = await getPushToken();
      expect(result).toBeNull();
    });
  });

  describe('getFCMToken', () => {
    it('should return null (mocked)', async () => {
      const result = await getFCMToken();
      expect(result).toBeNull();
    });
  });

  describe('registerDevice', () => {
    it('should return false (mocked)', async () => {
      const result = await registerDevice();
      expect(result).toBe(false);
    });
  });

  describe('updatePushToken', () => {
    it('should return false (mocked)', async () => {
      const result = await updatePushToken('test-token');
      expect(result).toBe(false);
    });
  });

  describe('unregisterDevice', () => {
    it('should return false (mocked)', async () => {
      const result = await unregisterDevice();
      expect(result).toBe(false);
    });
  });

  describe('handleNotificationData', () => {
    it('should navigate to order details', () => {
      handleNotificationData({
        screen: 'OrderDetails',
        orderId: '123',
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/orders/123');
    });

    it('should navigate to booking details', () => {
      handleNotificationData({
        screen: 'BookingDetails',
        bookingId: '456',
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/bookings/456');
    });

    it('should navigate to payment success', () => {
      handleNotificationData({
        screen: 'PaymentSuccess',
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/payment/success');
    });

    it('should navigate to loyalty account', () => {
      handleNotificationData({
        screen: 'LoyaltyAccount',
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/loyalty');
    });

    it('should navigate to promotions', () => {
      handleNotificationData({
        screen: 'Promotions',
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/promotions');
    });

    it('should navigate to menu', () => {
      handleNotificationData({
        screen: 'Menu',
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/restaurant/menu');
    });

    it('should not navigate for unknown screen', () => {
      handleNotificationData({
        screen: 'UnknownScreen',
      });

      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('should not navigate when no screen provided', () => {
      handleNotificationData({
        someData: 'value',
      });

      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });
});
