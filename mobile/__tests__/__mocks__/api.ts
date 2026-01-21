/**
 * Mock API Client for Testing
 * 
 * Provides comprehensive mocks for all API methods with configurable responses.
 * Supports both success and failure scenarios for thorough testing.
 */

import { ApiResponse, User, AuthTokens } from '../../src/api/client';
import { createMockUser, createMockAuthTokens, createMockApiResponse } from './fixtures';

// Mock state for tracking calls
export const mockApiCalls: Array<{
  method: string;
  endpoint: string;
  data?: any;
  params?: any;
  timestamp: number;
}> = [];

// Reset mock state
export const resetMockApiCalls = () => {
  mockApiCalls.length = 0;
};

// Configurable mock responses
let mockResponses: Record<string, ApiResponse<any>> = {};

export const setMockResponse = (key: string, response: ApiResponse<any>) => {
  mockResponses[key] = response;
};

export const clearMockResponses = () => {
  mockResponses = {};
};

export const getMockResponse = <T>(key: string, defaultResponse: ApiResponse<T>): ApiResponse<T> => {
  return mockResponses[key] || defaultResponse;
};

// Track API call
const trackCall = (method: string, endpoint: string, data?: any, params?: any) => {
  mockApiCalls.push({
    method,
    endpoint,
    data,
    params,
    timestamp: Date.now(),
  });
};

/**
 * Mock Auth API
 */
export const createMockAuthApi = () => ({
  login: jest.fn(async (email: string, password: string): Promise<ApiResponse<AuthTokens & { user: User }>> => {
    trackCall('POST', '/auth/login', { email, password });
    
    return getMockResponse('auth.login', {
      success: true,
      data: {
        ...createMockAuthTokens(),
        user: createMockUser({ email }),
      },
    });
  }),

  register: jest.fn(async (data: any): Promise<ApiResponse<AuthTokens & { user: User }>> => {
    trackCall('POST', '/auth/register', data);
    
    return getMockResponse('auth.register', {
      success: true,
      data: {
        ...createMockAuthTokens(),
        user: createMockUser({ email: data.email, firstName: data.firstName, lastName: data.lastName }),
      },
    });
  }),

  logout: jest.fn(async (): Promise<void> => {
    trackCall('POST', '/auth/logout', {});
  }),

  logoutAll: jest.fn(async (): Promise<void> => {
    trackCall('POST', '/auth/logout-all', {});
  }),

  getMe: jest.fn(async (): Promise<ApiResponse<User>> => {
    trackCall('GET', '/auth/me', {});
    
    return getMockResponse('auth.getMe', {
      success: true,
      data: createMockUser(),
    });
  }),

  refreshToken: jest.fn(async (): Promise<ApiResponse<AuthTokens>> => {
    trackCall('POST', '/auth/refresh', {});
    
    return getMockResponse('auth.refresh', {
      success: true,
      data: createMockAuthTokens(),
    });
  }),

  isAuthenticated: jest.fn(async (): Promise<boolean> => {
    const response = getMockResponse('auth.isAuthenticated', { success: true, data: true });
    return response.data ?? false;
  }),

  getStoredUser: jest.fn(async (): Promise<User | null> => {
    const response = getMockResponse('auth.getStoredUser', { success: true, data: createMockUser() });
    return response.data ?? null;
  }),
});

/**
 * Mock Profile API
 */
export const createMockProfileApi = () => ({
  update: jest.fn(async (data: any): Promise<ApiResponse<User>> => {
    trackCall('PUT', '/users/me', data);
    
    return getMockResponse('profile.update', {
      success: true,
      data: createMockUser(data),
    });
  }),

  changePassword: jest.fn(async (data: any): Promise<ApiResponse<void>> => {
    trackCall('PUT', '/users/me/password', data);
    
    return getMockResponse('profile.changePassword', {
      success: true,
    });
  }),
});

/**
 * Mock Device API
 */
export const createMockDeviceApi = () => ({
  register: jest.fn(async (data: any): Promise<ApiResponse<{ deviceId: string }>> => {
    trackCall('POST', '/devices/register', data);
    
    return getMockResponse('device.register', {
      success: true,
      data: { deviceId: 'mock-device-id-123' },
    });
  }),

  updateToken: jest.fn(async (token: string): Promise<ApiResponse<void>> => {
    trackCall('PUT', '/devices/token', { token });
    
    return getMockResponse('device.updateToken', { success: true });
  }),

  unregister: jest.fn(async (): Promise<ApiResponse<void>> => {
    trackCall('DELETE', '/devices', {});
    
    return getMockResponse('device.unregister', { success: true });
  }),

  list: jest.fn(async (): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/devices', {});
    
    return getMockResponse('device.list', {
      success: true,
      data: [
        {
          id: 'device-1',
          platform: 'ios',
          deviceName: 'iPhone 14',
          lastActive: new Date().toISOString(),
          isCurrent: true,
        },
      ],
    });
  }),
});

/**
 * Mock Loyalty API
 */
export const createMockLoyaltyApi = () => ({
  getStatus: jest.fn(async (): Promise<ApiResponse<any>> => {
    trackCall('GET', '/loyalty/status', {});
    
    return getMockResponse('loyalty.status', {
      success: true,
      data: {
        points: 5000,
        tier: 'Gold',
        tierBenefits: ['10% discount', 'Free upgrades', 'Priority booking'],
        nextTier: 'Platinum',
        pointsToNextTier: 5000,
        lifetimePoints: 15000,
      },
    });
  }),

  getBalance: jest.fn(async (): Promise<ApiResponse<any>> => {
    trackCall('GET', '/loyalty/balance', {});
    
    return getMockResponse('loyalty.balance', {
      success: true,
      data: {
        points: 5000,
        tier: 'Gold',
        tierMultiplier: 1.5,
        nextTier: 'Platinum',
        pointsToNextTier: 5000,
      },
    });
  }),

  getHistory: jest.fn(async (page?: number, limit?: number): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/loyalty/history', { page, limit });
    
    return getMockResponse('loyalty.history', {
      success: true,
      data: [
        {
          id: 'txn-1',
          type: 'earn',
          points: 500,
          description: 'Restaurant order',
          date: new Date().toISOString(),
          category: 'restaurant',
        },
        {
          id: 'txn-2',
          type: 'redeem',
          points: -200,
          description: 'Discount redemption',
          date: new Date().toISOString(),
          category: 'redemption',
        },
      ],
    });
  }),

  getAvailableRewards: jest.fn(async (): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/loyalty/rewards', {});
    
    return getMockResponse('loyalty.rewards', {
      success: true,
      data: [
        {
          id: 'reward-1',
          name: 'Free Dessert',
          pointsCost: 500,
          description: 'Complimentary dessert at any restaurant',
          available: true,
          category: 'food',
        },
        {
          id: 'reward-2',
          name: 'Pool Day Pass',
          pointsCost: 1000,
          description: 'Free pool access for a day',
          available: true,
          category: 'amenities',
        },
      ],
    });
  }),

  redeemReward: jest.fn(async (rewardId: string): Promise<ApiResponse<{ success: boolean }>> => {
    trackCall('POST', `/loyalty/rewards/${rewardId}/redeem`, {});
    
    return getMockResponse('loyalty.redeem', {
      success: true,
      data: { success: true },
    });
  }),
});

/**
 * Mock Gift Card API
 */
export const createMockGiftCardApi = () => ({
  checkBalance: jest.fn(async (code: string): Promise<ApiResponse<any>> => {
    trackCall('GET', `/giftcards/balance/${code}`, {});
    
    return getMockResponse('giftcard.balance', {
      success: true,
      data: {
        code,
        balance: 100,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        isValid: true,
      },
    });
  }),

  getMyCards: jest.fn(async (): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/giftcards/my', {});
    
    return getMockResponse('giftcard.myCards', {
      success: true,
      data: [
        {
          id: 'gc-1',
          code: 'GIFT-XXXX-1234',
          balance: 100,
          initialValue: 100,
          status: 'active',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }),

  list: jest.fn(async (): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/giftcards/my', {});
    
    return getMockResponse('giftcard.list', {
      success: true,
      data: [
        {
          id: 'gc-1',
          code: 'GIFT-XXXX-1234',
          balance: 100,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
  }),

  getHistory: jest.fn(async (): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/giftcards/history', {});
    
    return getMockResponse('giftcard.history', {
      success: true,
      data: [
        {
          id: 'txn-1',
          type: 'purchase',
          amount: 100,
          description: 'Gift card purchase',
          date: new Date().toISOString(),
          cardCode: 'GIFT-XXXX-1234',
        },
      ],
    });
  }),

  purchase: jest.fn(async (data: any): Promise<ApiResponse<any>> => {
    trackCall('POST', '/giftcards/purchase', data);
    
    return getMockResponse('giftcard.purchase', {
      success: true,
      data: {
        id: 'gc-new',
        code: 'GIFT-YYYY-5678',
        balance: data.amount,
      },
    });
  }),

  redeem: jest.fn(async (code: string): Promise<ApiResponse<any>> => {
    trackCall('POST', '/giftcards/redeem', { code });
    
    return getMockResponse('giftcard.redeem', {
      success: true,
      data: {
        id: 'gc-1',
        balance: 100,
      },
    });
  }),
});

/**
 * Mock Restaurant API
 */
export const createMockRestaurantApi = () => ({
  getModules: jest.fn(async (): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/modules?type=restaurant', {});
    
    return getMockResponse('restaurant.modules', {
      success: true,
      data: [
        {
          id: 'mod-1',
          name: 'Main Restaurant',
          type: 'restaurant',
          description: 'Fine dining experience',
          image: 'https://example.com/restaurant.jpg',
          isActive: true,
        },
      ],
    });
  }),

  getCategories: jest.fn(async (): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/restaurant/categories', {});
    
    return getMockResponse('restaurant.categories', {
      success: true,
      data: [
        { id: 'cat-1', name: 'Appetizers', icon: '🥗', itemCount: 12 },
        { id: 'cat-2', name: 'Main Courses', icon: '🍽️', itemCount: 20 },
        { id: 'cat-3', name: 'Desserts', icon: '🍰', itemCount: 8 },
      ],
    });
  }),

  getMenu: jest.fn(async (categoryId?: string): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/restaurant/menu', { category: categoryId });
    
    return getMockResponse('restaurant.menu', {
      success: true,
      data: [
        {
          id: 'item-1',
          name: 'Caesar Salad',
          description: 'Fresh romaine lettuce with parmesan',
          price: 12.99,
          category: 'Appetizers',
          imageUrl: 'https://example.com/caesar.jpg',
          available: true,
          preparationTime: 10,
          dietaryFlags: ['vegetarian'],
          allergens: ['dairy'],
          popular: true,
        },
        {
          id: 'item-2',
          name: 'Grilled Salmon',
          description: 'Atlantic salmon with herbs',
          price: 28.99,
          category: 'Main Courses',
          imageUrl: 'https://example.com/salmon.jpg',
          available: true,
          preparationTime: 25,
          dietaryFlags: ['gluten-free'],
          allergens: ['fish'],
          popular: true,
        },
      ],
    });
  }),

  placeOrder: jest.fn(async (data: any): Promise<ApiResponse<any>> => {
    trackCall('POST', '/restaurant/orders', data);
    
    return getMockResponse('restaurant.placeOrder', {
      success: true,
      data: {
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        total: 41.98,
        status: 'pending',
      },
    });
  }),

  getOrders: jest.fn(async (params?: any): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/restaurant/orders', params);
    
    return getMockResponse('restaurant.orders', {
      success: true,
      data: [
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: 'delivered',
          items: [
            { name: 'Caesar Salad', quantity: 2, price: 12.99 },
          ],
          total: 25.98,
          deliveryOption: 'room',
          roomNumber: '101',
          createdAt: new Date().toISOString(),
          estimatedTime: 30,
        },
      ],
    });
  }),
});

/**
 * Mock Pool API
 */
export const createMockPoolApi = () => ({
  getInfo: jest.fn(async (): Promise<ApiResponse<any>> => {
    trackCall('GET', '/pool/info', {});
    
    return getMockResponse('pool.info', {
      success: true,
      data: {
        id: 'pool-1',
        name: 'Main Pool',
        description: 'Olympic-sized swimming pool',
        amenities: ['Loungers', 'Towels', 'Bar service'],
        hours: '7:00 AM - 10:00 PM',
        rules: ['No diving', 'Shower before entering'],
      },
    });
  }),

  getAreas: jest.fn(async (): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/pool/areas', {});
    
    return getMockResponse('pool.areas', {
      success: true,
      data: [
        {
          id: 'area-1',
          name: 'Main Pool',
          description: 'Adults and families',
          capacity: 100,
          currentOccupancy: 45,
          image: 'https://example.com/pool.jpg',
          isOpen: true,
        },
      ],
    });
  }),

  getAvailability: jest.fn(async (date: string): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/pool/availability', { date });
    
    return getMockResponse('pool.availability', {
      success: true,
      data: [
        {
          id: 'slot-1',
          startTime: '09:00',
          endTime: '12:00',
          available: true,
          spotsAvailable: 20,
          maxCapacity: 50,
          price: 25,
        },
        {
          id: 'slot-2',
          startTime: '14:00',
          endTime: '17:00',
          available: true,
          spotsAvailable: 35,
          maxCapacity: 50,
          price: 25,
        },
      ],
    });
  }),

  getMyBookings: jest.fn(async (): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/pool/bookings/my', {});
    
    return getMockResponse('pool.myBookings', {
      success: true,
      data: [
        {
          id: 'booking-1',
          date: new Date().toISOString().split('T')[0],
          startTime: '09:00',
          endTime: '12:00',
          status: 'confirmed',
          guests: 2,
        },
      ],
    });
  }),

  book: jest.fn(async (data: any): Promise<ApiResponse<any>> => {
    trackCall('POST', '/pool/book', data);
    
    return getMockResponse('pool.book', {
      success: true,
      data: {
        bookingId: 'booking-new',
        qrCode: 'data:image/png;base64,mock-qr-code',
      },
    });
  }),

  cancelBooking: jest.fn(async (bookingId: string): Promise<ApiResponse<void>> => {
    trackCall('DELETE', `/pool/bookings/${bookingId}`, {});
    
    return getMockResponse('pool.cancel', { success: true });
  }),
});

/**
 * Mock Chalets API
 */
export const createMockChaletsApi = () => ({
  getChalets: jest.fn(async (moduleId?: string): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/chalets', { moduleId });
    
    return getMockResponse('chalets.list', {
      success: true,
      data: [
        {
          id: 'chalet-1',
          name: 'Mountain View Chalet',
          description: 'Beautiful mountain views',
          basePrice: 250,
          maxGuests: 6,
          bedrooms: 3,
          bathrooms: 2,
          amenities: ['WiFi', 'Kitchen', 'Fireplace'],
          images: ['https://example.com/chalet1.jpg'],
          isAvailable: true,
        },
      ],
    });
  }),

  getChalet: jest.fn(async (id: string): Promise<ApiResponse<any>> => {
    trackCall('GET', `/chalets/${id}`, {});
    
    return getMockResponse('chalets.details', {
      success: true,
      data: {
        id,
        name: 'Mountain View Chalet',
        description: 'Beautiful mountain views',
        basePrice: 250,
        maxGuests: 6,
        bedrooms: 3,
        bathrooms: 2,
        amenities: ['WiFi', 'Kitchen', 'Fireplace'],
        images: ['https://example.com/chalet1.jpg'],
        isAvailable: true,
        rules: ['No smoking', 'No pets'],
      },
    });
  }),

  getAvailability: jest.fn(async (chaletId: string, checkIn: string, checkOut: string): Promise<ApiResponse<any>> => {
    trackCall('GET', `/chalets/${chaletId}/availability`, { checkIn, checkOut });
    
    return getMockResponse('chalets.availability', {
      success: true,
      data: {
        isAvailable: true,
        totalPrice: 750,
        nights: 3,
      },
    });
  }),

  getAddOns: jest.fn(async (): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/chalets/add-ons', {});
    
    return getMockResponse('chalets.addOns', {
      success: true,
      data: [
        {
          id: 'addon-1',
          name: 'Breakfast Package',
          description: 'Daily breakfast for all guests',
          price: 25,
          category: 'food',
        },
      ],
    });
  }),

  createBooking: jest.fn(async (data: any): Promise<ApiResponse<any>> => {
    trackCall('POST', '/chalets/bookings', data);
    
    return getMockResponse('chalets.book', {
      success: true,
      data: {
        id: 'booking-new',
        bookingNumber: 'CHB-001',
        status: 'pending',
        totalPrice: 750,
      },
    });
  }),

  getMyBookings: jest.fn(async (): Promise<ApiResponse<any[]>> => {
    trackCall('GET', '/chalets/my-bookings', {});
    
    return getMockResponse('chalets.myBookings', {
      success: true,
      data: [
        {
          id: 'booking-1',
          bookingNumber: 'CHB-001',
          chalet: { id: 'chalet-1', name: 'Mountain View Chalet', images: [] },
          checkInDate: '2026-02-01',
          checkOutDate: '2026-02-04',
          numberOfGuests: 4,
          totalPrice: 750,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }),
});

/**
 * Mock Payment API
 */
export const createMockPaymentApi = () => ({
  createIntent: jest.fn(async (data: any): Promise<ApiResponse<any>> => {
    trackCall('POST', '/payments/create-intent', data);
    
    return getMockResponse('payment.createIntent', {
      success: true,
      data: {
        clientSecret: 'pi_test_secret_xxx',
        paymentIntentId: 'pi_test_xxx',
        amount: data.amount,
        discounts: [],
      },
    });
  }),

  confirm: jest.fn(async (paymentIntentId: string): Promise<ApiResponse<any>> => {
    trackCall('POST', '/payments/confirm', { paymentIntentId });
    
    return getMockResponse('payment.confirm', {
      success: true,
      data: {
        status: 'succeeded',
        receiptUrl: 'https://example.com/receipt',
      },
    });
  }),
});

/**
 * Mock Coupon API
 */
export const createMockCouponApi = () => ({
  validate: jest.fn(async (code: string, context?: any): Promise<ApiResponse<any>> => {
    trackCall('POST', '/coupons/validate', { code, ...context });
    
    return getMockResponse('coupon.validate', {
      success: true,
      data: {
        code,
        discount: 10,
        type: 'percentage',
        discountType: 'percentage',
        discountValue: 10,
        isValid: true,
      },
    });
  }),
});

/**
 * Create all mock APIs
 */
export const createAllMockApis = () => ({
  authApi: createMockAuthApi(),
  profileApi: createMockProfileApi(),
  deviceApi: createMockDeviceApi(),
  loyaltyApi: createMockLoyaltyApi(),
  giftCardApi: createMockGiftCardApi(),
  restaurantApi: createMockRestaurantApi(),
  poolApi: createMockPoolApi(),
  chaletsApi: createMockChaletsApi(),
  paymentApi: createMockPaymentApi(),
  couponApi: createMockCouponApi(),
});

export default createAllMockApis;
