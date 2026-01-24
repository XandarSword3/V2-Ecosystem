import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config/index.js';

// Controller imports
import { getModules } from './modules/admin/modules.controller.js';

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (config.env !== 'test') {
  app.use(morgan('dev'));
}

// Health Check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));
// Add /api/health alias for services checking that path
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Public settings - read from database for themes, contact info, homepage, footer etc
app.get('/api/settings', async (req, res) => {
  try {
    const { getSupabase } = await import('./database/connection.js');
    const supabase = getSupabase();
    const { data: settings } = await supabase
      .from('site_settings')
      .select('key, value');
    
    // Build response from database settings
    const result: Record<string, unknown> = {
      theme: 'default',
      contact: { email: 'support@v2resort.com' }
    };
    
    if (settings) {
      for (const setting of settings) {
        if (setting.key === 'appearance' && setting.value && typeof setting.value === 'object') {
          const appearance = setting.value as Record<string, unknown>;
          if (appearance.theme) result.theme = appearance.theme;
          if (appearance.weatherEffect) result.weatherEffect = appearance.weatherEffect;
          if (appearance.showWeatherWidget !== undefined) result.showWeatherWidget = appearance.showWeatherWidget;
        }
        if (setting.key === 'contact' && setting.value && typeof setting.value === 'object') {
          const contact = setting.value as Record<string, unknown>;
          result.contact = setting.value;
          // Also flatten contact fields for direct access
          if (contact.phone) result.phone = contact.phone;
          if (contact.email) result.email = contact.email;
          if (contact.address) result.address = contact.address;
        }
        if (setting.key === 'general' && setting.value && typeof setting.value === 'object') {
          const general = setting.value as Record<string, unknown>;
          if (general.resortName) result.resortName = general.resortName;
          if (general.tagline) result.tagline = general.tagline;
          if (general.description) result.description = general.description;
        }
        // Homepage CMS settings
        if (setting.key === 'homepage' && setting.value) {
          result.homepage = setting.value;
        }
        // Footer CMS settings
        if (setting.key === 'footer' && setting.value) {
          result.footer = setting.value;
        }
        // Navbar CMS settings
        if (setting.key === 'navbar' && setting.value) {
          result.navbar = setting.value;
        }
        // Hours settings
        if (setting.key === 'hours' && setting.value && typeof setting.value === 'object') {
          const hours = setting.value as Record<string, unknown>;
          result.hours = setting.value;
          // Also flatten for direct access
          if (hours.poolHours) result.poolHours = hours.poolHours;
          if (hours.restaurantHours) result.restaurantHours = hours.restaurantHours;
          if (hours.receptionHours) result.receptionHours = hours.receptionHours;
        }
      }
    }
    
    res.json(result);
  } catch (error) {
    // Fallback to defaults on error
    res.json({
      theme: 'default',
      contact: { email: 'support@v2resort.com' }
    });
  }
});
// Public modules
app.get('/api/modules', getModules);

// API Routes
const apiRouter = express.Router();
// Add health check to API router
apiRouter.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

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
