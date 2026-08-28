import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config/index';
import { csrfProtection, csrfTokenHandler, ensureCsrfToken } from './middleware/csrf.middleware.js';
import { sentryRequestHandler, sentryErrorHandler } from './utils/sentry.js';
import { logger } from './utils/logger.js';
import { getSupabase } from './database/connection.js';

// Controller imports
import { getModules, getModule } from './modules/admin/modules.controller.js';
import * as publicController from './modules/public/public.controller.js';
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
// legacyRouteHandler removed — dynamic module router correctly handles all module slugs
import platformRoutes from './modules/platform/platform.routes.js';
import { handleSaasStripeWebhook } from './modules/platform/saas-webhook.controller.js';
import { skipTenantGate, tenantGate, resolveTenant } from './middleware/tenantAccess.middleware.js';
import { resolveProperty } from './middleware/propertyResolution.middleware.js';
import { xssSanitizer, parameterPollutionProtection } from './middleware/api-security.middleware.js';
import { getSupabase as getSupabaseForAssets } from './database/connection.js';
import { asyncHandler } from './middleware/async-handler.js';

const app = express();

// SECURITY: Tell Express we're behind one trusted reverse proxy (Nginx / Render).
// Without this, req.ip returns the proxy's internal IP (127.0.0.1), which breaks
// IP-based rate limiting and audit log ip_address fields for every user.
app.set('trust proxy', 1);

// SECURITY FIX: Raw SQL execution endpoint removed (CRITICAL-001)
// Use proper migration scripts via `npm run migrate` instead.

// NOTE: Sentry is initialized in index.ts before the HTTP server starts.
// Do NOT call initSentry() here — calling it twice causes undefined behaviour
// in some Sentry SDK versions (duplicate events, wrong sampling).

// Sentry Request Handler - must be the first middleware on the app
app.use(sentryRequestHandler());

// Security & Middleware
// crossOriginResourcePolicy is relaxed to 'cross-origin' because the asset proxy route
// (/api/v1/assets/*) serves images to a frontend running on a different origin/port
// (e.g. localhost:3000 vs backend localhost:3005). Helmet's default 'same-origin' CORP
// causes the browser to silently block <img> loads from that route with no console error
// beyond a blocked-resource entry in the network tab.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(compression());
app.use(cookieParser());
// SaaS Stripe webhook — must receive raw body BEFORE express.json() is applied
// express.raw() preserves the buffer Stripe needs for signature verification
app.post(
  '/api/webhooks/stripe/saas',
  skipTenantGate,
  express.raw({ type: 'application/json' }),
  handleSaasStripeWebhook,
);

// Per-property Stripe webhook — same raw-body requirement.
// Must be mounted BEFORE express.json() or req.rawBody will be undefined
// and the controller will immediately return 400.
app.post(
  '/api/v1/payments/webhook/stripe',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    // Expose raw buffer so payment.controller.ts can use it for Stripe signature verification
    (req as any).rawBody = req.body;
    next();
  },
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP Parameter Pollution protection — prevents ?role=customer&role=admin bypass tricks
app.use(parameterPollutionProtection);

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

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
      // Log the real error internally; never expose DB details to unauthenticated callers
      logger.error('Health readiness probe DB error:', { message: error.message });
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date(),
        database: { status: 'database_unavailable' },
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
    logger.error('Health readiness probe unexpected error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      database: { status: 'database_unavailable' },
    });
  }
});

// Install Routes (public — must come before authenticated routes)
// Handles first-boot machine-ID check and super_admin provisioning.
import installRoutes from './modules/install/install.routes.js';
app.use('/api/install', installRoutes);

// Public API Routes
//
// FIX (CONTEXT.md "Public/Admin Property Context Contamination", session 7-9):
// These two mounts previously ran with NO tenant/property resolution at all —
// publicController.getSettings and getModules trusted whatever x-property-id
// header happened to arrive (often a stale value leaked from admin's
// localStorage activePropertyId via settings-context.tsx's raw fetch()).
// tenantGate + resolveProperty now run here so req.tenant/req.property are
// always derived from the request itself (X-Tenant-Slug/X-Property-Slug
// headers set by frontend/src/middleware.ts from the Host header, or the
// single-property/single-tenant fallback) before either handler runs.
//
// NOTE: Mount specific routes BEFORE the general /api route to avoid
// route conflicts - /api is more general and would catch these if mounted first.
import { Router } from 'express';

// Mount /api/settings with tenant resolution (no billing gate) and property resolution
// resolveTenant sets req.tenant with property_group_id so resolveProperty can do
// group-scoped property lookup. We skip the billing gate to allow public access.
app.get('/api/settings', resolveTenant, resolveProperty, publicController.getSettings);

// Mount /api/branding — public, property-scoped branding (no auth required)
// Uses the same tenant + property resolution as /api/settings
import brandingController from './modules/admin/branding.controller.js';
app.get('/api/branding', resolveTenant, resolveProperty, (req, res, next) => {
  // Rewrite to hit the /public sub-route on the branding router
  req.url = '/public';
  brandingController(req, res, next);
});

// Mount /api/modules with tenant and property resolution to prevent cross-tenant leaks
app.get('/api/modules', resolveTenant, resolveProperty, getModules);
// Single module by slug (or UUID) — used by [slug]/page.tsx to fetch full settings.layout
app.get('/api/modules/:slug', resolveTenant, resolveProperty, getModule);

// Mount the rest of public routes with tenant/property resolution
// NOTE: This must come AFTER the specific routes above to avoid conflicts
app.use('/api', tenantGate, resolveProperty, publicRoutes);

// API Routes
const apiRouter = express.Router();

// GDPR: Log staff access to PII-containing routes
import { gdprAccessLogger } from './middleware/gdpr-access-logger.js';
apiRouter.use(gdprAccessLogger);

// XSS sanitization — scrub all user-supplied strings in body/query/params
apiRouter.use(xssSanitizer);

// ── Tenant gate ──────────────────────────────────────────────────────────────
// Resolves the calling tenant (via X-Tenant-ID header, X-Tenant-Slug header,
// or subdomain) and blocks suspended/cancelled tenants with 402.
// Passes through cleanly when no tenant resolves (legacy single-tenant mode).
// NOTE: tenantGate is applied at app level (line 213) to avoid double execution
// ────────────────────────────────────────────────────────────────────────────

// Add health check to API router
apiRouter.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Public asset proxy — downloads files from Supabase storage server-side and streams
// them to the client. No redirect is issued, so the Supabase project URL never appears
// anywhere in the browser. No authentication required; these are public brand/content assets.
// FIX: This route previously lived only in routes/v1.routes.ts, which app.ts never imports —
// requests fell through to the global 404 handler, so every uploaded image/logo/favicon broke.
apiRouter.get('/assets/*', asyncHandler(async (req, res) => {
  const storagePath = (req.params as any)[0] as string;

  if (!storagePath || storagePath.includes('..')) {
    res.status(400).json({ success: false, error: 'Invalid asset path' });
    return;
  }

  const supabase = getSupabaseForAssets();

  const { data: fileData, error } = await supabase.storage
    .from('assets')
    .download(storagePath);

  if (error || !fileData) {
    res.status(404).json({ success: false, error: 'Asset not found' });
    return;
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());

  res.setHeader('Content-Type', fileData.type || 'application/octet-stream');
  // 24 h browser cache — filenames include a timestamp so they never collide across uploads
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}));

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
// Staff routes need tenant + property context (resolveTenant → resolveProperty)
// so controllers can read req.property.id. Only resolve when the relevant
// headers are present — skip for routes that don't need property context.
apiRouter.use('/staff', (req: any, _res: any, next: any) => {
  // Only resolve when X-Property-Slug is present (property-scoped requests).
  // Routes like /staff/shifts/me or /staff/customers don't need property context.
  const needsProperty = req.headers['x-property-slug'] || req.headers['x-property-id'];
  if (!needsProperty) return next();
  resolveTenant(req, _res, () => resolveProperty(req, _res, next));
});
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
import pricingRoutes from './modules/admin/pricing.controller.js';

apiRouter.use('/pricing', pricingRoutes);

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
// ARCHIVED: kiosk routes removed (Issue 7). Module files still on disk under backend/src/modules/kiosk/ and archive/kiosk/.
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
// ARCHIVED: /kiosk routes removed (Issue 7). DB tables still exist — do not drop without migration.
apiRouter.use('/messaging', messagingRoutes);
apiRouter.use('/i18n', i18nRoutes);
// FIX: Mount analytics routes - executive cockpit, metrics, reports
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use(getDynamicModulesRouter());

// Economics Routes
import { economicsRoutes } from './modules/economics/economics.routes.js';
apiRouter.use('/economics', economicsRoutes);

// Platform SaaS routes (checkout, billing portal, control plane)
apiRouter.use('/platform', platformRoutes);

// Module Templates Routes
import templateRoutes from './modules/templates/templates.routes.js';
apiRouter.use('/templates', templateRoutes);

// Channel Webhooks - FIXED
app.use('/webhooks/channels', channelWebhookRoutes);

// Legacy accommodation paths return 410 Gone (must be mounted before API routes)
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
