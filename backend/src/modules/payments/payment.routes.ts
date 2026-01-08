import { Router } from 'express';
import { authenticate, authorize } from "../../middleware/auth.middleware";
import * as paymentController from "./payment.controller";

const router = Router();

// Webhook (no auth - verified by signature)
router.post('/webhook/stripe', paymentController.handleStripeWebhook);

// Customer routes
router.post('/create-intent', authenticate, paymentController.createPaymentIntent);
router.get('/methods', authenticate, paymentController.getPaymentMethods);

// Staff routes (record cash payments)
const staffRoles = ['restaurant_staff', 'snack_bar_staff', 'chalet_staff', 'pool_staff', 'restaurant_admin', 'snack_bar_admin', 'chalet_admin', 'pool_admin', 'super_admin'];
router.post('/record-cash', authenticate, authorize(...staffRoles), paymentController.recordCashPayment);
router.post('/record-manual', authenticate, authorize(...staffRoles), paymentController.recordManualPayment);

// Admin routes
const adminRoles = ['super_admin'];
router.get('/transactions', authenticate, authorize(...adminRoles), paymentController.getTransactions);
router.get('/transactions/:id', authenticate, authorize(...adminRoles), paymentController.getTransaction);

export default router;
