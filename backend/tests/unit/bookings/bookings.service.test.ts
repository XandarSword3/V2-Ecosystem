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
const mockChain: Record<string, ReturnType<typeof vi.fn>> = {
  from: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  not: vi.fn(),
  filter: vi.fn(),
  order: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
};
const resetChain = () => Object.keys(mockChain).forEach((k) => mockChain[k].mockReturnValue(mockChain));

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => mockChain),
}));

import * as bookingsService from '../../../src/modules/bookings/bookings.service.js';

// ─────────────────────────────────────────────────────────────────────────────

const baseUnit = {
  id: 'unit-1',
  module_id: 'mod-1',
  name: 'Chalet A',
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

describe('calculateReservationPrice', () => {
  it('computes base amount from nightly rate x nights', async () => {
    mockChain.single
      .mockResolvedValueOnce({ data: baseUnit, error: null })
      .mockResolvedValueOnce({ data: { config: {} }, error: null });
    mockChain.eq.mockResolvedValueOnce({ data: [], error: null });

    // 3 weekdays Mon-Wed at $100 = $300
    const result = await bookingsService.calculateReservationPrice(
      'unit-1', 'mod-1', '2026-07-06', '2026-07-09'
    );

    expect(result.numberOfNights).toBe(3);
    expect(result.baseAmount).toBe(300);
    expect(result.totalAmount).toBe(300);
    expect(result.addOnsAmount).toBe(0);
  });

  it('throws UNIT_NOT_FOUND when unit missing', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    await expect(
      bookingsService.calculateReservationPrice('bad-unit', 'mod-1', '2026-07-01', '2026-07-04')
    ).rejects.toMatchObject({ code: 'UNIT_NOT_FOUND' });
  });

  it('throws INVALID_DATE_RANGE when checkout before checkin', async () => {
    mockChain.single.mockResolvedValueOnce({ data: baseUnit, error: null });
    mockChain.eq.mockResolvedValueOnce({ data: [], error: null });
    await expect(
      bookingsService.calculateReservationPrice('unit-1', 'mod-1', '2026-07-04', '2026-07-01')
    ).rejects.toMatchObject({ code: 'INVALID_DATE_RANGE' });
  });
});

// ── createBooking ─────────────────────────────────────────────────────────────

describe('createBooking', () => {
  function setupCreateMocks(unitOverride = {}) {
    const unit = { ...baseUnit, ...unitOverride };
    mockChain.single
      .mockResolvedValueOnce({ data: unit, error: null })
      .mockResolvedValueOnce({ data: unit, error: null })
      .mockResolvedValueOnce({ data: { config: {} }, error: null })
      .mockResolvedValueOnce({ data: baseBooking, error: null });
    mockChain.eq.mockResolvedValueOnce({ data: [], error: null });
    mockChain.rpc.mockResolvedValueOnce({
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
    expect(mockChain.rpc).toHaveBeenCalledWith(
      'reserve_unit_exclusive_atomic',
      expect.objectContaining({ p_unit_id: 'unit-1', p_module_id: 'mod-1' })
    );
  });

  it('throws UNIT_NOT_FOUND when unit missing', async () => {
    mockChain.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
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
    mockChain.single.mockResolvedValueOnce({ data: { ...baseUnit, is_active: false }, error: null });
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
    mockChain.single.mockResolvedValueOnce({ data: { ...baseUnit, capacity: 2 }, error: null });
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
    mockChain.rpc.mockResolvedValueOnce({
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
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    const booking = await bookingsService.getBookingById('booking-1');
    expect(booking?.id).toBe('booking-1');
    expect(mockChain.from).toHaveBeenCalledWith('transactions');
  });

  it('returns null when not found', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await bookingsService.getBookingById('ghost')).toBeNull();
  });

  it('throws GET_FAILED on DB error', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    await expect(bookingsService.getBookingById('booking-1')).rejects.toMatchObject({
      code: 'GET_FAILED',
    });
  });
});

// ── getBookings ───────────────────────────────────────────────────────────────

describe('getBookings', () => {
  it('returns bookings list', async () => {
    mockChain.order.mockResolvedValueOnce({ data: [baseBooking], error: null });
    const bookings = await bookingsService.getBookings({ moduleId: 'mod-1' });
    expect(bookings).toHaveLength(1);
    expect(bookings[0].id).toBe('booking-1');
  });

  it('returns empty array when none found', async () => {
    mockChain.order.mockResolvedValueOnce({ data: null, error: null });
    expect(await bookingsService.getBookings({})).toEqual([]);
  });
});

// ── cancelBooking ─────────────────────────────────────────────────────────────

describe('cancelBooking', () => {
  it('cancels a confirmed booking', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    mockTransitionState.mockResolvedValueOnce({ allowed: true, targetState: 'cancelled' });
    mockChain.single.mockResolvedValueOnce({
      data: { ...baseBooking, status: 'cancelled' },
      error: null,
    });

    const result = await bookingsService.cancelBooking('booking-1', 'Customer request');
    expect(result.status).toBe('cancelled');
  });

  it('throws BOOKING_NOT_FOUND when booking missing', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(bookingsService.cancelBooking('ghost', 'reason')).rejects.toMatchObject({
      code: 'BOOKING_NOT_FOUND',
    });
  });

  it('throws CANNOT_CANCEL when engine disallows transition', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
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
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    mockTransitionState.mockResolvedValueOnce({ allowed: true, targetState: 'checked_in' });
    mockChain.single.mockResolvedValueOnce({
      data: { ...baseBooking, status: 'checked_in' },
      error: null,
    });

    const result = await bookingsService.checkIn('booking-1', 'staff-1');
    expect(result.status).toBe('checked_in');
  });

  it('throws INVALID_STATUS when engine disallows', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
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

describe('checkAvailability', () => {
  it('returns true when no overlapping bookings', async () => {
    mockChain.filter.mockResolvedValueOnce({ count: 0, error: null });
    expect(
      await bookingsService.checkAvailability('unit-1', 'mod-1', '2026-08-01', '2026-08-05')
    ).toBe(true);
  });

  it('returns false when overlapping bookings exist', async () => {
    mockChain.filter.mockResolvedValueOnce({ count: 2, error: null });
    expect(
      await bookingsService.checkAvailability('unit-1', 'mod-1', '2026-07-01', '2026-07-05')
    ).toBe(false);
  });

  it('throws AVAILABILITY_FAILED on DB error', async () => {
    mockChain.filter.mockResolvedValueOnce({ count: null, error: { message: 'db error' } });
    await expect(
      bookingsService.checkAvailability('unit-1', 'mod-1', '2026-07-01', '2026-07-05')
    ).rejects.toMatchObject({ code: 'AVAILABILITY_FAILED' });
  });
});

// ── updateBooking ─────────────────────────────────────────────────────────────

describe('updateBooking', () => {
  it('updates allowed fields', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    mockChain.single.mockResolvedValueOnce({
      data: { ...baseBooking, payment_status: 'paid' },
      error: null,
    });
    const result = await bookingsService.updateBooking('booking-1', { payment_status: 'paid' });
    expect(result.payment_status).toBe('paid');
  });

  it('throws INVALID_UPDATE when no allowlisted fields provided', async () => {
    mockChain.maybeSingle.mockResolvedValueOnce({ data: baseBooking, error: null });
    await expect(
      // @ts-expect-error testing disallowed status bypass
      bookingsService.updateBooking('booking-1', { status: 'checked_out' })
    ).rejects.toMatchObject({ code: 'INVALID_UPDATE' });
  });
});
