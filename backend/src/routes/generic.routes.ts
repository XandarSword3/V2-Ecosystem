// File: backend/src/routes/generic.routes.ts
import { Router } from 'express';
import { requireModule } from "../middleware/moduleGuard.middleware.js";

// Import specific controllers
// We reuse existing controllers but alias the routes
import * as chaletController from "../modules/chalets/chalet.controller.js";
import * as poolController from "../modules/pool/pool.controller.js";
import * as menuController from "../modules/restaurant/controllers/menu.controller.js";
import * as orderController from "../modules/restaurant/controllers/order.controller.js";

const router = Router();

// --- Units (Accommodation) ---
// Replaces /chalets
router.use('/units', requireModule('chalets')); // Check 'chalets' module permission even for generic route
router.get('/units', chaletController.getChalets);
router.get('/units/:id', chaletController.getChalet);
router.post('/units', chaletController.createChalet);
router.put('/units/:id', chaletController.updateChalet);
router.delete('/units/:id', chaletController.deleteChalet);

// --- Facilities (Pool/Gym/Spa) ---
// Replaces /pool
router.use('/facilities', requireModule('pool'));
router.get('/facilities/sessions', poolController.getSessions);
router.get('/facilities/tickets', poolController.getTodayTickets);
router.post('/facilities/tickets', poolController.purchaseTicket);

// --- Dining (Restaurant/Bar) ---
// Replaces /restaurant
router.use('/dining', requireModule('restaurant'));
router.get('/dining/menu', menuController.getFullMenu);
router.get('/dining/orders', orderController.getStaffOrders);
router.post('/dining/orders', orderController.createOrder);

export default router;

