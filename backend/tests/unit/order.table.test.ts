
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSupabase } from '../../src/database/connection.js';
import { createChainableMock, createMockReqRes } from './utils.js';

// Mock dependencies
vi.mock('../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../src/services/email.service.js', () => ({
  emailService: {
    sendOrderConfirmation: vi.fn().mockResolvedValue(true),
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


describe('Order Service - Table Resolution', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve tableNumber to tableId during creation', async () => {
    const tableNumber = 'T99';
    const tableId = 'table-uuid-99';
    const moduleId = 'mod-1';

    // Mock Data
    const mockTable = { id: tableId, table_number: tableNumber, is_active: true };
    const mockMenuItem = { 
        id: 'item-1', 
        name: 'Burger', 
        price: '10.00', 
        module_id: moduleId,
        is_available: true 
    };

    // DB Mock
    const mockSupabase = {
        from: vi.fn((table) => {
            if (table === 'restaurant_tables') {
                // Return table when queried by number
                return createChainableMock(mockTable);
            }
            if (table === 'menu_items') {
                return createChainableMock([mockMenuItem]);
            }
            if (table === 'restaurant_orders') {
                // Return inserted order
                const builder = createChainableMock([]);
                builder.insert = vi.fn().mockImplementation((data) => {
                    return createChainableMock({ ...data, id: 'order-1' });
                });
                return builder;
            }
            if (table === 'restaurant_order_items') {
                return createChainableMock([]);
            }
             if (table === 'modules') {
                return createChainableMock({ id: moduleId });
            }
            return createChainableMock([]);
        }),
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }) // mock discounts
    };

    vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

    // Import Service
    const orderService = await import('../../src/modules/restaurant/services/order.service.js');

    // Create Order
    await orderService.createOrder({
        customerName: 'Test Guest',
        orderType: 'dine_in',
        tableNumber: tableNumber,
        items: [{ menuItemId: 'item-1', quantity: 1 }]
    });

    // Assertions
    // 1. Should query tables
    const tableQuery = mockSupabase.from('restaurant_tables'); // .select().eq...
    // Verify arguments of chain? hard with chainable mock helper.
    // Verify insert args.
    
    // Find insert call for orders
    const insertCall = mockSupabase.from('restaurant_orders').insert.mock.calls[0];
    // This assumes insert was called ONCE on 'restaurant_orders' mock.
    // The spy is on `from`.
    // The builder returned has `insert` spy.
    // Since we create NEW builder each time in factory, we need to spy on the builder factory logic or iterate calls.
    // But in my factory above: `builder.insert = vi.fn()...`
    // I can't access `builder` variable from here easily.
    
    // Better strategy for test:
    // define the insert spy OUTSIDE
    const insertOrderSpy = vi.fn().mockReturnValue(createChainableMock({ id: 'order-1' }));
    
    const refinedMock = {
        from: vi.fn((table) => {
             if (table === 'restaurant_tables') return createChainableMock(mockTable);
             if (table === 'menu_items') return createChainableMock([mockMenuItem]);
             if (table === 'restaurant_orders') {
                 const b = createChainableMock([]);
                 b.insert = insertOrderSpy;
                 return b;
             }
             if (table === 'restaurant_order_items') return createChainableMock([]);
             return createChainableMock([]);
        }),
        rpc: vi.fn().mockResolvedValue({ data: [], error: null })
    };
    vi.mocked(getSupabase).mockReturnValue(refinedMock as any);
    
    // Retry import/call (module cache might be issue with vitest? No, dynamic import usually clean or vitest handles it)
    await orderService.createOrder({
        customerName: 'Test Guest',
        orderType: 'dine_in',
        tableNumber: tableNumber,
        items: [{ menuItemId: 'item-1', quantity: 1 }]
    });

    // The service resolves tableNumber to table_id - it does NOT store table_number in the order
    // This confirms the table resolution worked correctly
    expect(insertOrderSpy).toHaveBeenCalledWith(expect.objectContaining({
        table_id: tableId,      // This confirms resolution worked!
    }));

  });

});
