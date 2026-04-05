
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSupabase } from '../../src/database/connection.js';
import { createChainableMock, createMockReqRes } from './utils.js';
import dayjs from 'dayjs';

// Mock dependencies
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendBookingConfirmation: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

vi.mock('../../src/socket/index.js', () => ({
    emitToUnit: vi.fn(),
}));

describe('Chalet Pricing Logic', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prioritize shorter duration rules (Holidays) over longer ones (Seasons)', async () => {
    const chaletId = '00000000-0000-0000-0000-000000000001';
    // 1. Setup Data
    const mockChalet = { 
        id: chaletId, 
        name: 'Test Chalet', 
        base_price: 100, 
        weekend_price: 120 
    };

    // Rule 1: Season (Long) - $150
    const seasonRule = {
        id: 'r-season',
        chalet_id: chaletId,
        name: 'Winter Season',
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        price: '150.00',
        priority: 1,
        is_active: true
    };

    // Rule 2: Holiday (Short) - $200
    // Starts same day as season!
    const holidayRule = {
        id: 'r-holiday',
        chalet_id: chaletId,
        name: 'New Year',
        start_date: '2026-01-01',
        end_date: '2026-01-02', 
        price: '200.00',
        priority: 1, // Same priority, should win by duration
        is_active: true
    };

    const priceRules = [seasonRule, holidayRule]; // Unsorted, or sorted by DB default

    // Booking: Jan 1 to Jan 2 (1 Night)
    const bookingBody = {
        chaletId: chaletId,
        customerName: 'Test Guest',
        customerEmail: 'test@example.com',
        customerPhone: '12345678', // Fixed: Valid length
        checkInDate: '2026-01-01',
        checkOutDate: '2026-01-02',
        numberOfGuests: 2,
        paymentMethod: 'cash'
    };

    // Mock DB Responses
    // 1. Get Chalet -> mockChalet
    // 2. Check Availability -> [] (no overlap)
    // 3. Get Price Rules -> priceRules
    // 4. Create Booking -> success
    // 5. Create Booking Addons -> []
    
    // We need to carefully mock the sequence of `from` calls or use filter matching.
    // The controller calls:
    // 1. from('chalets')...eq('id', chaletId).single()
    // 2. from('chalet_bookings')...eq('chalet_id')... (availability)
    // 3. from('chalet_price_rules')...eq('chalet_id')
    // 4. from('chalet_bookings').insert(...)
    
    // ChainableMock helper usually returns same obj if not configured specific.
    // We'll create a smart mock for `from`.
    
    // Track calls to chalet_bookings to differentiate availability check vs post-RPC fetch
    let bookingsCallCount = 0;
    const mockSupabase = {
        from: vi.fn((table) => {
            if (table === 'chalets') {
                return createChainableMock(mockChalet);
            }
            if (table === 'chalet_bookings') {
                bookingsCallCount++;
                if (bookingsCallCount === 1) {
                    // Availability check — no overlapping bookings
                    return createChainableMock([]);
                }
                // Post-RPC: fetch the created booking (controller re-reads it after atomic insert)
                return createChainableMock({
                    id: 'new-booking',
                    booking_number: 'C-260101-001',
                    chalet_id: chaletId,
                    total_amount: 200,
                    base_amount: 200,
                    add_ons_amount: 0,
                    check_in_date: '2026-01-01',
                    check_out_date: '2026-01-02',
                    status: 'pending',
                    payment_status: 'pending',
                    payment_method: 'cash',
                });
            }
            if (table === 'chalet_price_rules') {
                return createChainableMock(priceRules);
            }
            if (table === 'chalet_add_ons') {
                return createChainableMock([]);
            }
            return createChainableMock(null);
        }),
        // createBooking now uses supabase.rpc('create_chalet_booking_with_addons')
        rpc: vi.fn().mockResolvedValue({
            data: { booking_id: 'new-booking' },
            error: null,
        }),
    };

    vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

    // Import Controller
    const { createBooking } = await import('../../src/modules/chalets/chalet.controller.js');
    const { req, res, next } = createMockReqRes({ body: bookingBody });

    await createBooking(req, res, next);

    // Assertions
    // Verify the RPC was called with the correct total_amount (pricing logic result)
    // Expected Price: 1 night (Jan 1).
    // Rules: Season ($150, 31 days), Holiday ($200, 2 days).
    // Sorting: Holiday (shorter duration) wins over Season.
    // So Holiday price applies → total = 200.
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'create_chalet_booking_with_addons',
        expect.objectContaining({
            p_booking: expect.objectContaining({
                total_amount: 200,
            }),
        })
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
            total_amount: 200
        })
    }));
  });

});
