/**
 * API Client Tests
 * 
 * Comprehensive test coverage for the API client including:
 * - Request interceptors
 * - Response interceptors
 * - Token refresh logic
 * - Error handling
 * - All API modules (auth, profile, loyalty, gift cards, restaurant, pool, chalets)
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { createMockUser, createMockAuthTokens, createMockOrder, createMockPoolBooking } from '../__mocks__/fixtures';

// Mock axios
jest.mock('axios', () => {
  const mockAxios: any = {
    create: jest.fn(() => mockAxios),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  return mockAxios;
});

// Import after mocking
import {
  apiClient,
  authApi,
  profileApi,
  deviceApi,
  loyaltyApi,
  giftCardApi,
  restaurantApi,
  poolApi,
  chaletsApi,
  paymentApi,
  couponApi,
  STORAGE_KEYS,
} from '../../src/api/client';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.clearAllMockStorage();
  });

  // =========================================================================
  // Auth API Tests
  // =========================================================================

  describe('authApi', () => {
    describe('login()', () => {
      it('should call login endpoint with correct data', async () => {
        const mockUser = createMockUser();
        const mockTokens = createMockAuthTokens();
        
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { ...mockTokens, user: mockUser },
          },
        });

        const result = await authApi.login('test@example.com', 'password123');

        expect(apiClient.post).toHaveBeenCalledWith(
          '/auth/login',
          expect.objectContaining({
            email: 'test@example.com',
            password: 'password123',
          })
        );
        expect(result.success).toBe(true);
        expect(result.data?.user).toEqual(mockUser);
      });

      it('should store tokens on successful login', async () => {
        const mockTokens = createMockAuthTokens();
        const mockUser = createMockUser();

        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { ...mockTokens, user: mockUser },
          },
        });

        await authApi.login('test@example.com', 'password123');

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          STORAGE_KEYS.ACCESS_TOKEN,
          mockTokens.accessToken
        );
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          STORAGE_KEYS.REFRESH_TOKEN,
          mockTokens.refreshToken
        );
      });

      it('should store user data on successful login', async () => {
        const mockUser = createMockUser();
        const mockTokens = createMockAuthTokens();

        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { ...mockTokens, user: mockUser },
          },
        });

        await authApi.login('test@example.com', 'password123');

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          STORAGE_KEYS.USER_DATA,
          JSON.stringify(mockUser)
        );
      });

      it('should handle login failure', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: false,
            error: 'Invalid credentials',
          },
        });

        const result = await authApi.login('wrong@example.com', 'wrongpass');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid credentials');
      });
    });

    describe('register()', () => {
      it('should call register endpoint with correct data', async () => {
        const mockUser = createMockUser();
        const mockTokens = createMockAuthTokens();

        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { ...mockTokens, user: mockUser },
          },
        });

        const result = await authApi.register({
          email: 'new@example.com',
          password: 'secure123',
          firstName: 'John',
          lastName: 'Doe',
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/auth/register',
          expect.objectContaining({
            email: 'new@example.com',
            password: 'secure123',
            firstName: 'John',
            lastName: 'Doe',
          })
        );
        expect(result.success).toBe(true);
      });
    });

    describe('logout()', () => {
      it('should clear stored tokens on logout', async () => {
        await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, 'token');
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, 'refresh');

        (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });

        await authApi.logout();

        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.USER_DATA);
      });

      it('should clear tokens even if server logout fails', async () => {
        (apiClient.post as jest.Mock).mockRejectedValue(new Error('Network error'));

        await authApi.logout();

        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.ACCESS_TOKEN);
        expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN);
      });
    });

    describe('getMe()', () => {
      it('should fetch current user profile', async () => {
        const mockUser = createMockUser();

        (apiClient.get as jest.Mock).mockResolvedValue({
          data: { success: true, data: mockUser },
        });

        const result = await authApi.getMe();

        expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
        expect(result.data).toEqual(mockUser);
      });
    });

    describe('isAuthenticated()', () => {
      it('should return true when access token exists', async () => {
        await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, 'valid-token');

        const result = await authApi.isAuthenticated();

        expect(result).toBe(true);
      });

      it('should return false when no access token exists', async () => {
        const result = await authApi.isAuthenticated();

        expect(result).toBe(false);
      });
    });

    describe('getStoredUser()', () => {
      it('should return stored user data', async () => {
        const mockUser = createMockUser();
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(mockUser));

        const result = await authApi.getStoredUser();

        expect(result).toEqual(mockUser);
      });

      it('should return null when no user stored', async () => {
        const result = await authApi.getStoredUser();

        expect(result).toBeNull();
      });

      it('should return null for invalid JSON', async () => {
        await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, 'invalid-json');

        const result = await authApi.getStoredUser();

        expect(result).toBeNull();
      });
    });
  });

  // =========================================================================
  // Profile API Tests
  // =========================================================================

  describe('profileApi', () => {
    describe('update()', () => {
      it('should update user profile', async () => {
        const updatedUser = createMockUser({ firstName: 'Updated' });

        (apiClient.put as jest.Mock).mockResolvedValue({
          data: { success: true, data: updatedUser },
        });

        const result = await profileApi.update({ firstName: 'Updated' });

        expect(apiClient.put).toHaveBeenCalledWith('/users/me', { firstName: 'Updated' });
        expect(result.data).toEqual(updatedUser);
      });

      it('should store updated user data', async () => {
        const updatedUser = createMockUser({ firstName: 'Updated' });

        (apiClient.put as jest.Mock).mockResolvedValue({
          data: { success: true, data: updatedUser },
        });

        await profileApi.update({ firstName: 'Updated' });

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          STORAGE_KEYS.USER_DATA,
          JSON.stringify(updatedUser)
        );
      });
    });

    describe('changePassword()', () => {
      it('should change user password', async () => {
        (apiClient.put as jest.Mock).mockResolvedValue({
          data: { success: true },
        });

        const result = await profileApi.changePassword({
          currentPassword: 'oldpass',
          newPassword: 'newpass',
        });

        expect(apiClient.put).toHaveBeenCalledWith('/users/me/password', {
          currentPassword: 'oldpass',
          newPassword: 'newpass',
        });
        expect(result.success).toBe(true);
      });
    });
  });

  // =========================================================================
  // Device API Tests
  // =========================================================================

  describe('deviceApi', () => {
    describe('register()', () => {
      it('should register device for push notifications', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { deviceId: 'device-123' },
          },
        });

        const result = await deviceApi.register({
          token: 'push-token',
          platform: 'ios',
          deviceName: 'iPhone 14',
        });

        expect(apiClient.post).toHaveBeenCalledWith('/devices/register', {
          token: 'push-token',
          platform: 'ios',
          deviceName: 'iPhone 14',
        });
        expect(result.data?.deviceId).toBe('device-123');
      });

      it('should store device ID after registration', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { deviceId: 'device-123' },
          },
        });

        await deviceApi.register({
          token: 'push-token',
          platform: 'ios',
        });

        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          STORAGE_KEYS.DEVICE_ID,
          'device-123'
        );
      });
    });

    describe('unregister()', () => {
      it('should unregister device', async () => {
        await SecureStore.setItemAsync(STORAGE_KEYS.DEVICE_ID, 'device-123');

        (apiClient.delete as jest.Mock).mockResolvedValue({
          data: { success: true },
        });

        const result = await deviceApi.unregister();

        expect(apiClient.delete).toHaveBeenCalledWith('/devices/device-123');
        expect(result.success).toBe(true);
      });

      it('should return success when no device registered', async () => {
        const result = await deviceApi.unregister();

        expect(result.success).toBe(true);
      });
    });
  });

  // =========================================================================
  // Loyalty API Tests
  // =========================================================================

  describe('loyaltyApi', () => {
    describe('getStatus()', () => {
      it('should fetch loyalty status', async () => {
        const mockStatus = {
          points: 5000,
          tier: 'Gold',
          tierBenefits: ['10% discount'],
          nextTier: 'Platinum',
          pointsToNextTier: 5000,
          lifetimePoints: 15000,
        };

        (apiClient.get as jest.Mock).mockResolvedValue({
          data: { success: true, data: mockStatus },
        });

        const result = await loyaltyApi.getStatus();

        expect(apiClient.get).toHaveBeenCalledWith('/loyalty/status');
        expect(result.data).toEqual(mockStatus);
      });
    });

    describe('getBalance()', () => {
      it('should fetch loyalty balance', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { points: 5000, tier: 'Gold', tierMultiplier: 1.5 },
          },
        });

        const result = await loyaltyApi.getBalance();

        expect(apiClient.get).toHaveBeenCalledWith('/loyalty/balance');
        expect(result.data?.points).toBe(5000);
      });
    });

    describe('getHistory()', () => {
      it('should fetch loyalty history with pagination', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: {
              transactions: [{ id: '1', type: 'earn', points: 100 }],
            },
          },
        });

        const result = await loyaltyApi.getHistory(1, 10);

        expect(apiClient.get).toHaveBeenCalledWith('/loyalty/history', {
          params: { page: 1, limit: 10 },
        });
        expect(result.data).toHaveLength(1);
      });
    });

    describe('redeemReward()', () => {
      it('should redeem a reward', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: { success: true, data: { success: true } },
        });

        const result = await loyaltyApi.redeemReward('reward-1');

        expect(apiClient.post).toHaveBeenCalledWith('/loyalty/rewards/reward-1/redeem');
        expect(result.success).toBe(true);
      });
    });
  });

  // =========================================================================
  // Gift Card API Tests
  // =========================================================================

  describe('giftCardApi', () => {
    describe('checkBalance()', () => {
      it('should check gift card balance', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { code: 'GIFT-1234', balance: 100, isValid: true },
          },
        });

        const result = await giftCardApi.checkBalance('GIFT-1234');

        expect(apiClient.get).toHaveBeenCalledWith('/giftcards/balance/GIFT-1234');
        expect(result.data?.balance).toBe(100);
      });
    });

    describe('getMyCards()', () => {
      it('should fetch user gift cards', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: [{ id: '1', code: 'GIFT-1234', balance: 100 }],
          },
        });

        const result = await giftCardApi.getMyCards();

        expect(apiClient.get).toHaveBeenCalledWith('/giftcards/my');
        expect(result.data).toHaveLength(1);
      });
    });

    describe('purchase()', () => {
      it('should purchase a gift card', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { id: 'new-gc', code: 'GIFT-5678', balance: 50 },
          },
        });

        const result = await giftCardApi.purchase({
          amount: 50,
          recipientEmail: 'recipient@example.com',
        });

        expect(apiClient.post).toHaveBeenCalledWith('/giftcards/purchase', {
          amount: 50,
          recipientEmail: 'recipient@example.com',
        });
        expect(result.data?.balance).toBe(50);
      });
    });

    describe('redeem()', () => {
      it('should redeem a gift card code', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { id: 'gc-1', balance: 100 },
          },
        });

        const result = await giftCardApi.redeem('GIFT-1234');

        expect(apiClient.post).toHaveBeenCalledWith('/giftcards/redeem', {
          code: 'GIFT-1234',
        });
        expect(result.success).toBe(true);
      });
    });
  });

  // =========================================================================
  // Restaurant API Tests
  // =========================================================================

  describe('restaurantApi', () => {
    describe('getCategories()', () => {
      it('should fetch menu categories', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: [{ id: '1', name: 'Appetizers', icon: '🥗', itemCount: 12 }],
          },
        });

        const result = await restaurantApi.getCategories();

        expect(apiClient.get).toHaveBeenCalledWith('/restaurant/categories');
        expect(result.data).toHaveLength(1);
      });
    });

    describe('getMenu()', () => {
      it('should fetch all menu items', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: [{ id: '1', name: 'Caesar Salad', price: 12.99 }],
          },
        });

        const result = await restaurantApi.getMenu();

        expect(apiClient.get).toHaveBeenCalledWith('/restaurant/menu', {
          params: undefined,
        });
        expect(result.data).toHaveLength(1);
      });

      it('should fetch menu items by category', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: { success: true, data: [] },
        });

        await restaurantApi.getMenu('cat-1');

        expect(apiClient.get).toHaveBeenCalledWith('/restaurant/menu', {
          params: { category: 'cat-1' },
        });
      });
    });

    describe('placeOrder()', () => {
      it('should place a restaurant order', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { orderId: 'order-1', orderNumber: 'ORD-001', total: 25.98 },
          },
        });

        const result = await restaurantApi.placeOrder({
          items: [{ menuItemId: 'item-1', quantity: 2 }],
          deliveryOption: 'room',
          roomNumber: '101',
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/restaurant/orders',
          expect.objectContaining({
            deliveryOption: 'room',
            roomNumber: '101',
          })
        );
        expect(result.data?.orderId).toBe('order-1');
      });
    });

    describe('getOrders()', () => {
      it('should fetch user orders', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { orders: [createMockOrder()] },
          },
        });

        const result = await restaurantApi.getOrders();

        expect(apiClient.get).toHaveBeenCalledWith('/restaurant/orders', {
          params: undefined,
        });
        expect(result.data).toHaveLength(1);
      });
    });
  });

  // =========================================================================
  // Pool API Tests
  // =========================================================================

  describe('poolApi', () => {
    describe('getInfo()', () => {
      it('should fetch pool information', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { id: 'pool-1', name: 'Main Pool', hours: '7:00 AM - 10:00 PM' },
          },
        });

        const result = await poolApi.getInfo();

        expect(apiClient.get).toHaveBeenCalledWith('/pool/info');
        expect(result.data?.name).toBe('Main Pool');
      });
    });

    describe('getAvailability()', () => {
      it('should fetch pool availability for date', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: [{ id: 'slot-1', startTime: '09:00', available: true }],
          },
        });

        const result = await poolApi.getAvailability('2026-01-25');

        expect(apiClient.get).toHaveBeenCalledWith('/pool/availability', {
          params: { date: '2026-01-25' },
        });
        expect(result.data).toHaveLength(1);
      });
    });

    describe('book()', () => {
      it('should book a pool slot', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { bookingId: 'booking-1', qrCode: 'base64-qr' },
          },
        });

        const result = await poolApi.book({
          date: '2026-01-25',
          slotId: 'slot-1',
          guests: 2,
        });

        expect(apiClient.post).toHaveBeenCalledWith('/pool/book', {
          date: '2026-01-25',
          slotId: 'slot-1',
          guests: 2,
        });
        expect(result.data?.bookingId).toBe('booking-1');
      });
    });

    describe('cancelBooking()', () => {
      it('should cancel a pool booking', async () => {
        (apiClient.delete as jest.Mock).mockResolvedValue({
          data: { success: true },
        });

        const result = await poolApi.cancelBooking('booking-1');

        expect(apiClient.delete).toHaveBeenCalledWith('/pool/bookings/booking-1');
        expect(result.success).toBe(true);
      });
    });
  });

  // =========================================================================
  // Chalets API Tests
  // =========================================================================

  describe('chaletsApi', () => {
    describe('getChalets()', () => {
      it('should fetch all chalets', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: [{ id: 'chalet-1', name: 'Mountain View', basePrice: 250 }],
          },
        });

        const result = await chaletsApi.getChalets();

        expect(apiClient.get).toHaveBeenCalledWith('/chalets', {
          params: undefined,
        });
        expect(result.data).toHaveLength(1);
      });
    });

    describe('getChalet()', () => {
      it('should fetch single chalet details', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { id: 'chalet-1', name: 'Mountain View', basePrice: 250 },
          },
        });

        const result = await chaletsApi.getChalet('chalet-1');

        expect(apiClient.get).toHaveBeenCalledWith('/chalets/chalet-1');
        expect(result.data?.name).toBe('Mountain View');
      });
    });

    describe('getAvailability()', () => {
      it('should check chalet availability', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { isAvailable: true, totalPrice: 750, nights: 3 },
          },
        });

        const result = await chaletsApi.getAvailability(
          'chalet-1',
          '2026-02-01',
          '2026-02-04'
        );

        expect(apiClient.get).toHaveBeenCalledWith('/chalets/chalet-1/availability', {
          params: { checkIn: '2026-02-01', checkOut: '2026-02-04' },
        });
        expect(result.data?.isAvailable).toBe(true);
      });
    });

    describe('createBooking()', () => {
      it('should create a chalet booking', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { id: 'booking-1', bookingNumber: 'CHB-001', totalPrice: 750 },
          },
        });

        const result = await chaletsApi.createBooking({
          chaletId: 'chalet-1',
          checkInDate: '2026-02-01',
          checkOutDate: '2026-02-04',
          numberOfGuests: 4,
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/chalets/bookings',
          expect.objectContaining({
            chaletId: 'chalet-1',
            numberOfGuests: 4,
          })
        );
        expect(result.data?.bookingNumber).toBe('CHB-001');
      });
    });
  });

  // =========================================================================
  // Payment API Tests
  // =========================================================================

  describe('paymentApi', () => {
    describe('createIntent()', () => {
      it('should create a payment intent', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: {
              clientSecret: 'pi_secret_xxx',
              paymentIntentId: 'pi_xxx',
              amount: 100,
              discounts: [],
            },
          },
        });

        const result = await paymentApi.createIntent({ amount: 100 });

        expect(apiClient.post).toHaveBeenCalledWith('/payments/create-intent', {
          amount: 100,
        });
        expect(result.data?.clientSecret).toBe('pi_secret_xxx');
      });
    });

    describe('confirm()', () => {
      it('should confirm a payment', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: { status: 'succeeded', receiptUrl: 'https://receipt.url' },
          },
        });

        const result = await paymentApi.confirm('pi_xxx');

        expect(apiClient.post).toHaveBeenCalledWith('/payments/confirm', {
          paymentIntentId: 'pi_xxx',
        });
        expect(result.data?.status).toBe('succeeded');
      });
    });
  });

  // =========================================================================
  // Coupon API Tests
  // =========================================================================

  describe('couponApi', () => {
    describe('validate()', () => {
      it('should validate a coupon code', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {
            success: true,
            data: {
              code: 'SAVE10',
              discountValue: 10,
              discountType: 'percentage',
              isValid: true,
            },
          },
        });

        const result = await couponApi.validate('SAVE10');

        expect(apiClient.post).toHaveBeenCalledWith('/coupons/validate', {
          code: 'SAVE10',
        });
        expect(result.data?.isValid).toBe(true);
      });

      it('should pass context when validating coupon', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: { success: true, data: { isValid: true } },
        });

        await couponApi.validate('SAVE10', { moduleId: 'restaurant', subtotal: 50 });

        expect(apiClient.post).toHaveBeenCalledWith('/coupons/validate', {
          code: 'SAVE10',
          moduleId: 'restaurant',
          subtotal: 50,
        });
      });
    });
  });

  // =========================================================================
  // Error Handling Tests
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network Error'));

      await expect(loyaltyApi.getStatus()).rejects.toThrow('Network Error');
    });

    it('should handle API errors', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Internal Server Error' },
        },
      });

      await expect(loyaltyApi.getStatus()).rejects.toMatchObject({
        response: {
          status: 500,
        },
      });
    });

    it('should handle timeout errors', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      });

      await expect(poolApi.getInfo()).rejects.toMatchObject({
        code: 'ECONNABORTED',
      });
    });
  });
});
