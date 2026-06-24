/**
 * Data Factories for Test Objects
 *
 * Each factory produces a valid, complete object with sensible defaults.
 * Pass an `overrides` partial to customise any field.
 * All IDs use `crypto.randomUUID()` for uniqueness across tests.
 */

import { randomUUID } from 'node:crypto';

// ─── Helper ──────────────────────────────────────────────────────────

function isoNow(): string {
  return new Date().toISOString();
}

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0]!;
}

// ─── User ────────────────────────────────────────────────────────────

export interface FactoryUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  profile_image_url: string | null;
  preferred_language: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export function createUser(overrides?: Partial<FactoryUser>): FactoryUser {
  const id = randomUUID();
  return {
    id,
    email: `user-${id.slice(0, 8)}@test.com`,
    full_name: 'Test User',
    phone: '+1234567890',
    profile_image_url: null,
    preferred_language: 'en',
    is_active: true,
    roles: ['customer'],
    permissions: [],
    created_at: isoNow(),
    updated_at: isoNow(),
    last_login_at: null,
    ...overrides,
  };
}

// ─── Menu Item ───────────────────────────────────────────────────────

export interface FactoryMenuItem {
  id: string;
  category_id: string;
  name: string;
  name_ar: string | null;
  name_fr: string | null;
  description: string | null;
  price: string;
  preparation_time_minutes: number | null;
  calories: number | null;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  allergens: string[];
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function createMenuItem(overrides?: Partial<FactoryMenuItem>): FactoryMenuItem {
  return {
    id: randomUUID(),
    category_id: randomUUID(),
    name: 'Classic Burger',
    name_ar: null,
    name_fr: null,
    description: 'Juicy beef burger with lettuce and tomato',
    price: '15.00',
    preparation_time_minutes: 15,
    calories: 650,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    allergens: ['gluten', 'dairy'],
    image_url: null,
    is_available: true,
    is_featured: false,
    display_order: 0,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── Order Item ──────────────────────────────────────────────────────

export interface FactoryOrderItem {
  id: string;
  order_id: string;
  catalog_item_id: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  selected_modifiers: unknown[];
  modifier_total: string;
  special_instructions: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export function createOrderItem(overrides?: Partial<FactoryOrderItem>): FactoryOrderItem {
  const qty = overrides?.quantity ?? 2;
  const price = overrides?.unit_price ?? '15.00';
  const subtotal = overrides?.subtotal ?? (qty * parseFloat(price)).toFixed(2);
  return {
    id: randomUUID(),
    order_id: randomUUID(),
    catalog_item_id: randomUUID(),
    quantity: qty,
    unit_price: price,
    subtotal,
    selected_modifiers: [],
    modifier_total: '0.00',
    special_instructions: null,
    status: null,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── MenuService Order ────────────────────────────────────────────────

export interface FactoryMenuServiceOrder {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  table_id: string | null;
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  status: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  payment_status: string;
  payment_method: string | null;
  special_instructions: string | null;
  estimated_ready_time: string | null;
  order_items: FactoryOrderItem[];
  created_at: string;
  updated_at: string;
}

export function createRestaurantOrder(
  overrides?: Partial<FactoryMenuServiceOrder>,
): FactoryMenuServiceOrder {
  const items = overrides?.order_items ?? [createOrderItem(), createOrderItem()];
  const subtotal =
    overrides?.subtotal ??
    items.reduce((s, i) => s + parseFloat(i.subtotal), 0).toFixed(2);
  const tax = overrides?.tax_amount ?? (parseFloat(subtotal) * 0.1).toFixed(2);
  const total =
    overrides?.total_amount ??
    (parseFloat(subtotal) + parseFloat(tax)).toFixed(2);

  return {
    id: randomUUID(),
    order_number: `ORD-${Date.now().toString(36).toUpperCase()}`,
    customer_id: null,
    customer_name: 'Test Customer',
    customer_phone: '+1234567890',
    table_id: null,
    order_type: 'dine_in',
    status: 'pending',
    subtotal,
    tax_amount: tax,
    discount_amount: '0.00',
    total_amount: total,
    payment_status: 'pending',
    payment_method: null,
    special_instructions: null,
    estimated_ready_time: null,
    order_items: items,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── AccommodationUnit ──────────────────────────────────────────────────────────

export interface FactoryAccommodationUnit {
  id: string;
  name: string;
  name_ar: string | null;
  name_fr: string | null;
  description: string | null;
  capacity: number;
  bedroom_count: number;
  bathroom_count: number;
  amenities: string[];
  images: string[];
  base_price: string;
  weekend_price: string;
  is_active: boolean;
  clean_state: string;
  created_at: string;
  updated_at: string;
}

export function createAccommodationUnit(overrides?: Partial<FactoryAccommodationUnit>): FactoryAccommodationUnit {
  return {
    id: randomUUID(),
    name: 'Sunset AccommodationUnit',
    name_ar: null,
    name_fr: null,
    description: 'Spacious lakeside accommodation unit with mountain views',
    capacity: 6,
    bedroom_count: 2,
    bathroom_count: 1,
    amenities: ['wifi', 'pool_access', 'bbq', 'parking'],
    images: [],
    base_price: '250.00',
    weekend_price: '350.00',
    is_active: true,
    clean_state: 'clean',
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── AccommodationUnit Booking ──────────────────────────────────────────────────

export interface FactoryUnitBooking {
  id: string;
  booking_number: string;
  unit_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  number_of_nights: number;
  base_amount: string;
  add_ons_amount: string;
  discount_amount: string;
  deposit_amount: string;
  total_amount: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  payment_status: string;
  payment_method: string | null;
  special_requests: string | null;
  created_at: string;
  updated_at: string;
}

export function createChaletBooking(
  overrides?: Partial<FactoryUnitBooking>,
): FactoryUnitBooking {
  return {
    id: randomUUID(),
    booking_number: `BK-${Date.now().toString(36).toUpperCase()}`,
    unit_id: randomUUID(),
    customer_id: null,
    customer_name: 'Jane Doe',
    customer_email: 'jane@example.com',
    customer_phone: '+1234567890',
    check_in_date: dateStr(7),
    check_out_date: dateStr(9),
    number_of_guests: 4,
    number_of_nights: 2,
    base_amount: '500.00',
    add_ons_amount: '0.00',
    discount_amount: '0.00',
    deposit_amount: '100.00',
    total_amount: '500.00',
    status: 'confirmed',
    payment_status: 'pending',
    payment_method: null,
    special_requests: null,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── Pool Session ────────────────────────────────────────────────────

export interface FactoryCapacityWindow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  price: string;
  gender_restriction: 'mixed' | 'male' | 'female';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function createPoolSession(
  overrides?: Partial<FactoryCapacityWindow>,
): FactoryCapacityWindow {
  return {
    id: randomUUID(),
    name: 'Morning Swim',
    start_time: '09:00',
    end_time: '12:00',
    max_capacity: 80,
    price: '25.00',
    gender_restriction: 'mixed',
    is_active: true,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── Pool Ticket ─────────────────────────────────────────────────────

export interface FactoryCapacityTicket {
  id: string;
  ticket_number: string;
  session_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  ticket_date: string;
  number_of_guests: number;
  total_amount: string;
  status: 'valid' | 'used' | 'expired' | 'cancelled';
  payment_status: string;
  payment_method: string | null;
  qr_code: string;
  created_at: string;
  updated_at: string;
}

export function createPoolTicket(
  overrides?: Partial<FactoryCapacityTicket>,
): FactoryCapacityTicket {
  return {
    id: randomUUID(),
    ticket_number: `PT-${Date.now().toString(36).toUpperCase()}`,
    session_id: randomUUID(),
    customer_id: null,
    customer_name: 'Pool Guest',
    customer_phone: '+1234567890',
    ticket_date: dateStr(1),
    number_of_guests: 2,
    total_amount: '50.00',
    status: 'valid',
    payment_status: 'paid',
    payment_method: 'cash',
    qr_code: 'data:image/png;base64,mockQR',
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── Payment ─────────────────────────────────────────────────────────

export interface FactoryPayment {
  id: string;
  reference_type: string;
  reference_id: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  receipt_url: string | null;
  processed_by: string | null;
  processed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function createPayment(overrides?: Partial<FactoryPayment>): FactoryPayment {
  return {
    id: randomUUID(),
    reference_type: 'menu_service_order',
    reference_id: randomUUID(),
    amount: '65.00',
    currency: 'USD',
    method: 'card',
    status: 'completed',
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    receipt_url: null,
    processed_by: null,
    processed_at: null,
    notes: null,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── Loyalty Account ─────────────────────────────────────────────────

export interface FactoryLoyaltyAccount {
  id: string;
  user_id: string;
  tier_id: string | null;
  tier_name: string;
  total_points: number;
  available_points: number;
  lifetime_points: number;
  member_since: string;
  last_activity: string;
  created_at: string;
  updated_at: string;
}

export function createLoyaltyAccount(
  overrides?: Partial<FactoryLoyaltyAccount>,
): FactoryLoyaltyAccount {
  return {
    id: randomUUID(),
    user_id: randomUUID(),
    tier_id: null,
    tier_name: 'Bronze',
    total_points: 1200,
    available_points: 800,
    lifetime_points: 5000,
    member_since: isoNow(),
    last_activity: isoNow(),
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── Gift Card ───────────────────────────────────────────────────────

export interface FactoryGiftCard {
  id: string;
  code: string;
  template_id: string | null;
  initial_value: string;
  current_balance: string;
  currency: string;
  status: string;
  recipient_email: string | null;
  recipient_name: string | null;
  sender_name: string | null;
  personal_message: string | null;
  purchased_by: string | null;
  is_physical: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export function createGiftCard(overrides?: Partial<FactoryGiftCard>): FactoryGiftCard {
  const code = `GC-${randomUUID().slice(0, 8).toUpperCase()}`;
  return {
    id: randomUUID(),
    code,
    template_id: null,
    initial_value: '100.00',
    current_balance: '100.00',
    currency: 'USD',
    status: 'active',
    recipient_email: 'recipient@example.com',
    recipient_name: 'Gift Recipient',
    sender_name: 'Gift Sender',
    personal_message: null,
    purchased_by: null,
    is_physical: false,
    expires_at: null,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── Coupon ──────────────────────────────────────────────────────────

export interface FactoryCoupon {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  discount_type: string;
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string | null;
  applies_to: string;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  stackable: boolean;
  first_order_only: boolean;
  min_items: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export function createCoupon(overrides?: Partial<FactoryCoupon>): FactoryCoupon {
  return {
    id: randomUUID(),
    code: `SAVE-${randomUUID().slice(0, 6).toUpperCase()}`,
    name: '10% Off',
    description: 'Get 10% off your order',
    discount_type: 'percentage',
    discount_value: '10.00',
    min_order_amount: '20.00',
    max_discount_amount: '50.00',
    applies_to: 'all',
    usage_limit: 100,
    usage_count: 0,
    per_user_limit: 1,
    stackable: false,
    first_order_only: false,
    min_items: 1,
    is_active: true,
    valid_from: isoNow(),
    valid_until: null,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── Inventory Item ──────────────────────────────────────────────────

export interface FactoryInventoryItem {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category_id: string | null;
  unit: string;
  current_stock: string;
  min_stock_level: string;
  max_stock_level: string | null;
  reorder_point: string;
  cost_per_unit: string | null;
  last_purchase_price: string | null;
  supplier: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function createInventoryItem(
  overrides?: Partial<FactoryInventoryItem>,
): FactoryInventoryItem {
  return {
    id: randomUUID(),
    name: 'Tomatoes',
    sku: `SKU-${randomUUID().slice(0, 8).toUpperCase()}`,
    description: 'Fresh vine tomatoes',
    category_id: null,
    unit: 'kg',
    current_stock: '50.00',
    min_stock_level: '10.00',
    max_stock_level: '200.00',
    reorder_point: '20.00',
    cost_per_unit: '2.50',
    last_purchase_price: '2.30',
    supplier: 'Fresh Farms Inc.',
    location: 'Kitchen Storage A',
    is_active: true,
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── Module ──────────────────────────────────────────────────────────

export interface FactoryModule {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  template_type: string | null;
  icon: string | null;
  version: string | null;
  settings: Record<string, unknown>;
  is_enabled: boolean;
  is_core: boolean;
  sort_order: string;
  created_at: string;
  updated_at: string;
}

export function createModule(overrides?: Partial<FactoryModule>): FactoryModule {
  const slug = `module-${randomUUID().slice(0, 8)}`;
  return {
    id: randomUUID(),
    name: 'MenuService',
    slug,
    description: 'Main menu service module',
    template_type: null,
    icon: 'utensils',
    version: '1.0.0',
    settings: {},
    is_enabled: true,
    is_core: false,
    sort_order: '0',
    created_at: isoNow(),
    updated_at: isoNow(),
    ...overrides,
  };
}

// ─── Notification ────────────────────────────────────────────────────

export interface FactoryNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  priority: string;
  target_type: string | null;
  target_id: string | null;
  actions: unknown[];
  read: boolean;
  read_at: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
}

export function createNotification(
  overrides?: Partial<FactoryNotification>,
): FactoryNotification {
  return {
    id: randomUUID(),
    user_id: randomUUID(),
    type: 'info',
    title: 'New Order',
    message: 'You have a new order #ORD-123',
    channel: 'in_app',
    priority: 'normal',
    target_type: null,
    target_id: null,
    actions: [],
    read: false,
    read_at: null,
    scheduled_for: null,
    sent_at: null,
    created_at: isoNow(),
    ...overrides,
  };
}
