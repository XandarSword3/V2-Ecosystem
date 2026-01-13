import { Router } from 'express';
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { rateLimits } from "../../middleware/userRateLimit.middleware.js";
import * as paymentController from "./payment.controller";

const router = Router();

// Webhook (no auth - verified by signature)
router.post('/webhook/stripe', paymentController.handleStripeWebhook);

// Customer routes (rate limited - financial operations)
router.post('/create-intent', authenticate, rateLimits.write, paymentController.createPaymentIntent);
router.get('/methods', authenticate, paymentController.getPaymentMethods);

// Staff routes (record cash payments) - rate limited to prevent abuse
const staffRoles = ['restaurant_staff', 'snack_bar_staff', 'chalet_staff', 'pool_staff', 'restaurant_admin', 'snack_bar_admin', 'chalet_admin', 'pool_admin', 'super_admin'];
router.post('/record-cash', authenticate, authorize(...staffRoles), rateLimits.write, paymentController.recordCashPayment);
router.post('/record-manual', authenticate, authorize(...staffRoles), rateLimits.write, paymentController.recordManualPayment);

// Admin routes
const adminRoles = ['super_admin'];
router.get('/transactions', authenticate, authorize(...adminRoles), paymentController.getTransactions);
router.get('/transactions/:id', authenticate, authorize(...adminRoles), paymentController.getTransaction);
router.post('/transactions/:id/refund', authenticate, authorize(...adminRoles), rateLimits.sensitive, paymentController.refundPayment);

export default router;
