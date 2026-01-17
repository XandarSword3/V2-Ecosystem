/**
 * Controllers Index
 * 
 * Export all controller factories from a single location.
 */

export { createPoolController } from './pool.controller.js';
export type { PoolController, PoolControllerDeps } from './pool.controller.js';

export { createAuthController } from './auth.controller.js';
export type { AuthController, AuthControllerDependencies } from './auth.controller.js';

export { createOrderController } from './order.controller.js';
export type { OrderController, OrderControllerDeps } from './order.controller.js';

export { createBookingController } from './booking.controller.js';
export type { BookingController, BookingControllerDeps } from './booking.controller.js';

// Future controllers will be added here:
// export { createPaymentController } from './payment.controller.js';
