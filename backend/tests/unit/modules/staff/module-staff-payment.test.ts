import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes, createChainableMock } from '../../utils';

// Mock getSupabase
vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(),
}));

// Mock socket
vi.mock('../../../../src/socket/index', () => ({
  emitToUnit: vi.fn(),
}));

// Mock loyalty-integration
vi.mock('../../../../src/modules/payments/loyalty-integration', () => ({
  awardLoyaltyPointsForPayment: vi.fn().mockResolvedValue(undefined),
}));

import { getSupabase } from '../../../../src/database/connection';
import { emitToUnit } from '../../../../src/socket/index';
import { awardLoyaltyPointsForPayment } from '../../../../src/modules/payments/loyalty-integration';
import { payModuleOrder } from '../../../../src/modules/staff/module-staff.controller';

describe('Staff Module Order Payment (payModuleOrder)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully process cash payment, update order to completed, and award loyalty points', async () => {
    const moduleId = '11111111-1111-1111-1111-111111111111';
    const orderId = '22222222-2222-2222-2222-222222222222';
    const staffId = '33333333-3333-3333-3333-333333333333';

    const { req, res } = createMockReqRes({
      params: { slug: 'restaurant', orderId },
      body: {
        paymentMethod: 'cash',
        amountPaid: 50,
        tipAmount: 5,
      },
      user: {
        userId: staffId,
        tenantId: 'tenant-123',
        roles: ['staff'],
      },
    });

    const mockOrder = {
      id: orderId,
      amount: 40,
      status: 'delivered',
      metadata: { tableNumber: 'T5' },
    };

    const mockUpdatedOrder = {
      id: orderId,
      amount: 40,
      status: 'completed',
      metadata: {
        tableNumber: 'T5',
        payment_status: 'paid',
        payment_method: 'cash',
        amount_paid: 50,
        tip_amount: 5,
        change_amount: 5,
        paid_by_staff_id: staffId,
      },
    };

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'modules') {
        return createChainableMock({ id: moduleId, engine_type: 'instant_transaction' });
      }
      if (table === 'transactions') {
        // Return mockOrder for query, mockUpdatedOrder for update
        const chain = createChainableMock(mockOrder);
        chain.update = vi.fn().mockReturnValue(createChainableMock(mockUpdatedOrder));
        return chain;
      }
      return createChainableMock(null);
    });

    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    await payModuleOrder(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: orderId,
          status: 'completed',
          paymentStatus: 'paid',
          paymentMethod: 'cash',
          amountPaid: 50,
          tipAmount: 5,
          changeAmount: 5,
        }),
      })
    );

    // Assert loyalty points were awarded
    expect(awardLoyaltyPointsForPayment).toHaveBeenCalledWith('order', orderId, 50);

    // Assert socket broadcast
    expect(emitToUnit).toHaveBeenCalledWith('tenant-123', 'restaurant', 'order:updated', {
      orderId,
      status: 'completed',
      paymentStatus: 'paid',
    });
  });

  it('should return 400 for non-instant_transaction module', async () => {
    const { req, res } = createMockReqRes({
      params: { slug: 'chalets', orderId: 'order-1' },
      body: { paymentMethod: 'cash' },
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'modules') {
        return createChainableMock({ id: 'mod-1', engine_type: 'time_exclusive_reservation' });
      }
      return createChainableMock(null);
    });

    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    await payModuleOrder(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Invalid module for order operations',
      })
    );
    expect(awardLoyaltyPointsForPayment).not.toHaveBeenCalled();
  });

  it('should return 400 if order is cancelled', async () => {
    const { req, res } = createMockReqRes({
      params: { slug: 'restaurant', orderId: 'order-1' },
      body: { paymentMethod: 'cash' },
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'modules') {
        return createChainableMock({ id: 'mod-1', engine_type: 'instant_transaction' });
      }
      if (table === 'transactions') {
        return createChainableMock({ id: 'order-1', amount: 20, status: 'cancelled' });
      }
      return createChainableMock(null);
    });

    vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

    await payModuleOrder(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Cannot pay for a cancelled order',
      })
    );
  });
});
