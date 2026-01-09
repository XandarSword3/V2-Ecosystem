import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { requestLogger, errorLogger } from './middleware/requestLogger.middleware.js';
import { normalizeBody } from './middleware/normalizeBody.middleware.js';

// Import routes
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import restaurantRoutes from './modules/restaurant/restaurant.routes.js';
import snackRoutes from './modules/snack/snack.routes.js';
import chaletRoutes from './modules/chalets/chalet.routes.js';
import poolRoutes from './modules/pool/pool.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import reviewsRoutes from './modules/reviews/reviews.routes.js';
import supportRoutes from './modules/support/support.routes.js';
import themeRoutes from './modules/theme/theme.routes.js';
import * as modulesController from './modules/admin/modules.controller.js';
import { requireModule, clearModuleCache } from './middleware/moduleGuard.middleware.js';

const app = express();

// Trust proxy - required for correct IP detection behind load balancers (Render, Vercel, etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Health check endpoint - placed before middleware for fast response
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Alternative health check endpoints for flexibility
app.get('/healthz', (req, res) => res.send('ok'));
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CORS configuration - allow Vercel preview URLs and production domains
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  config.frontendUrl,
  // Add Vercel domains
  'https://v2-ecosystem.vercel.app',
  'https://v2-ecosystem-go81hwgyk-alessandros-projects-57634a66.vercel.app',
].filter(Boolean);

// Function to check if origin is allowed (supports Vercel preview URLs)
const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // Allow requests with no origin (mobile apps, Postman, etc.)

  // Check exact match
  if (allowedOrigins.includes(origin)) return true;

  // Check Vercel preview URLs
  if (origin.endsWith('.vercel.app')) return true;

  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// General rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: 'Too many requests, please try again later.' },
  validate: { trustProxy: false },
});
app.use('/api/', limiter);

// Stricter rate limiting for authentication endpoints (brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  validate: { trustProxy: false },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Parsing & compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Normalize request body field names (supports both snake_case and camelCase)
app.use(normalizeBody);

// Logging
app.use(morgan('combined', {
  stream: { write: (message: string) => logger.http(message.trim()) },
}));

// Enhanced request logging - logs detailed request/response info for debugging
app.use(requestLogger);

// NOTE: Primary health check endpoints are defined at the top of the file (before middleware)
// to ensure fast response times for Render health checks

// Settings handler function
async function handleSettings(_req: Request, res: Response) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const { config } = await import('./config/index.js');
    const supabase = createClient(config.supabase.url, config.supabase.anonKey);

    // Existing site_settings table uses 'key' and 'value' (JSONB) columns
    const { data: settings, error } = await supabase
      .from('site_settings')
      .select('key, value');

    if (error) throw error;

    // Combine all settings into a flat object
    // Each row has a key (like 'general', 'contact') and value (JSONB object)
    const combinedSettings: Record<string, any> = {};
    (settings || []).forEach((s: any) => {
      // The value is already a JSONB object, no parsing needed
      combinedSettings[s.key] = s.value;
    });

    res.json({ success: true, data: combinedSettings });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({ success: false, error: 'Failed to load settings' });
  }
}

// Public site settings endpoint (no auth required) - both paths
app.get('/settings', handleSettings);
app.get('/api/settings', handleSettings);

// Public modules endpoint
app.get('/api/modules', modulesController.getModules);

// API Routes - Module-protected routes have guards that check if module is active
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurant', requireModule('restaurant'), restaurantRoutes);
app.use('/api/snack', requireModule('snack-bar'), snackRoutes);
app.use('/api/chalets', requireModule('chalets'), chaletRoutes);
app.use('/api/pool', requireModule('pool'), poolRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/theme', themeRoutes);

// Export clearModuleCache for use when modules are updated
export { clearModuleCache };

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Enhanced error logging middleware - logs full error details
app.use(errorLogger);

// Global error handler
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const requestId = (req as any).requestId || 'unknown';

  // Log error (skip logging for 404s and validation errors in production to reduce noise)
  if (err.statusCode !== 404 && err.statusCode !== 400) {
    logger.error(`[${requestId}] Unhandled error:`, err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : (config.env === 'production' ? 'Internal Server Error' : err.message);

  res.status(statusCode).json({
    success: false,
    error: message,
    errors: err.errors, // Include validation errors if present
    requestId: requestId,
  });
});

export default app;
