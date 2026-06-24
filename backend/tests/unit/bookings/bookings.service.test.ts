/**
 * Bookings Service Unit Tests
 * Rewired to test src/modules/bookings/bookings.service.ts (post-Engine-Refit).
 * All external calls mocked — no DB, no network.
 */

// ── Logger ───────────────────────────────────────────────────────────────────
vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Engine service ────────────────────────────────────────────────────────────
const mockTransitionState = vi.fn();
const mockCalculatePricing = vi.fn();
vi.mock('../../../src/engines/engine-service.js', () => ({
  getEngineService: () => ({
    transitionState: mockTransitionState,
    calculatePricing: mockCalculatePricing,
  }),
}));

// ── DB chain mock ─────────────────────────────────────────────────────────────
//
// The Supabase client uses a fluent builder pattern:
//   supabase.from('x').select('*').eq('a','b').eq('c','d').single()
//   supabase.from('x').select('id',{count:'exact',head:true}).eq().not().filter().filter()
//   supabase.from('x').update({}).eq().select().single()
//
// Every intermediate method must return the chain itself so chaining works.
// Terminal methods (single, maybeSingle) resolve to { data, error }.
// Count queries resolve the LAST filter() call to { count, error }.
// The awaitable query (no terminal) resolves the last chained method via
// mockReturnValue — so filter/order/eq can also be set to resolve directly.

const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockRpc = vi.fn();
const mockThen = vi.fn();

const mockFrom = vi.fn();

// The chain object — every builder method returns this same object.
const chain: Record<string, any> = {};

const chainMethods = [
  'select', 'eq', 'filter', 'not', 'order', 'in',
  'update', 'insert', 'delete', 'upsert', 'limit', 'gte', 'lte', 'gt', 'lt',
  'neq', 'is', 'ilike', 'contains', 'range',
];

// Wire all chain methods to return `chain` by default (overrideable per-test).
const resetChain = () => {
  chainMethods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  // Terminal methods — default to safe empty resolutions.
  chain.single = vi.fn().mockImplementation(() => mockSingle());
  chain.maybeSingle = vi.fn().mockImplementation(() => mockMaybeSingle());
  chain.then = vi.fn().mockImplementation((resolve: any, reject: any) => {
    return Promise.resolve(mockThen()).then(resolve, reject);
  });
  chain.from = mockFrom.mockReturnValue(chain);
  chain.rpc = mockRpc;

  mockSingle.mockReset();
  mockMaybeSingle.mockReset();
  mockRpc.mockReset();
  mockThen.mockReset();
  mockFrom.mockReset().mockReturnValue(chain);
};

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => chain),
}));

import * as bookingsService from '../../../src/modules/bookings/bookings.service.js';

// ─────────────────────────────────────────────────────────────────────────────

const baseUnit = {
  id: 'unit-1',
  module_id: 'mod-1',
  name: 'AccommodationUnit A',
  capacity: 4,
  base_price: '100.00',
  weekend_price: '150.00',
  is_active: true,
  property_id: null,
};

const baseBooking = {
  id: 'booking-1',
  booking_number: 'BK-260101-ABCD',
  module_id: 'mod-1',
  status: 'confirmed',
  payment_status: 'pending',
  amount: '300.00',
  engine_type: 'time_exclusive_reservation',
  metadata: {
    unit_id: 'unit-1',
    customer_name: 'John Doe',
    check_in_date: '2026-07-01T00:00:00Z',
    check_out_date: '2026-07-04T00:00:00Z',
    number_of_nights: 3,
    number_of_guests: 2,
    base_amount: '300.00',
    add_ons_amount: '0.00',
    deposit_amount: '90.00',
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  resetChain();
  mockTransitionState.mockResolvedValue({ allowed: true, targetState: 'cancelled' });
  mockCalculatePricing.mockRejectedValue(new Error('Engine offline'));
});

// ── calculateReservationPrice ─────────────────────────────────────────────────
//
// Service call sequence:
//   1. from('accommodation_units').select('*').eq('id', unitId).single()
//      → { data: unit, error }
//   2. from('unit_price_rules').select('*').eq('unit_id',unitId).eq('is_active',true)
//      → awaited directly as { data: rules, error } — resolved by the last eq()
//   3. from('modules').select('config').eq('id', moduleId).single()
//      → { data: { config: {} }, error }

describe('calculateReservationPrice', () => {
  it('computes base amount from nightly rate x nights', async () => {
    // Call 1 — unit lookup
    mockSingle
      .mockResolvedValueOnce({ data: baseUnit, error: null })
      // Call 3 — module config
      .mockResolvedValueOnce({ data: { config: {} }, error: null });

    // Call 2 — price rules query
    mockThen.mockResolvedValueOnce({ data: [], error: null });

    // 3 weekdays Mon–Wed at $100/night = $300
    const result = await bookingsService.calculateReservationPrice(
      'unit-1', 'mod-1', '2026-07-06', '2026-07-09'
    );

    expect(result.numberOfNights).toBe(3);
    expect(result.baseAmount).toBe(300);
    expect(result.totalAmount).toBe(300);
    expect(result.addOnsAmount).toBe(0);
  });

  it('throws UNIT_NOT_FOUND when unit missing', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    await expect(
      bookingsService.calculateReservationPrice('bad-unit', 'mod-1', '2026-07-01', '2026-07-04')
    ).rejects.toMatchObject({ code: 'UNIT_NOT_FOUND' });
  });

  it('throws INVALID_DATE_RANGE when checkout before checkin', async () => {
    mockSingle.mockResolvedValueOnce({ data: baseUnit, error: null });
    await expect(
      bookingsService.calculateReservationPrice('unit-1', 'mod-1', '2026-07-04', '2026-07-01')
    ).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
  });
});

// ── createBooking ─────────────────────────────────────────────────────────────
//
// Service call sequence:
//   1. from('accommodation_units').select('*').eq('id',unitId).single()  → unit
//   2. calculateReservationPrice internally:
//      a. accommodation_units single  → unit (again)
//      b. unit_price_rules eq chain   → []
//      c. modules single              → { config: {} }
//   3. rpc('reserve_unit_exclusive_atomic', ...) → { data: [{success,transaction_id}] }
//   4. from('transactions').select('*').eq('id', txId).single() → booking
//   (optional 5. update for discount/tax — skipped when enginePricing is null)

describe('createBooking', () => {
  function setupCreateMocks(unitOverride: Record<string, unknown> = {}) {
    const unit = { ...baseUnit, ...unitOverride };

    mockSingle
      .mockResolvedValueOnce({ data: unit, error: null })   // 1. unit check
      .mockResolvedValueOnce({ data: unit, error: null })   // 2a. unit inside calculateReservationPrice
      .mockResolvedValueOnce({ data: { config: {} }, error: null }) // 2c. module config
      .mockResolvedValueOnce({ data: baseBooking, error: null });   // 4. fetch created booking

    // 2b. price rules query
    mockThen.mockResolvedValueOnce({ data: [], error: null });

    mockRpc.mockResolvedValueOnce({
      data: [{ success: true, transaction_id: 'booking-1' }],
      error: null,
    });
  }

  it('creates and returns the booking', async () => {
    setupCreateMocks();
    const result = await bookingsService.createBooking({
      unitId: 'unit-1',
      moduleId: 'mod-1',
      customerName: 'John Doe',
      checkInDate: '2026-07-06',
      checkOutDate: '2026-07-09',
      numberOfGuests: 2,
    });
    expect(result.id).toBe('booking-1');
    expect(mockRpc).toHaveBeenCalledWith(
      'reserve_unit_exclusive_atomic',
      expect.objectContaining({ p_unit_id: 'unit-1', p_module_id: 'mod-1' })
    );
  });

  it('throws UNIT_NOT_FOUND when unit missing', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    await expect(
      bookingsService.createBooking({
        unitId: 'bad',
        moduleId: 'mod-1',
        customerName: 'X',
        checkInDate: '2026-07-06',
        checkOutDate: '2026-07-09',
        numberOfGuests: 1,
      })
    ).rejects.toMatchObject({ code: 'UNIT_NOT_FOUND' });
  });

  it('throws UNIT_UNAVAILABLE for inactive unit', async () => {
    mockSingle.mockResolvedValueOnce({ data: { ...baseUnit, is_active: false }, error: null });
    await expect(
      bookingsService.createBooking({
        unitId: 'unit-1',
        moduleId: 'mod-1',
        customerName: 'X',
        checkInDate: '2026-07-06',
        checkOutDate: '2026-07-09',
        numberOfGuests: 1,
      })
    ).rejects.toMatchObject({ code: 'UNIT_UNAVAILABLE' });
  });

  it('throws CAPACITY_EXCEEDED when guests exceed unit capacity', async () => {
    mockSingle.mockResolvedValueOnce({ data: { ...baseUnit, capacity: 2 }, error: null });
    await expect(
      bookingsService.createBooking({
        unitId: 'unit-1',
        moduleId: 'mod-1',
        customerName: 'X',
        checkInDate: '2026-07-06',
        checkOutDate: '2026-07-09',
        numberOfGuests: 5,
      })
    ).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
  });

  it('throws NOT_AVAILABLE when RPC reports overlap', async () => {
    setupCreateMocks();
    // Override — RPC reports no availability (called second time after setup's mock)
    mockRpc
      .mockReset()
      .mockResolvedValueOnce({
        data: [{ success: false, error_message: 'Unit already booked' }],
        error: null,
      });
    await expect(
      bookingsService.createBooking({
        unitId: 'unit-1',
        moduleId: 'mod-1',
        customerName: 'X',
        checkInDate: '2026-07-06',
        checkOutDate: '2026-07-09',
        numberOfGuests: 1,
      })
    ).rejects.toMatchObject({ code: 'NOT_AVAILABLE' });
  });
});

// ── getBookingById ────────────────────────────────────────────────────────────

describe('getBookingById', () => {
  it('returns booking when found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    const booking = await bookingsService.getBookingById('booking-1');
    expect(booking?.id).toBe('booking-1');
    expect(mockFrom).toHaveBeenCalledWith('transactions');
  });

  it('returns null when not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await bookingsService.getBookingById('ghost')).toBeNull();
  });

  it('throws GET_FAILED on DB error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    await expect(bookingsService.getBookingById('booking-1')).rejects.toMatchObject({
      code: 'GET_FAILED',
    });
  });
});

// ── getBookings ───────────────────────────────────────────────────────────────
//
// Service ends the chain with .order() — so order must resolve with { data, error }.

describe('getBookings', () => {
  it('returns bookings list', async () => {
    mockThen.mockResolvedValueOnce({ data: [baseBooking], error: null });
    const bookings = await bookingsService.getBookings({ moduleId: 'mod-1' });
    expect(bookings).toHaveLength(1);
    expect(bookings[0].id).toBe('booking-1');
  });

  it('returns empty array when none found', async () => {
    mockThen.mockResolvedValueOnce({ data: null, error: null });
    expect(await bookingsService.getBookings({})).toEqual([]);
  });
});

// ── cancelBooking ─────────────────────────────────────────────────────────────
//
// Service call sequence:
//   1. getBookingById → maybeSingle
//   2. engineService.transitionState
//   3. from('transactions').update({}).eq('id').select().single()
//      update() → chain, eq() → chain, select() → chain, single() → booking

describe('cancelBooking', () => {
  it('cancels a confirmed booking', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    mockTransitionState.mockResolvedValueOnce({ allowed: true, targetState: 'cancelled' });
    mockSingle.mockResolvedValueOnce({ data: { ...baseBooking, status: 'cancelled' }, error: null });

    const result = await bookingsService.cancelBooking('booking-1', 'Customer request');
    expect(result.status).toBe('cancelled');
  });

  it('throws BOOKING_NOT_FOUND when booking missing', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(bookingsService.cancelBooking('ghost', 'reason')).rejects.toMatchObject({
      code: 'BOOKING_NOT_FOUND',
    });
  });

  it('throws CANNOT_CANCEL when engine disallows transition', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    mockTransitionState.mockResolvedValueOnce({
      allowed: false,
      error: 'Cannot cancel a checked-out booking',
    });
    await expect(bookingsService.cancelBooking('booking-1', 'reason')).rejects.toMatchObject({
      code: 'CANNOT_CANCEL',
    });
  });
});

// ── checkIn ───────────────────────────────────────────────────────────────────

describe('checkIn', () => {
  it('transitions booking to checked_in', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    mockTransitionState.mockResolvedValueOnce({ allowed: true, targetState: 'checked_in' });
    mockSingle.mockResolvedValueOnce({ data: { ...baseBooking, status: 'checked_in' }, error: null });

    const result = await bookingsService.checkIn('booking-1', 'staff-1');
    expect(result.status).toBe('checked_in');
  });

  it('throws INVALID_STATUS when engine disallows', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    mockTransitionState.mockResolvedValueOnce({
      allowed: false,
      error: 'Cannot check in a cancelled booking',
    });
    await expect(bookingsService.checkIn('booking-1', 'staff-1')).rejects.toMatchObject({
      code: 'INVALID_STATUS',
    });
  });
});

// ── checkAvailability ─────────────────────────────────────────────────────────
//
// Service uses: .select('id', { count: 'exact', head: true })
//   then chains .eq().eq().filter().not().filter().filter()
//   The final .filter() resolves to { count, error }.
//
// Since every chain method returns `chain`, we resolve the LAST filter call.

describe('checkAvailability', () => {
  it('returns true when no overlapping bookings', async () => {
    mockThen.mockResolvedValueOnce({ count: 0, error: null });

    expect(
      await bookingsService.checkAvailability('unit-1', 'mod-1', '2026-08-01', '2026-08-05')
    ).toBe(true);
  });

  it('returns false when overlapping bookings exist', async () => {
    mockThen.mockResolvedValueOnce({ count: 2, error: null });

    expect(
      await bookingsService.checkAvailability('unit-1', 'mod-1', '2026-07-01', '2026-07-05')
    ).toBe(false);
  });

  it('throws AVAILABILITY_FAILED on DB error', async () => {
    mockThen.mockResolvedValueOnce({ count: null, error: { message: 'db error' } });

    await expect(
      bookingsService.checkAvailability('unit-1', 'mod-1', '2026-07-01', '2026-07-05')
    ).rejects.toMatchObject({ code: 'AVAILABILITY_FAILED' });
  });
});

// ── updateBooking ─────────────────────────────────────────────────────────────
//
// Service call sequence:
//   1. getBookingById → maybeSingle
//   2. from('transactions').update({}).eq('id').select().single()

describe('updateBooking', () => {
  it('updates allowed fields', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    mockSingle.mockResolvedValueOnce({
      data: { ...baseBooking, payment_status: 'paid' },
      error: null,
    });
    const result = await bookingsService.updateBooking('booking-1', { payment_status: 'paid' });
    expect(result.payment_status).toBe('paid');
  });

  it('throws INVALID_UPDATE when no allowlisted fields provided', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    await expect(
      bookingsService.updateBooking('booking-1', { status: 'checked_out' } as any)
    ).rejects.toMatchObject({ code: 'INVALID_UPDATE' });
  });
});
