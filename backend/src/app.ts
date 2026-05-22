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
import couponRoutes from './modules/coupons/coupon.routes.js';
import deviceRoutes from './modules/devices/devices.routes.js';
import giftCardRoutes from './modules/giftcards/giftcard.routes.js';
import housekeepingRoutes from './modules/housekeeping/housekeeping.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import loyaltyRoutes from './modules/loyalty/loyalty.routes.js';
import managerRoutes from './modules/manager/manager.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import reviewRoutes from './modules/reviews/reviews.routes.js';
import staffRoutes from './modules/staff/staff.routes.js';
import moduleStaffRoutes from './modules/staff/module-staff.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import userRoutes from './modules/users/user.routes.js';
// FIX: Iteration 5 - Import booking modification routes (were never mounted, all /bookings/* returned 404)
import bookingModRoutes from './modules/bookings/booking-modification.controller.js';
// FIX: Analytics routes - were never mounted, causing 404s on /analytics/*
import { analyticsRoutes } from './modules/analytics/analytics.routes.js';

// White-Label & AI Accessibility Routes
import publicRoutes from './modules/public/public.routes.js';
import terminologyRoutes from './routes/terminology.routes.js';
import translationRoutes from './routes/translation.routes.js';
import docsRoutes from './routes/docs.routes.js';
import searchRoutes from './routes/search.routes.js';
import { getDynamicModulesRouter, loadDynamicModules as reloadDynamicModules } from './routes/dynamic-modules.loader.js';
import unitsRoutes from './routes/units.routes.js';
import { legacyRouteHandler } from './middleware/legacy-routes.middleware.js';

const app = express();

// SECURITY FIX: Raw SQL execution endpoint removed (CRITICAL-001)
// Use proper migration scripts via `npm run migrate` instead.

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

// Install Routes (public — must come before authenticated routes)
// Handles first-boot machine-ID check and super_admin provisioning.
import installRoutes from './modules/install/install.routes.js';
app.use('/api/install', installRoutes);

// Public API Routes
app.use('/api', publicRoutes);
app.use('/api/modules', getModules);

// API Routes
const apiRouter = express.Router();

// GDPR: Log staff access to PII-containing routes
import { gdprAccessLogger } from './middleware/gdpr-access-logger.js';
apiRouter.use(gdprAccessLogger);

// Add health check to API router
apiRouter.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// API Module Routes mount points
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/bookings', bookingModRoutes);
apiRouter.use('/coupons', couponRoutes);
apiRouter.use('/devices', deviceRoutes);
apiRouter.use('/giftcards', giftCardRoutes);
apiRouter.use('/housekeeping', housekeepingRoutes);
apiRouter.use('/inventory', inventoryRoutes);
apiRouter.use('/loyalty', loyaltyRoutes);
apiRouter.use('/manager', managerRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/reviews', reviewRoutes);
apiRouter.use('/staff', staffRoutes);
apiRouter.use('/staff', moduleStaffRoutes); // FIX: Mount dynamic module staff routes (room-service, hotel-rooms, spa, etc.)
apiRouter.use('/support', supportRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/search', searchRoutes);
apiRouter.use('/units', unitsRoutes);

// White-Label Routes
apiRouter.use('/terminology', terminologyRoutes);
apiRouter.use('/translations', translationRoutes);

// New Modules
import financeRoutes from './modules/finance/finance.routes.js';
import customizationRoutes from './modules/customization/routes/customization.routes.js';
import paymentPlatformRoutes from './modules/payments/payment.v1.routes.js';

// Integrations
import { quickbooksRoutes } from './modules/integrations/index.js';

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

// Unified Customization System - engine-neutral, serves all modules via dynamic routing
apiRouter.use('/customizations', customizationRoutes);

// Integration Routes
apiRouter.use('/integrations/quickbooks', quickbooksRoutes);

// POS Hardware Routes
apiRouter.use('/pos', posHardwareRoutes);

// Platform-aware payment routes (Apple Pay, Google Pay, mobile SDK)
apiRouter.use('/payments/platform', paymentPlatformRoutes);

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
// FIX: Mount analytics routes - executive cockpit, metrics, reports
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use(getDynamicModulesRouter());

// Economics Routes
import { economicsRoutes } from './modules/economics/economics.routes.js';
apiRouter.use('/economics', economicsRoutes);

// Module Templates Routes
import templateRoutes from './modules/templates/templates.routes.js';
apiRouter.use('/templates', templateRoutes);

// Channel Webhooks - FIXED
app.use('/webhooks/channels', channelWebhookRoutes);

// Legacy chalet paths return 410 Gone (must be mounted before API routes)
app.use(legacyRouteHandler);

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
    // Supabase returns plain objects, not Error instances — serialize fully
    const errDetail = err instanceof Error
      ? { message: err.message, stack: err.stack }
      : JSON.parse(JSON.stringify(err));
    logger.error('Unexpected error:', {
      error: errDetail,
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

export async function createApp() {
  await reloadDynamicModules();
  return app;
}

export async function loadDynamicModules(): Promise<void> {
  await reloadDynamicModules();
}

export default app;

// Trigger backend restart for permission cache
