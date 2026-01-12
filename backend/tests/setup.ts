/**
 * Test Setup and Utilities
 * 
 * Provides mock implementations and test utilities for unit testing.
 */

import { vi, beforeAll, afterAll, beforeEach } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// Create a mock Supabase client
export const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
};

// Mock factory functions
export function createMockUser(overrides = {}) {
  return {
    id: 'test-user-id-123',
    email: 'test@example.com',
    full_name: 'Test User',
    phone: '+1234567890',
    profile_image_url: null,
    preferred_language: 'en',
    is_active: true,
    password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4a.jvMwWJ.FnhQfi', // "password123"
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login_at: null,
    ...overrides
  };
}

export function createMockRole(overrides = {}) {
  return {
    id: 'test-role-id-123',
    name: 'customer',
    display_name: 'Customer',
    description: 'Default customer role',
    ...overrides
  };
}

export function createMockOrder(overrides = {}) {
  return {
    id: 'test-order-id-123',
    order_number: 'ORD-001',
    status: 'pending',
    order_type: 'dine_in',
    customer_name: 'Test Customer',
    customer_phone: '+1234567890',
    total_amount: '50.00',
    payment_status: 'pending',
    user_id: null,
    table_number: '5',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

export function createMockBooking(overrides = {}) {
  return {
    id: 'test-booking-id-123',
    confirmation_number: 'BK-001',
    chalet_id: 'test-chalet-id',
    status: 'confirmed',
    check_in_date: '2026-01-15',
    check_out_date: '2026-01-17',
    number_of_guests: 2,
    guest_name: 'Test Guest',
    guest_email: 'guest@example.com',
    guest_phone: '+1234567890',
    total_amount: '500.00',
    payment_status: 'pending',
    user_id: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

export function createMockMenuItem(overrides = {}) {
  return {
    id: 'test-menu-item-id-123',
    name: 'Test Burger',
    name_ar: 'برجر اختبار',
    description: 'A delicious test burger',
    price: '15.00',
    category_id: 'test-category-id',
    is_available: true,
    is_featured: false,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Global test utilities
export const testUtils = {
  generateAuthHeader: (token: string) => `Bearer ${token}`,
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};
