import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChainableMock } from '../../utils';
import { awardLoyaltyPointsForPayment } from '../../../../src/modules/payments/loyalty-integration';

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from '../../../../src/database/connection';

describe('Loyalty Integration & Idempotency (awardLoyaltyPointsForPayment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call earn_loyalty_points_atomic with order details, tenant_id, and property_id', async () => {
    const orderId = '00000000-0000-0000-0000-000000000001';
    const customerId = '00000000-0000-0000-0000-000000000002';
    const tenantId = '00000000-0000-0000-0000-000000000003';
    const propertyId = '00000000-0000-0000-0000-000000000004';

    const rpcMock = vi.fn().mockResolvedValue({
      data: [{ success: true, points_earned: 50, new_balance: 150 }],
      error: null,
    });

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'loyalty_settings') {
        return createChainableMock({ is_enabled: true, points_per_dollar: 1 });
      }
      if (table === 'loyalty_transactions') {
        // No existing earn transaction
        const mock = createChainableMock(null);
        mock.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        return mock;
      }
      if (table === 'transactions') {
        return createChainableMock({
          id: orderId,
          customer_id: customerId,
          amount: 50,
          tenant_id: tenantId,
          property_id: propertyId,
        });
      }
      return createChainableMock(null);
    });

    vi.mocked(getSupabase).mockReturnValue({
      from: fromMock,
      rpc: rpcMock,
    } as any);

    await awardLoyaltyPointsForPayment('order', orderId, 50);

    expect(rpcMock).toHaveBeenCalledWith('earn_loyalty_points_atomic', {
      p_user_id: customerId,
      p_order_total: 50,
      p_order_id: orderId,
      p_points_per_dollar: 1,
      p_tenant_id: tenantId,
      p_property_id: propertyId,
    });
  });

  it('should skip duplicate points award when transaction already has earn record (idempotency)', async () => {
    const orderId = '00000000-0000-0000-0000-000000000001';
    const rpcMock = vi.fn();

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'loyalty_settings') {
        return createChainableMock({ is_enabled: true, points_per_dollar: 1 });
      }
      if (table === 'loyalty_transactions') {
        // Existing earn transaction found
        const mock = createChainableMock({ id: 'existing-tx-id', reference_id: orderId });
        mock.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 'existing-tx-id', reference_id: orderId },
          error: null,
        });
        return mock;
      }
      return createChainableMock(null);
    });

    vi.mocked(getSupabase).mockReturnValue({
      from: fromMock,
      rpc: rpcMock,
    } as any);

    await awardLoyaltyPointsForPayment('order', orderId, 50);

    // RPC must NOT be called because idempotency guard intercepted it
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
