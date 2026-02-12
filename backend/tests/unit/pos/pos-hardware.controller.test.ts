import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../utils';

describe('POS Hardware Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTerminalPaymentIntent', () => {
    it('should return 400 for invalid amount', async () => {
      // Dynamically import to avoid Stripe initialization issues
      const posHardwareController = await import('../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: { amount: 0, currency: 'usd' }
      });

      await posHardwareController.createTerminalPaymentIntent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid amount' });
    });

    it('should return 400 for negative amount', async () => {
      const posHardwareController = await import('../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: { amount: -100, currency: 'usd' }
      });

      await posHardwareController.createTerminalPaymentIntent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid amount' });
    });

    it('should return 400 for missing amount', async () => {
      const posHardwareController = await import('../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: { currency: 'usd' }
      });

      await posHardwareController.createTerminalPaymentIntent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid amount' });
    });
  });

  describe('captureTerminalPayment', () => {
    it('should return 400 for missing payment intent ID', async () => {
      const posHardwareController = await import('../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: {}
      });

      await posHardwareController.captureTerminalPayment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Payment intent ID required' });
    });
  });

  describe('cancelTerminalPayment', () => {
    it('should return 400 for missing payment intent ID', async () => {
      const posHardwareController = await import('../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: {}
      });

      await posHardwareController.cancelTerminalPayment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Payment intent ID required' });
    });
  });
});
