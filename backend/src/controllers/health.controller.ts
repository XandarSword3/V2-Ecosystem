/**
 * Comprehensive Health Check Controller
 * Provides detailed health status for monitoring and deployment verification
 */
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    cache?: ComponentHealth;
    stripe?: ComponentHealth;
    email?: ComponentHealth;
    storage?: ComponentHealth;
    websocket?: ComponentHealth;
  };
  metrics?: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    activeConnections?: number;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  lastCheck?: string;
}

const router = Router();
const startTime = Date.now();

/**
 * Simple health check - for load balancer
 * GET /health
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Quick database ping
    const start = Date.now();
    const { error } = await supabase.from('system_settings').select('key').limit(1);
    const dbLatency = Date.now() - start;

    if (error && error.code !== 'PGRST116') {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Database connection failed',
      });
    }

    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      dbLatency: `${dbLatency}ms`,
    });
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'Health check failed',
    });
  }
});

/**
 * Detailed health check - for monitoring
 * GET /health/detailed
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: await checkDatabase(),
      storage: await checkStorage(),
      stripe: await checkStripe(),
      email: await checkEmail(),
    },
    metrics: {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    },
  };

  // Determine overall status
  const statuses = Object.values(result.checks).map(c => c.status);
  if (statuses.includes('unhealthy')) {
    result.status = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    result.status = 'degraded';
  }

  const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;
  return res.status(statusCode).json(result);
});

/**
 * Database health check
 * GET /health/db
 */
router.get('/db', async (_req: Request, res: Response) => {
  const check = await checkDatabase();
  const statusCode = check.status === 'healthy' ? 200 : 503;
  return res.status(statusCode).json(check);
});

/**
 * Readiness probe - for Kubernetes
 * GET /health/ready
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check critical dependencies
    const dbCheck = await checkDatabase();
    
    if (dbCheck.status === 'unhealthy') {
      return res.status(503).json({
        ready: false,
        reason: 'Database not available',
      });
    }

    return res.status(200).json({
      ready: true,
    });
  } catch (error) {
    return res.status(503).json({
      ready: false,
      reason: 'Readiness check failed',
    });
  }
});

/**
 * Liveness probe - for Kubernetes
 * GET /health/live
 */
router.get('/live', (_req: Request, res: Response) => {
  // Basic liveness - if we can respond, we're alive
  return res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Startup probe - for Kubernetes
 * GET /health/startup
 */
router.get('/startup', async (_req: Request, res: Response) => {
  try {
    // Verify all critical services are initialized
    const dbCheck = await checkDatabase();
    
    if (dbCheck.status === 'unhealthy') {
      return res.status(503).json({
        started: false,
        reason: 'Database initialization failed',
      });
    }

    return res.status(200).json({
      started: true,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  } catch (error) {
    return res.status(503).json({
      started: false,
      reason: 'Startup check failed',
    });
  }
});

/**
 * Metrics endpoint (Prometheus format)
 * GET /health/metrics
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  const metrics: string[] = [];
  
  // Process metrics
  const memory = process.memoryUsage();
  metrics.push(`# TYPE process_heap_bytes gauge`);
  metrics.push(`process_heap_bytes ${memory.heapUsed}`);
  
  metrics.push(`# TYPE process_heap_total_bytes gauge`);
  metrics.push(`process_heap_total_bytes ${memory.heapTotal}`);
  
  metrics.push(`# TYPE process_rss_bytes gauge`);
  metrics.push(`process_rss_bytes ${memory.rss}`);
  
  metrics.push(`# TYPE process_uptime_seconds gauge`);
  metrics.push(`process_uptime_seconds ${process.uptime()}`);
  
  // App metrics
  metrics.push(`# TYPE app_start_time_seconds gauge`);
  metrics.push(`app_start_time_seconds ${Math.floor(startTime / 1000)}`);

  res.set('Content-Type', 'text/plain');
  return res.send(metrics.join('\n'));
});

// Helper functions

async function checkDatabase(): Promise<ComponentHealth> {
  try {
    const start = Date.now();
    const { error } = await supabase.from('system_settings').select('key').limit(1);
    const latency = Date.now() - start;

    // Allow PGRST116 (no rows returned) as that's not an error
    if (error && error.code !== 'PGRST116') {
      return {
        status: 'unhealthy',
        latency,
        message: error.message,
        lastCheck: new Date().toISOString(),
      };
    }

    // Consider degraded if latency is high
    if (latency > 1000) {
      return {
        status: 'degraded',
        latency,
        message: 'High latency detected',
        lastCheck: new Date().toISOString(),
      };
    }

    return {
      status: 'healthy',
      latency,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkStorage(): Promise<ComponentHealth> {
  try {
    const start = Date.now();
    const { error } = await supabase.storage.listBuckets();
    const latency = Date.now() - start;

    if (error) {
      return {
        status: 'degraded',
        latency,
        message: 'Storage access limited',
        lastCheck: new Date().toISOString(),
      };
    }

    return {
      status: 'healthy',
      latency,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'degraded',
      message: 'Storage check failed',
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkStripe(): Promise<ComponentHealth> {
  // Don't actually call Stripe API in health check to avoid rate limits
  // Just verify the SDK is configured
  try {
    const hasKey = !!process.env.STRIPE_SECRET_KEY;
    
    return {
      status: hasKey ? 'healthy' : 'degraded',
      message: hasKey ? 'Stripe configured' : 'Stripe key not configured',
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'degraded',
      message: 'Stripe check failed',
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkEmail(): Promise<ComponentHealth> {
  // Verify email configuration exists
  try {
    const hasConfig = !!(
      process.env.SMTP_HOST || 
      process.env.SENDGRID_API_KEY ||
      process.env.AWS_SES_REGION
    );
    
    return {
      status: hasConfig ? 'healthy' : 'degraded',
      message: hasConfig ? 'Email configured' : 'Email not configured',
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'degraded',
      message: 'Email check failed',
      lastCheck: new Date().toISOString(),
    };
  }
}

export const healthController = router;
