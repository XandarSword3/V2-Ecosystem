import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config/index.js';

// Module Routes imports
import adminRoutes from './modules/admin/admin.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import chaletRoutes from './modules/chalets/chalet.routes.js';
import couponRoutes from './modules/coupons/coupon.routes.js';
import deviceRoutes from './modules/devices/devices.routes.js';
import giftCardRoutes from './modules/giftcards/giftcard.routes.js';
import housekeepingRoutes from './modules/housekeeping/housekeeping.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import loyaltyRoutes from './modules/loyalty/loyalty.routes.js';
import managerRoutes from './modules/manager/manager.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import poolRoutes from './modules/pool/pool.routes.js';
import restaurantRoutes from './modules/restaurant/restaurant.routes.js';
import reviewRoutes from './modules/reviews/reviews.routes.js';
import snackRoutes from './modules/snack/snack.routes.js';
import staffRoutes from './modules/staff/staff.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import userRoutes from './modules/users/user.routes.js';

const app = express();

// Security & Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (config.env !== 'test') {
  app.use(morgan('dev'));
}

// Health Check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));
// Public settings
app.get('/api/settings', (req, res) => res.json({
  theme: 'default',
  contact: { email: 'support@v2resort.com' }
}));

// API Routes
const apiRouter = express.Router();
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/chalets', chaletRoutes);
apiRouter.use('/coupons', couponRoutes);
apiRouter.use('/devices', deviceRoutes);
apiRouter.use('/giftcards', giftCardRoutes);
apiRouter.use('/housekeeping', housekeepingRoutes);
apiRouter.use('/inventory', inventoryRoutes);
apiRouter.use('/loyalty', loyaltyRoutes);
apiRouter.use('/manager', managerRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/pool', poolRoutes);
apiRouter.use('/restaurant', restaurantRoutes);
apiRouter.use('/reviews', reviewRoutes);
apiRouter.use('/snack', snackRoutes);
apiRouter.use('/staff', staffRoutes);
apiRouter.use('/support', supportRoutes);
apiRouter.use('/users', userRoutes);

app.use('/api/v1', apiRouter);

// Basic 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Implementation of Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ success: false, error: message });
});

export default app;
