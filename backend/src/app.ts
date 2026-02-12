import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { csrfProtection, csrfTokenHandler, ensureCsrfToken } from './middleware/csrf.middleware.js';
import { initSentry, sentryRequestHandler, sentryErrorHandler } from './utils/sentry.js';
import { logger } from './utils/logger.js';
import { getSupabase } from './database/connection.js';

// Controller imports
import { getModules } from './modules/admin/modules.controller.js';
import { authenticate, authorize } from './middleware/auth.middleware.js';

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
import moduleStaffRoutes from './modules/staff/module-staff.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import userRoutes from './modules/users/user.routes.js';
// FIX: Iteration 5 - Import booking modification routes (were never mounted, all /bookings/* returned 404)
import bookingModRoutes from './modules/bookings/booking-modification.controller.js';

// White-Label & AI Accessibility Routes
import terminologyRoutes from './routes/terminology.routes.js';
import genericRoutes from './routes/generic.routes.js';
import translationRoutes from './routes/translation.routes.js';
import docsRoutes from './routes/docs.routes.js';

const app = express();

// Initialize Sentry
initSentry(app);

// Sentry Request Handler - must be the first middleware on the app
app.use(sentryRequestHandler());

// Security & Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CSRF Protection - apply to all state-changing requests
app.use(csrfProtection);

// CSRF Token endpoint - clients can call this to get a fresh token
app.get('/api/csrf-token', csrfTokenHandler);

if (config.env !== 'test') {
  app.use(morgan('dev'));
}

// Health Check - Basic liveness probe
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Enhanced health check - Readiness probe (checks database connectivity)
app.get('/health/ready', async (req, res) => {
  try {
    const { getSupabase } = await import('./database/connection.js');
    const supabase = getSupabase();

    // Check database connectivity
    const startTime = Date.now();
    const { error } = await supabase.from('users').select('id').limit(1);
    const dbLatency = Date.now() - startTime;

    if (error) {
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date(),
        database: { status: 'error', error: error.message },
      });
    }

    res.json({
      status: 'ok',
      timestamp: new Date(),
      database: { status: 'ok', latency: `${dbLatency}ms` },
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

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
      contact: { email: 'info@ironparadisegym.com' }
    };

    if (settings) {
      for (const setting of settings) {
        if (setting.key === 'appearance' && setting.value && typeof setting.value === 'object') {
          const appearance = setting.value as Record<string, unknown>;
          if (appearance.theme) result.theme = appearance.theme;
          if (appearance.themeColors) result.themeColors = appearance.themeColors;
          if (appearance.weatherEffect) result.weatherEffect = appearance.weatherEffect;
          if (appearance.showWeatherWidget !== undefined) result.showWeatherWidget = appearance.showWeatherWidget;
          if (appearance.weatherLocation) result.weatherLocation = appearance.weatherLocation;
          if (appearance.animationsEnabled !== undefined) result.animationsEnabled = appearance.animationsEnabled;
          if (appearance.reducedMotion !== undefined) result.reducedMotion = appearance.reducedMotion;
          if (appearance.soundEnabled !== undefined) result.soundEnabled = appearance.soundEnabled;
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
        // FIX: Iteration 8 - Expose taxRate, serviceChargeRate, deliveryFee from their config keys
        if (setting.key === 'tax_configuration' && setting.value && typeof setting.value === 'object') {
          const taxConfig = setting.value as Record<string, unknown>;
          if (taxConfig.global_rate !== undefined) {
            result.taxRate = Number(taxConfig.global_rate);
          } else if (taxConfig.default_rate !== undefined) {
            result.taxRate = Number(taxConfig.default_rate) / 100;
          }
        }
        if (setting.key === 'order_configuration' && setting.value && typeof setting.value === 'object') {
          const orderConfig = setting.value as Record<string, unknown>;
          if (orderConfig.serviceChargeRate !== undefined) result.serviceChargeRate = Number(orderConfig.serviceChargeRate);
          if (orderConfig.deliveryFee !== undefined) result.deliveryFee = Number(orderConfig.deliveryFee);
        }
      }
    }

    res.json(result);
  } catch (error) {
    // Fallback to defaults on error
    res.json({
      theme: 'default',
      contact: { email: 'info@ironparadisegym.com' }
    });
  }
});
// Public modules
app.get('/api/modules', getModules);

// Public weather endpoint
app.get('/api/weather', async (req, res) => {
  try {
    const location = req.query.location as string || 'New York';
    const apiKey = process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY;

    // If no API key configured, return demo data
    if (!apiKey) {
      return res.json({
        success: true,
        data: {
          temperature: 24,
          feels_like: 26,
          humidity: 65,
          wind_speed: 12,
          visibility: 10,
          condition: 'Partly Cloudy',
          description: 'Demo weather data - configure OPENWEATHER_API_KEY for live data',
          icon: 'cloud-sun',
          location: location
        }
      });
    }

    // Try OpenWeather API
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
    const weatherRes = await fetch(weatherUrl);

    if (!weatherRes.ok) {
      throw new Error('Weather API request failed');
    }

    const data = await weatherRes.json() as any;

    res.json({
      success: true,
      data: {
        temperature: data.main?.temp || 20,
        feels_like: data.main?.feels_like || 20,
        humidity: data.main?.humidity || 50,
        wind_speed: data.wind?.speed ? data.wind.speed * 3.6 : 0, // Convert m/s to km/h
        visibility: data.visibility ? data.visibility / 1000 : 10, // Convert m to km
        condition: data.weather?.[0]?.main || 'Unknown',
        description: data.weather?.[0]?.description || '',
        icon: data.weather?.[0]?.icon || '',
        location: data.name || location
      }
    });
  } catch (error) {
    console.error('Weather API error:', error);
    // Return demo data on error
    res.json({
      success: true,
      data: {
        temperature: 24,
        feels_like: 26,
        humidity: 65,
        wind_speed: 12,
        visibility: 10,
        condition: 'Partly Cloudy',
        description: 'Weather data temporarily unavailable',
        icon: 'cloud-sun',
        location: (req.query.location as string) || 'Resort Location'
      }
    });
  }
});

// API Routes
const apiRouter = express.Router();
// Add health check to API router
apiRouter.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Settings routes (tax, etc.)
// FIX: Iteration 8 - Unified DB key 'tax_configuration' (was split: admin used 'tax', TaxService used 'tax_configuration')
apiRouter.get('/settings/tax', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'tax_configuration').single();
    
    if (data?.value) {
      const stored = data.value;
      // If data has global_rate (TaxService format) but no default_rate (admin format), convert
      if (stored.global_rate !== undefined && stored.default_rate === undefined) {
        stored.default_rate = Math.round(stored.global_rate * 100);
      }
      res.json({ success: true, data: stored });
    } else {
      res.json({ 
        success: true, 
        data: {
          // FIX: Iteration 4 - Align default to 11% (matches backend tax.service.ts DEFAULT_TAX_RATE)
          default_rate: 11,
          global_rate: 0.11,
          taxIncluded: false,
          taxName: 'VAT',
          taxCategories: []
        }
      });
    }
  } catch {
    res.json({ 
      success: true, 
      // FIX: Iteration 4 - Align default to 11%
      data: { default_rate: 11, global_rate: 0.11, taxIncluded: false, taxName: 'VAT', taxCategories: [] }
    });
  }
});
apiRouter.put('/settings/tax', authenticate, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const supabase = getSupabase();
    const body = req.body;
    // FIX: Iteration 8 - Always compute global_rate (decimal) from default_rate (percentage) for TaxService compatibility
    if (body.default_rate !== undefined && body.global_rate === undefined) {
      body.global_rate = Number(body.default_rate) / 100;
    }
    body.updated_at = new Date().toISOString();
    await supabase.from('site_settings').upsert({ key: 'tax_configuration', value: body }, { onConflict: 'key' });
    res.json({ success: true, data: body });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save tax settings' });
  }
});

apiRouter.use('/admin', adminRoutes);
apiRouter.use('/auth', authRoutes);
// FIX: Iteration 5 - Mount booking modification routes (cancellation, date changes, rescheduling)
apiRouter.use('/bookings', bookingModRoutes);
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
apiRouter.use('/staff', moduleStaffRoutes); // FIX: Mount dynamic module staff routes (room-service, hotel-rooms, spa, etc.)
apiRouter.use('/support', supportRoutes);
apiRouter.use('/users', userRoutes);

// White-Label Routes
apiRouter.use('/terminology', terminologyRoutes);
apiRouter.use('/translations', translationRoutes);
apiRouter.use('/', genericRoutes);

// New Modules
import financeRoutes from './modules/finance/finance.routes.js';
import modifiersRoutes from './modules/restaurant/modifiers.routes.js';
import waitlistRoutes from './modules/restaurant/waitlist.routes.js';
import customizationRoutes from './modules/customization/routes/customization.routes.js';

// Integrations - DISABLED: Uses PrismaClient, needs Supabase refactor
// import { quickbooksRoutes } from './modules/integrations/index.js';

// Hardware POS
import posHardwareRoutes from './modules/pos/pos-hardware.routes.js';

// GDPR / Privacy - FIXED
import gdprRoutes from './modules/gdpr/gdpr.routes.js';

// Channel Management (OTA) - FIXED
import channelRoutes, { webhookRouter as channelWebhookRoutes } from './modules/channels/channel.routes.js';

// Rate Parity - FIXED
import parityRoutes from './modules/parity/parity.routes.js';

// Multi-Property - FIXED
import multiPropertyRoutes from './modules/multi-property/multi-property.routes.js';

// Phase 3: Operations - FIXED: Converted to Supabase
import { reportingRoutes } from './modules/reporting/reporting.routes.js';
import { revenueRoutes } from './modules/revenue/revenue.routes.js';
import groupsRoutes from './modules/groups/groups.routes.js';
import marketingRoutes from './modules/marketing/marketing.routes.js';

// Phase 4: Guest Experience - FIXED: Converted to Supabase
import mobileCheckinRoutes from './modules/mobile-checkin/mobile-checkin.routes.js';
import kioskRoutes from './modules/kiosk/kiosk.routes.js';
import messagingRoutes from './modules/messaging/messaging.routes.js';
import i18nRoutes from './modules/i18n/i18n.routes.js';

apiRouter.use('/finance', financeRoutes);
apiRouter.use('/restaurant/modifiers', modifiersRoutes);
apiRouter.use('/restaurant/waitlist', waitlistRoutes);

// Unified Customization System - for ALL modules (restaurant, chalets, pool, snack bar, future modules)
apiRouter.use('/customizations', customizationRoutes);

// Integration Routes - DISABLED: Uses PrismaClient
// apiRouter.use('/integrations/quickbooks', quickbooksRoutes);

// POS Hardware Routes
apiRouter.use('/pos', posHardwareRoutes);

// GDPR Routes - FIXED
apiRouter.use('/gdpr', gdprRoutes);

// Channel Management Routes - FIXED
apiRouter.use('/channels', channelRoutes);

// Rate Parity Routes - FIXED
apiRouter.use('/rate-parity', parityRoutes);

// Multi-Property Routes - FIXED
apiRouter.use('/multi-property', multiPropertyRoutes);

// Phase 3: Operations Routes - FIXED: Converted to Supabase
apiRouter.use('/reporting', reportingRoutes);
apiRouter.use('/revenue', revenueRoutes);
apiRouter.use('/groups', groupsRoutes);
apiRouter.use('/marketing', marketingRoutes);

// Phase 4: Guest Experience Routes - FIXED: Converted to Supabase
apiRouter.use('/mobile-checkin', mobileCheckinRoutes);
apiRouter.use('/kiosk', kioskRoutes);
apiRouter.use('/messaging', messagingRoutes);
apiRouter.use('/i18n', i18nRoutes);

// Channel Webhooks - FIXED
app.use('/webhooks/channels', channelWebhookRoutes);

app.use('/api/v1', apiRouter);

// Documentation routes (Public)
app.use('/api/docs', docsRoutes);

// Basic 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Sentry Error Handler - must be before any other error middleware
app.use(sentryErrorHandler());

// Structured Error Handler
app.use((err: Error & { statusCode?: number; code?: string; isOperational?: boolean; errors?: unknown[]; details?: Record<string, unknown> }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Log non-operational (unexpected) errors with full stack trace
  if (!err.isOperational) {
    logger.error('Unexpected error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      requestId: req.requestId,
    });
  } else {
    logger.warn('Operational error:', {
      code: err.code,
      message: err.message,
      path: req.path,
      method: req.method,
      requestId: req.requestId,
    });
  }

  const status = err.statusCode || 500;
  const isProd = config.env === 'production';

  const response: Record<string, unknown> = {
    success: false,
    error: status === 500 && isProd ? 'Internal Server Error' : err.message,
    code: err.code || 'INTERNAL_ERROR',
  };

  // Include validation errors if present
  if (err.errors) {
    response.errors = err.errors;
  }

  // Include details in non-production
  if (!isProd && err.details) {
    response.details = err.details;
  }

  res.status(status).json(response);
});

export default app;
