/**
 * POS Hardware Routes
 * 
 * Routes for hardware POS operations including Stripe Terminal and printers
 */

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import * as posHardwareController from './pos-hardware.controller.js';

const router = Router();
const posRoles = ['admin', 'super_admin', 'manager', 'staff'];

// Stripe Terminal endpoints
router.post('/terminal/connection-token', authenticate, authorize(...posRoles), posHardwareController.createConnectionToken);
router.post('/terminal/payment-intent', authenticate, authorize(...posRoles), posHardwareController.createTerminalPaymentIntent);
router.post('/terminal/capture', authenticate, authorize(...posRoles), posHardwareController.captureTerminalPayment);
router.post('/terminal/cancel', authenticate, authorize(...posRoles), posHardwareController.cancelTerminalPayment);
router.get('/terminal/readers', authenticate, authorize(...posRoles), posHardwareController.listReaders);
router.post('/terminal/readers', authenticate, authorize('admin', 'super_admin'), posHardwareController.registerReader);
router.post('/terminal/location', authenticate, authorize('admin', 'super_admin'), posHardwareController.getOrCreateLocation);

// Printer endpoints
router.post('/print', authenticate, authorize(...posRoles), posHardwareController.printToNetworkPrinter);
router.post('/open-drawer', authenticate, authorize(...posRoles), posHardwareController.openCashDrawer);
router.get('/printer/status', authenticate, authorize(...posRoles), posHardwareController.getPrinterStatus);
router.post('/printer/config', authenticate, authorize('admin', 'super_admin'), posHardwareController.savePrinterConfig);
router.get('/printer/config', authenticate, authorize(...posRoles), posHardwareController.getPrinterConfig);

export default router;
