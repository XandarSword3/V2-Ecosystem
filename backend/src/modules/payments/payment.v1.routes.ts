/**
 * API v1 Payment Routes
 * 
 * Platform-aware payment endpoints for mobile apps.
 * Supports Apple Pay, Google Pay, and card payments.
 * 
 * @module routes/v1/payments
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StripePlatformService, getStripePlatformService, PaymentPlatform } from '../../services/stripe-platform.service.js';
import { authenticate as requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { logger } from '../../utils/logger.js';
import { userRateLimit as rateLimiter } from '../../middleware/userRateLimit.middleware.js';

const router = Router();

// Validation schemas
const createPaymentIntentSchema = z.object({
  amount: z.number().min(50, 'Amount must be at least 50 cents'),
  currency: z.string().length(3).optional().default('EUR'),
  referenceType: z.enum(['order', 'booking', 'pool_ticket', 'snack_order']),
  referenceId: z.string().uuid('Invalid reference ID'),
  description: z.string().max(500).optional(),
  receiptEmail: z.string().email().optional(),
});

const refundSchema = z.object({
  paymentIntentId: z.string().startsWith('pi_'),
  amount: z.number().min(1).optional(),
  reason: z.enum(['requested_by_customer', 'duplicate', 'fraudulent']).optional(),
});

// Extract platform from headers
function getPlatformFromRequest(req: Request): PaymentPlatform {
  const platform = req.headers['x-platform'] as string;
  if (platform === 'ios' || platform === 'android') {
    return platform;
  }
  return 'web';
}

// Extract app version from headers
function getAppVersion(req: Request): string | undefined {
  return req.headers['x-app-version'] as string | undefined;
}

// Extract device ID from headers
function getDeviceId(req: Request): string | undefined {
  return req.headers['x-device-id'] as string | undefined;
}

/**
 * @route GET /api/v1/payments/config
 * @desc Get Stripe configuration for mobile SDK
 * @access Public (but rate limited)
 */
router.get('/config', rateLimiter({ maxRequests: 10, windowMs: 60000 }), (req: Request, res: Response) => {
  try {
    const platform = getPlatformFromRequest(req);
    const service = getStripePlatformService();
    const config = service.getMobileConfig(platform);

    res.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    logger.error('Failed to get Stripe config', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get payment configuration',
      code: 'PAYMENT_CONFIG_ERROR',
    });
  }
});

/**
 * @route POST /api/v1/payments/intents
 * @desc Create a PaymentIntent for mobile/web checkout
 * @access Authenticated users
 */
router.post(
  '/intents',
  requireAuth,
  rateLimiter({ maxRequests: 20, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    try {
      const validation = createPaymentIntentSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        });
      }

      const { amount, currency, referenceType, referenceId, description, receiptEmail } = validation.data;
      const platform = getPlatformFromRequest(req);
      const appVersion = getAppVersion(req);
      const deviceId = getDeviceId(req);

      const service = getStripePlatformService();
      const result = await service.createPaymentIntent({
        amount,
        currency,
        platform,
        userId: req.user!.userId,
        referenceType,
        referenceId,
        description,
        receiptEmail: receiptEmail || req.user!.email,
        appVersion,
        deviceId,
      });

      logger.info('PaymentIntent created via API', {
        paymentIntentId: result.paymentIntentId,
        userId: req.user!.userId,
        platform,
        amount,
        referenceType,
        referenceId,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to create PaymentIntent', {
        error: error.message,
        userId: req.user?.userId,
        body: req.body,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create payment',
        code: 'PAYMENT_INTENT_ERROR',
        message: error.message,
      });
    }
  }
);

/**
 * @route GET /api/v1/payments/intents/:id
 * @desc Get PaymentIntent status
 * @access Authenticated users
 */
router.get(
  '/intents/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id.startsWith('pi_')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid PaymentIntent ID',
          code: 'VALIDATION_ERROR',
        });
      }

      const service = getStripePlatformService();
      const paymentIntent = await service.getPaymentIntent(id);

      // Check ownership via metadata
      if (paymentIntent.metadata.userId !== req.user!.userId) {
        // Check if user has admin permission
        const isAdmin = req.user!.roles?.some(r => 
          ['super_admin', 'manager', 'restaurant_admin'].includes(r)
        );

        if (!isAdmin) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            code: 'AUTH_FORBIDDEN',
          });
        }
      }

      res.json({
        success: true,
        data: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          metadata: paymentIntent.metadata,
          created: paymentIntent.created,
          paymentMethod: paymentIntent.payment_method,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get PaymentIntent', {
        error: error.message,
        paymentIntentId: req.params.id,
      });

      res.status(404).json({
        success: false,
        error: 'PaymentIntent not found',
        code: 'PAYMENT_NOT_FOUND',
      });
    }
  }
);

/**
 * @route POST /api/v1/payments/intents/:id/cancel
 * @desc Cancel a PaymentIntent
 * @access Authenticated users (owner or admin)
 */
router.post(
  '/intents/:id/cancel',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id.startsWith('pi_')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid PaymentIntent ID',
          code: 'VALIDATION_ERROR',
        });
      }

      const service = getStripePlatformService();
      const paymentIntent = await service.getPaymentIntent(id);

      // Check ownership
      if (paymentIntent.metadata.userId !== req.user!.userId) {
        const isAdmin = req.user!.roles?.some(r => 
          ['super_admin', 'manager'].includes(r)
        );

        if (!isAdmin) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            code: 'AUTH_FORBIDDEN',
          });
        }
      }

      // Can only cancel certain statuses
      if (!['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(paymentIntent.status)) {
        return res.status(400).json({
          success: false,
          error: `Cannot cancel payment with status: ${paymentIntent.status}`,
          code: 'PAYMENT_CANCEL_ERROR',
        });
      }

      const cancelled = await service.cancelPaymentIntent(id);

      logger.info('PaymentIntent cancelled', {
        paymentIntentId: id,
        userId: req.user!.userId,
      });

      res.json({
        success: true,
        data: {
          id: cancelled.id,
          status: cancelled.status,
        },
      });
    } catch (error: any) {
      logger.error('Failed to cancel PaymentIntent', {
        error: error.message,
        paymentIntentId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to cancel payment',
        code: 'PAYMENT_CANCEL_ERROR',
      });
    }
  }
);

/**
 * @route POST /api/v1/payments/refunds
 * @desc Create a refund (admin only)
 * @access Admin users
 */
router.post(
  '/refunds',
  requireAuth,
  requirePermission('payment:refund' as any),
  async (req: Request, res: Response) => {
    try {
      const validation = refundSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        });
      }

      const { paymentIntentId, amount, reason } = validation.data;

      const service = getStripePlatformService();
      const refund = await service.createRefund({
        paymentIntentId,
        amount,
        reason,
        metadata: {
          refundedBy: req.user!.userId,
        },
      });

      logger.info('Refund created', {
        refundId: refund.id,
        paymentIntentId,
        amount: refund.amount,
        processedBy: req.user!.userId,
      });

      res.status(201).json({
        success: true,
        data: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          paymentIntentId,
        },
      });
    } catch (error: any) {
      logger.error('Failed to create refund', {
        error: error.message,
        body: req.body,
        userId: req.user?.userId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create refund',
        code: 'REFUND_ERROR',
        message: error.message,
      });
    }
  }
);

/**
 * @route POST /api/v1/payments/setup-intents
 * @desc Create a SetupIntent for saving payment methods
 * @access Authenticated users
 */
router.post(
  '/setup-intents',
  requireAuth,
  rateLimiter({ maxRequests: 5, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    try {
      const service = getStripePlatformService();
      const result = await service.createSetupIntent(
        req.user!.userId,
        req.user!.email
      );

      logger.info('SetupIntent created', {
        setupIntentId: result.setupIntentId,
        userId: req.user!.userId,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to create SetupIntent', {
        error: error.message,
        userId: req.user?.userId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create setup intent',
        code: 'SETUP_INTENT_ERROR',
      });
    }
  }
);

/**
 * @route GET /api/v1/payments/methods
 * @desc List saved payment methods
 * @access Authenticated users
 */
router.get(
  '/methods',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const service = getStripePlatformService();
      const methods = await service.listPaymentMethods(req.user!.userId);

      res.json({
        success: true,
        data: methods.map(m => ({
          id: m.id,
          type: m.type,
          card: m.card ? {
            brand: m.card.brand,
            last4: m.card.last4,
            expMonth: m.card.exp_month,
            expYear: m.card.exp_year,
          } : null,
          created: m.created,
        })),
      });
    } catch (error: any) {
      logger.error('Failed to list payment methods', {
        error: error.message,
        userId: req.user?.userId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to list payment methods',
        code: 'PAYMENT_METHODS_ERROR',
      });
    }
  }
);

/**
 * @route DELETE /api/v1/payments/methods/:id
 * @desc Delete a saved payment method
 * @access Authenticated users
 */
router.delete(
  '/methods/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id.startsWith('pm_')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payment method ID',
          code: 'VALIDATION_ERROR',
        });
      }

      const service = getStripePlatformService();
      await service.deletePaymentMethod(id);

      logger.info('Payment method deleted', {
        paymentMethodId: id,
        userId: req.user!.userId,
      });

      res.json({
        success: true,
        message: 'Payment method deleted',
      });
    } catch (error: any) {
      logger.error('Failed to delete payment method', {
        error: error.message,
        paymentMethodId: req.params.id,
        userId: req.user?.userId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete payment method',
        code: 'PAYMENT_METHOD_DELETE_ERROR',
      });
    }
  }
);

/**
 * @route POST /api/v1/payments/webhook
 * @desc Stripe webhook handler
 * @access Stripe only (signature verified)
 */
router.post(
  '/webhook',
  // Raw body is needed for signature verification
  // This should be configured at the Express app level
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing Stripe signature',
        code: 'WEBHOOK_ERROR',
      });
    }

    try {
      const service = getStripePlatformService();
      const event = service.verifyWebhookSignature(req.body, signature);

      logger.info('Webhook received', {
        eventId: event.id,
        eventType: event.type,
      });

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as any;
          logger.info('Payment succeeded', {
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
            metadata: paymentIntent.metadata,
          });
          // TODO: Update order/booking status
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object as any;
          logger.warn('Payment failed', {
            paymentIntentId: failedPayment.id,
            error: failedPayment.last_payment_error?.message,
          });
          // TODO: Notify user, update status
          break;

        case 'charge.refunded':
          const refund = event.data.object as any;
          logger.info('Charge refunded', {
            chargeId: refund.id,
            amount: refund.amount_refunded,
          });
          // TODO: Update order/booking status
          break;

        default:
          logger.debug('Unhandled webhook event', { type: event.type });
      }

      res.json({ received: true });
    } catch (error: any) {
      logger.error('Webhook processing failed', {
        error: error.message,
      });

      res.status(400).json({
        success: false,
        error: 'Webhook processing failed',
        code: 'WEBHOOK_ERROR',
      });
    }
  }
);

export default router;
