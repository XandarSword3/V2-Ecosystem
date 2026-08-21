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

// The payment path now routes completion through the capability-gated
// choke point instead of writing transactions.status directly — mock that
// boundary so the controller's orchestration is what's under test.
vi.mock('../../../../src/engines/order-status.service', () => ({
  changeInstantTransactionOrderStatus: vi.fn(),
  actorForUser: vi.fn(() => 'staff'),
}));

// Canonical fulfillment state read (display status when completion is
// deferred).
vi.mock('../../../../src/modules/fulfillment/index', () => ({
  getFulfillmentService: vi.fn(),
}));

import { getSupabase } from '../../../../src/database/connection';
import { emitToUnit } from '../../../../src/socket/index';
import { awardLoyaltyPointsForPayment } from '../../../../src/modules/payments/loyalty-integration';
import {
  changeInstantTransactionOrderStatus,
  actorForUser,
} from '../../../../src/engines/order-status.service';
import { getFulfillmentService } from '../../../../src/modules/fulfillment/index';
import { payModuleOrder } from '../../../../src/modules/staff/module-staff.controller';

const moduleId = '11111111-1111-1111-1111-111111111111';
const orderId = '22222222-2222-2222-2222-222222222222';
const staffId = '33333333-3333-3333-3333-333333333333';

function baseReqRes(orderStatus: string) {
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
  const mockOrder = { id: orderId, amount: 40, status: orderStatus, metadata: { tableNumber: 'T5' } };
  const mockUpdatedOrder = {
    id: orderId,
    amount: 40,
    status: orderStatus,
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

  let txChainRef: any;
  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'modules') {
      return createChainableMock({ id: moduleId, engine_type: 'instant_transaction' });
    }
    if (table === 'transactions') {
      const chain = createChainableMock(mockOrder);
      chain.update = vi.fn().mockReturnValue(createChainableMock(mockUpdatedOrder));
      txChainRef = chain;
      return chain;
    }
    return createChainableMock(null);
  });
  vi.mocked(getSupabase).mockReturnValue({ from: fromMock } as any);

  return {
    req,
    res,
    fromMock,
    mockUpdatedOrder,
    // Resolved lazily — the chain is created when the controller calls
    // from('transactions'), which happens during payModuleOrder.
    getTxUpdate: () => txChainRef?.update as ReturnType<typeof vi.fn> | undefined,
  };
}

describe('Staff Module Order Payment (payModuleOrder)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('settles payment and completes through the gate when the order is handed off', async () => {
    // Canonical: transactions.status stays 'confirmed' during fulfillment;
    // the fulfillment row is the authority and is at handed_off.
    const { req, res, getTxUpdate } = baseReqRes('confirmed');
    vi.mocked(getFulfillmentService).mockReturnValue({
      getForTransaction: vi.fn().mockResolvedValue({ status: 'handed_off', mode: 'pickup' }),
    } as any);
    vi.mocked(changeInstantTransactionOrderStatus).mockResolvedValue({
      ok: true,
      status: 200,
      order: { id: orderId, status: 'completed' },
    } as any);

    await payModuleOrder(req as any, res as any);

    // The settlement write carries NO status — completion is the state
    // machine's job, never payment's.
    const txUpdate = getTxUpdate();
    expect(txUpdate).toBeDefined();
    const updateArg = txUpdate?.mock?.calls?.[0]?.[0];
    expect(updateArg).toBeDefined();
    expect(updateArg).not.toHaveProperty('status');
    expect(updateArg.metadata.payment_status).toBe('paid');

    // Completion went through the capability-gated choke point.
    expect(changeInstantTransactionOrderStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId,
        moduleId,
        moduleSlug: 'restaurant',
        requestedStatus: 'completed',
        actor: 'staff',
      })
    );
    expect(actorForUser).toHaveBeenCalled();

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: orderId,
          status: 'completed',
          completionStatus: 'completed',
          paymentStatus: 'paid',
          amountPaid: 50,
          tipAmount: 5,
          changeAmount: 5,
        }),
      })
    );

    expect(awardLoyaltyPointsForPayment).toHaveBeenCalledWith('order', orderId, 50);

    expect(emitToUnit).toHaveBeenCalledWith('tenant-123', 'restaurant', 'order:updated', {
      orderId,
      status: 'completed',
      paymentStatus: 'paid',
    });
  });

  it('settles payment but defers completion when the fulfillment gate refuses (still preparing)', async () => {
    const { req, res } = baseReqRes('confirmed');
    vi.mocked(getFulfillmentService).mockReturnValue({
      getForTransaction: vi.fn().mockResolvedValue({ status: 'in_progress', mode: 'pickup' }),
    } as any);
    vi.mocked(changeInstantTransactionOrderStatus).mockResolvedValue({
      ok: false,
      status: 400,
      error: 'Cannot transition order from in_progress to completed',
    } as any);

    await payModuleOrder(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          status: 'in_progress',
          completionStatus: 'pending_fulfillment_handoff',
          paymentStatus: 'paid',
        }),
      })
    );
    // Settlement happened even though completion was refused.
    expect(awardLoyaltyPointsForPayment).toHaveBeenCalledWith('order', orderId, 50);
    expect(emitToUnit).toHaveBeenCalledWith('tenant-123', 'restaurant', 'order:updated', {
      orderId,
      status: 'in_progress',
      paymentStatus: 'paid',
    });
  });

  it('never fails an already-settled payment on a fail-closed completion error (500)', async () => {
    const { req, res } = baseReqRes('confirmed');
    vi.mocked(getFulfillmentService).mockReturnValue({
      getForTransaction: vi.fn().mockResolvedValue({ status: 'ready', mode: 'pickup' }),
    } as any);
    vi.mocked(changeInstantTransactionOrderStatus).mockResolvedValue({
      ok: false,
      status: 500,
      error: 'Fulfillment read failed',
    } as any);

    await payModuleOrder(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          status: 'ready',
          completionStatus: 'pending_fulfillment_handoff',
          paymentStatus: 'paid',
        }),
      })
    );
    expect(awardLoyaltyPointsForPayment).toHaveBeenCalledWith('order', orderId, 50);
  });

  it('does not attempt completion for an already-completed order', async () => {
    const { req, res } = baseReqRes('completed');

    await payModuleOrder(req as any, res as any);

    expect(changeInstantTransactionOrderStatus).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ status: 'completed', paymentStatus: 'paid' }),
      })
    );
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
