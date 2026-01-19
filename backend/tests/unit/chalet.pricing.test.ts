
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
    
    const mockSupabase = {
        from: vi.fn((table) => {
            if (table === 'chalets') {
                return createChainableMock(mockChalet);
            }
            if (table === 'chalet_bookings') {
                // If checking availability (select), return empty array
                // If inserting, return new booking with calculated price
                const builder = createChainableMock([]);
                builder.insert = vi.fn().mockImplementation((data) => {
                    return createChainableMock({ ...data, id: 'new-booking' });
                });
                return builder;
            }
            if (table === 'chalet_price_rules') {
                return createChainableMock(priceRules);
            }
            if (table === 'chalet_add_ons') {
                return createChainableMock([]);
            }
            return createChainableMock([]);
        })
    };

    vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

    // Import Controller
    const { createBooking } = await import('../../src/modules/chalets/chalet.controller.js');
    const { req, res, next } = createMockReqRes({ body: bookingBody });

    await createBooking(req, res, next);

    // Assertions
    // Check what was inserted into 'chalet_bookings'
    const insertCall = mockSupabase.from('chalet_bookings').insert.mock.calls[0];
    // If availability check also called insert (unlikely), valid index is 0 if avail check uses select.
    
    // Actually, `createChainableMock` mockImplementation on insert is tricky if the builder is reused.
    // But `from` is called anew each time.
    // 4th call to `from` is the insert.
    // Let's inspect the `insert` arguments of the specific call.
    
    // Find the call to insert
    let insertData;
    const bookingsCalls = mockSupabase.from.mock.calls.filter(c => c[0] === 'chalet_bookings');
    // We expect at least one call that invokes .insert
    // But since we return a new mock builder each time, we need to inspect the builder returned by the INSERT call.
    // Wait, I defined `builder.insert` mock above.
    // If `from` is called multiple times, that definition is reused IF I return same object or redefine.
    // I returned a NEW builder each time in the factory function.
    // So I can't inspect "the" builder unless I capture it or inspect calls to the spy methods if I attached them.
    
    // Easier way: Spy on the insert method that was executed.
    // But I don't have access to the instance created inside the function.
    
    // Alternative: Assert `res.json` argument.
    // The controller returns `res.json({ success: true, data: booking })`.
    // The `booking` object comes from the `insert(...).select().single()` result.
    // The `insert` mock I preserved returns `{...data}`.
    // So `res.json` should contain the data passed to insert, including total_amount.
    
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
            // Expected Price:
            // 1 night (Jan 1).
            // Rules: Season ($150), Holiday ($200).
            // Logic should Sort Holiday (2 days) < Season (31 days).
            // So Holiday applies.
            // Expected Total: 200.
            total_amount: 200
        })
    }));
  });

});
