/**
 * Test Fixture Factories
 * 
 * Provides comprehensive factory functions for creating test data.
 * All fixtures are typed and support partial overrides for flexibility.
 */

import { User, AuthTokens, ApiResponse } from '../../src/api/client';

// ============================================================================
// User Fixtures
// ============================================================================

export interface CreateUserOptions {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  roles?: string[];
  loyaltyPoints?: number;
}

let userCounter = 0;

export const createMockUser = (overrides: CreateUserOptions = {}): User => {
  userCounter++;
  return {
    id: overrides.id ?? `user-${userCounter}`,
    email: overrides.email ?? `user${userCounter}@test.com`,
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    phone: overrides.phone ?? '+1234567890',
    roles: overrides.roles ?? ['customer'],
    loyaltyPoints: overrides.loyaltyPoints ?? 1000,
  };
};

export const createMockStaffUser = (overrides: CreateUserOptions = {}): User => {
  return createMockUser({
    ...overrides,
    roles: overrides.roles ?? ['staff', 'customer'],
  });
};

export const createMockAdminUser = (overrides: CreateUserOptions = {}): User => {
  return createMockUser({
    ...overrides,
    roles: overrides.roles ?? ['admin', 'customer'],
  });
};

// ============================================================================
// Auth Token Fixtures
// ============================================================================

export interface CreateAuthTokensOptions {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

let tokenCounter = 0;

export const createMockAuthTokens = (overrides: CreateAuthTokensOptions = {}): AuthTokens => {
  tokenCounter++;
  return {
    accessToken: overrides.accessToken ?? `access-token-${tokenCounter}`,
    refreshToken: overrides.refreshToken ?? `refresh-token-${tokenCounter}`,
    expiresIn: overrides.expiresIn ?? 900, // 15 minutes
  };
};

// ============================================================================
// API Response Fixtures
// ============================================================================

export const createMockApiResponse = <T>(
  data: T,
  success: boolean = true,
  error?: string
): ApiResponse<T> => ({
  success,
  data: success ? data : undefined,
  error: success ? undefined : error,
});

export const createMockSuccessResponse = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data,
});

export const createMockErrorResponse = <T = any>(
  error: string,
  code?: string
): ApiResponse<T> => ({
  success: false,
  error,
  code,
});

// ============================================================================
// Restaurant / Menu Fixtures
// ============================================================================

export interface CreateMenuItemOptions {
  id?: string;
  name?: string;
  description?: string;
  price?: number;
  category?: string;
  imageUrl?: string | null;
  available?: boolean;
  preparationTime?: number;
  dietaryFlags?: string[];
  allergens?: string[];
  popular?: boolean;
}

let menuItemCounter = 0;

export const createMockMenuItem = (overrides: CreateMenuItemOptions = {}) => {
  menuItemCounter++;
  return {
    id: overrides.id ?? `item-${menuItemCounter}`,
    name: overrides.name ?? `Menu Item ${menuItemCounter}`,
    description: overrides.description ?? 'Delicious dish',
    price: overrides.price ?? 19.99,
    category: overrides.category ?? 'Main Courses',
    imageUrl: overrides.imageUrl ?? `https://example.com/item${menuItemCounter}.jpg`,
    available: overrides.available ?? true,
    preparationTime: overrides.preparationTime ?? 20,
    dietaryFlags: overrides.dietaryFlags ?? [],
    allergens: overrides.allergens ?? [],
    popular: overrides.popular ?? false,
  };
};

export interface CreateMenuCategoryOptions {
  id?: string;
  name?: string;
  icon?: string;
  itemCount?: number;
}

let categoryCounter = 0;

export const createMockMenuCategory = (overrides: CreateMenuCategoryOptions = {}) => {
  categoryCounter++;
  return {
    id: overrides.id ?? `cat-${categoryCounter}`,
    name: overrides.name ?? `Category ${categoryCounter}`,
    icon: overrides.icon ?? '🍽️',
    itemCount: overrides.itemCount ?? 10,
  };
};

// ============================================================================
// Order Fixtures
// ============================================================================

export interface CreateOrderOptions {
  id?: string;
  orderNumber?: string;
  status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  items?: Array<{ name: string; quantity: number; price: number }>;
  total?: number;
  deliveryOption?: 'room' | 'pickup';
  roomNumber?: string;
  createdAt?: string;
  estimatedTime?: number;
}

let orderCounter = 0;

export const createMockOrder = (overrides: CreateOrderOptions = {}) => {
  orderCounter++;
  return {
    id: overrides.id ?? `order-${orderCounter}`,
    orderNumber: overrides.orderNumber ?? `ORD-${String(orderCounter).padStart(3, '0')}`,
    status: overrides.status ?? 'pending',
    items: overrides.items ?? [
      { name: 'Caesar Salad', quantity: 1, price: 12.99 },
      { name: 'Grilled Salmon', quantity: 1, price: 28.99 },
    ],
    total: overrides.total ?? 41.98,
    deliveryOption: overrides.deliveryOption ?? 'room',
    roomNumber: overrides.roomNumber ?? '101',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    estimatedTime: overrides.estimatedTime ?? 30,
  };
};

// ============================================================================
// Pool Booking Fixtures
// ============================================================================

export interface CreatePoolBookingOptions {
  id?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: 'confirmed' | 'pending' | 'cancelled';
  guests?: number;
}

let poolBookingCounter = 0;

export const createMockPoolBooking = (overrides: CreatePoolBookingOptions = {}) => {
  poolBookingCounter++;
  const today = new Date().toISOString().split('T')[0];
  return {
    id: overrides.id ?? `pool-booking-${poolBookingCounter}`,
    date: overrides.date ?? today,
    startTime: overrides.startTime ?? '09:00',
    endTime: overrides.endTime ?? '12:00',
    status: overrides.status ?? 'confirmed',
    guests: overrides.guests ?? 2,
  };
};

export interface CreatePoolSlotOptions {
  id?: string;
  startTime?: string;
  endTime?: string;
  available?: boolean;
  spotsAvailable?: number;
  maxCapacity?: number;
  price?: number;
}

let poolSlotCounter = 0;

export const createMockPoolSlot = (overrides: CreatePoolSlotOptions = {}) => {
  poolSlotCounter++;
  return {
    id: overrides.id ?? `slot-${poolSlotCounter}`,
    startTime: overrides.startTime ?? '09:00',
    endTime: overrides.endTime ?? '12:00',
    available: overrides.available ?? true,
    spotsAvailable: overrides.spotsAvailable ?? 20,
    maxCapacity: overrides.maxCapacity ?? 50,
    price: overrides.price ?? 25,
  };
};

// ============================================================================
// Chalet Fixtures
// ============================================================================

export interface CreateChaletOptions {
  id?: string;
  name?: string;
  description?: string;
  basePrice?: number;
  maxGuests?: number;
  bedrooms?: number;
  bathrooms?: number;
  amenities?: string[];
  images?: string[];
  isAvailable?: boolean;
  rules?: string[];
}

let chaletCounter = 0;

export const createMockChalet = (overrides: CreateChaletOptions = {}) => {
  chaletCounter++;
  return {
    id: overrides.id ?? `chalet-${chaletCounter}`,
    name: overrides.name ?? `Mountain Chalet ${chaletCounter}`,
    description: overrides.description ?? 'Beautiful mountain retreat',
    basePrice: overrides.basePrice ?? 250,
    maxGuests: overrides.maxGuests ?? 6,
    bedrooms: overrides.bedrooms ?? 3,
    bathrooms: overrides.bathrooms ?? 2,
    amenities: overrides.amenities ?? ['WiFi', 'Kitchen', 'Fireplace', 'Hot Tub'],
    images: overrides.images ?? [`https://example.com/chalet${chaletCounter}.jpg`],
    isAvailable: overrides.isAvailable ?? true,
    rules: overrides.rules ?? ['No smoking', 'No pets', 'Quiet hours after 10 PM'],
  };
};

export interface CreateChaletBookingOptions {
  id?: string;
  bookingNumber?: string;
  chalet?: { id: string; name: string; images: string[] };
  checkInDate?: string;
  checkOutDate?: string;
  numberOfGuests?: number;
  totalPrice?: number;
  status?: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  createdAt?: string;
}

let chaletBookingCounter = 0;

export const createMockChaletBooking = (overrides: CreateChaletBookingOptions = {}) => {
  chaletBookingCounter++;
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 7);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 3);

  return {
    id: overrides.id ?? `chalet-booking-${chaletBookingCounter}`,
    bookingNumber: overrides.bookingNumber ?? `CHB-${String(chaletBookingCounter).padStart(3, '0')}`,
    chalet: overrides.chalet ?? {
      id: 'chalet-1',
      name: 'Mountain View Chalet',
      images: ['https://example.com/chalet1.jpg'],
    },
    checkInDate: overrides.checkInDate ?? checkIn.toISOString().split('T')[0],
    checkOutDate: overrides.checkOutDate ?? checkOut.toISOString().split('T')[0],
    numberOfGuests: overrides.numberOfGuests ?? 4,
    totalPrice: overrides.totalPrice ?? 750,
    status: overrides.status ?? 'confirmed',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
};

// ============================================================================
// Gift Card Fixtures
// ============================================================================

export interface CreateGiftCardOptions {
  id?: string;
  code?: string;
  balance?: number;
  initialValue?: number;
  status?: 'active' | 'depleted' | 'expired';
  expiresAt?: string | null;
  createdAt?: string;
}

let giftCardCounter = 0;

export const createMockGiftCard = (overrides: CreateGiftCardOptions = {}) => {
  giftCardCounter++;
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  return {
    id: overrides.id ?? `gc-${giftCardCounter}`,
    code: overrides.code ?? `GIFT-XXXX-${String(giftCardCounter).padStart(4, '0')}`,
    balance: overrides.balance ?? 100,
    initialValue: overrides.initialValue ?? 100,
    status: overrides.status ?? 'active',
    expiresAt: overrides.expiresAt ?? expiresAt.toISOString(),
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
};

// ============================================================================
// Loyalty Fixtures
// ============================================================================

export interface CreateLoyaltyStatusOptions {
  points?: number;
  tier?: string;
  tierBenefits?: string[];
  nextTier?: string | null;
  pointsToNextTier?: number | null;
  lifetimePoints?: number;
  tierMultiplier?: number;
}

export const createMockLoyaltyStatus = (overrides: CreateLoyaltyStatusOptions = {}) => ({
  points: overrides.points ?? 5000,
  tier: overrides.tier ?? 'Gold',
  tierBenefits: overrides.tierBenefits ?? ['10% discount', 'Free upgrades', 'Priority booking'],
  nextTier: overrides.nextTier ?? 'Platinum',
  pointsToNextTier: overrides.pointsToNextTier ?? 5000,
  lifetimePoints: overrides.lifetimePoints ?? 15000,
  tierMultiplier: overrides.tierMultiplier ?? 1.5,
});

export interface CreateLoyaltyTransactionOptions {
  id?: string;
  type?: 'earn' | 'redeem';
  points?: number;
  description?: string;
  date?: string;
  category?: string;
}

let loyaltyTransactionCounter = 0;

export const createMockLoyaltyTransaction = (overrides: CreateLoyaltyTransactionOptions = {}) => {
  loyaltyTransactionCounter++;
  return {
    id: overrides.id ?? `txn-${loyaltyTransactionCounter}`,
    type: overrides.type ?? 'earn',
    points: overrides.points ?? 500,
    description: overrides.description ?? 'Restaurant order',
    date: overrides.date ?? new Date().toISOString(),
    category: overrides.category ?? 'restaurant',
  };
};

export interface CreateLoyaltyRewardOptions {
  id?: string;
  name?: string;
  pointsCost?: number;
  description?: string;
  available?: boolean;
  category?: string;
}

let rewardCounter = 0;

export const createMockLoyaltyReward = (overrides: CreateLoyaltyRewardOptions = {}) => {
  rewardCounter++;
  return {
    id: overrides.id ?? `reward-${rewardCounter}`,
    name: overrides.name ?? `Reward ${rewardCounter}`,
    pointsCost: overrides.pointsCost ?? 500,
    description: overrides.description ?? 'Exclusive reward',
    available: overrides.available ?? true,
    category: overrides.category ?? 'general',
  };
};

// ============================================================================
// Payment Fixtures
// ============================================================================

export interface CreatePaymentIntentOptions {
  clientSecret?: string;
  paymentIntentId?: string;
  amount?: number;
  discounts?: Array<{ type: string; amount: number }>;
}

let paymentCounter = 0;

export const createMockPaymentIntent = (overrides: CreatePaymentIntentOptions = {}) => {
  paymentCounter++;
  return {
    clientSecret: overrides.clientSecret ?? `pi_test_secret_${paymentCounter}`,
    paymentIntentId: overrides.paymentIntentId ?? `pi_test_${paymentCounter}`,
    amount: overrides.amount ?? 100,
    discounts: overrides.discounts ?? [],
  };
};

// ============================================================================
// Reset Counters (for test isolation)
// ============================================================================

export const resetFixtureCounters = () => {
  userCounter = 0;
  tokenCounter = 0;
  menuItemCounter = 0;
  categoryCounter = 0;
  orderCounter = 0;
  poolBookingCounter = 0;
  poolSlotCounter = 0;
  chaletCounter = 0;
  chaletBookingCounter = 0;
  giftCardCounter = 0;
  loyaltyTransactionCounter = 0;
  rewardCounter = 0;
  paymentCounter = 0;
};

// Reset counters before each test
beforeEach(() => {
  resetFixtureCounters();
});
