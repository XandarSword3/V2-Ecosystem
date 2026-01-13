import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../src/database/connection';
import { createChainableMock, mockRequest, mockResponse, mockNext } from './utils';

// Mock dependencies
vi.mock('../../src/database/connection');
vi.mock('../../src/config', () => ({
  config: {
    env: 'test',
    stripe: { secretKey: 'sk_test_123', webhookSecret: 'whsec_123' },
  },
}));
vi.mock('../../src/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Import after mocks
import {
  getPaymentMethods,
  getTransactions,
  getTransaction,
  refundPayment,
} from '../../src/modules/payments/payment.controller';

describe('Payment Controller', () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof mockResponse>;
  let next: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
  });

  describe('getPaymentMethods', () => {
    it('should return available payment methods', async () => {
      await getPaymentMethods(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'cash', name: 'Cash' }),
          expect.objectContaining({ id: 'card', name: 'Credit/Debit Card' }),
          expect.objectContaining({ id: 'whish', name: 'Whish Money Transfer' }),
          expect.objectContaining({ id: 'omt', name: 'OMT Money Transfer' }),
        ]),
      });
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        { id: 'tx-1', amount: '100.00', status: 'completed' },
        { id: 'tx-2', amount: '50.00', status: 'completed' },
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockTransactions)),
      } as any);

      req.query = { limit: '50', offset: '0' };

      await getTransactions(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTransactions,
      });
    });

    it('should return empty array when no transactions', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(null)),
      } as any);

      req.query = {};

      await getTransactions(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });
  });

  describe('getTransaction', () => {
    it('should return a single transaction by ID', async () => {
      const mockTransaction = {
        id: 'tx-123',
        amount: '75.00',
        status: 'completed',
        method: 'card',
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockTransaction)),
      } as any);

      req.params = { id: 'tx-123' };

      await getTransaction(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTransaction,
      });
    });

    it('should return 404 when transaction not found', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(null, { code: 'PGRST116', message: 'Not found' })
        ),
      } as any);

      req.params = { id: 'nonexistent' };

      await getTransaction(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Transaction not found',
      });
    });
  });

  describe('refundPayment', () => {
    it('should refund a cash payment successfully', async () => {
      const mockPayment = {
        id: 'payment-123',
        amount: '50.00',
        method: 'cash',
        status: 'completed',
        reference_type: 'restaurant_order',
        reference_id: 'order-123',
        notes: 'Original payment',
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn()
          .mockReturnValueOnce(createChainableMock(mockPayment))
          .mockReturnValueOnce(createChainableMock(null))
          .mockReturnValueOnce(createChainableMock(null)),
      } as any);

      req.params = { id: 'payment-123' };
      req.body = { reason: 'Customer request' };
      req.user = { userId: 'staff-123', role: 'staff' };

      await refundPayment(req as Request, res as Response, next as NextFunction);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Payment refunded successfully',
      });
    });

    it('should return 404 when payment not found for refund', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(
          createChainableMock(null, { code: 'PGRST116' })
        ),
      } as any);

      req.params = { id: 'nonexistent' };
      req.body = {};
      req.user = { userId: 'staff-123', role: 'staff' };

      await refundPayment(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Payment record not found',
      });
    });

    it('should return error when payment already refunded', async () => {
      const mockPayment = {
        id: 'payment-123',
        status: 'refunded',
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(createChainableMock(mockPayment)),
      } as any);

      req.params = { id: 'payment-123' };
      req.body = {};
      req.user = { userId: 'staff-123', role: 'staff' };

      await refundPayment(req as Request, res as Response, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Payment is already refunded',
      });
    });
  });
});
