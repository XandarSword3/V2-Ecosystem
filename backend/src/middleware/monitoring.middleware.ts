/**
 * Performance Monitoring Middleware
 * 
 * Tracks request timing, slow queries, and system metrics.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// In-memory metrics store (could be replaced with Redis or external metrics service)
interface RequestMetrics {
  totalRequests: number;
  totalErrors: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  responseTimes: number[];
  statusCodes: Record<string, number>;
  endpoints: Record<string, {
    count: number;
    totalTime: number;
    errors: number;
  }>;
  lastReset: number;
}

const MAX_RESPONSE_TIMES = 1000; // Keep last N response times for percentile calculation
const SLOW_REQUEST_THRESHOLD_MS = 1000; // Log requests slower than this

const metrics: RequestMetrics = {
  totalRequests: 0,
  totalErrors: 0,
  avgResponseTime: 0,
  p95ResponseTime: 0,
  p99ResponseTime: 0,
  responseTimes: [],
  statusCodes: {},
  endpoints: {},
  lastReset: Date.now(),
};

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(arr: number[], percentile: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Update metrics with new response time
 */
function updateMetrics(responseTime: number, statusCode: number, endpoint: string): void {
  metrics.totalRequests++;
  
  // Track response times for percentile calculations
  metrics.responseTimes.push(responseTime);
  if (metrics.responseTimes.length > MAX_RESPONSE_TIMES) {
    metrics.responseTimes.shift();
  }
  
  // Update average
  metrics.avgResponseTime = 
    metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
  
  // Update percentiles
  metrics.p95ResponseTime = calculatePercentile(metrics.responseTimes, 95);
  metrics.p99ResponseTime = calculatePercentile(metrics.responseTimes, 99);
  
  // Track status codes
  const statusGroup = `${Math.floor(statusCode / 100)}xx`;
  metrics.statusCodes[statusGroup] = (metrics.statusCodes[statusGroup] || 0) + 1;
  
  if (statusCode >= 500) {
    metrics.totalErrors++;
  }
  
  // Track endpoint metrics
  if (!metrics.endpoints[endpoint]) {
    metrics.endpoints[endpoint] = { count: 0, totalTime: 0, errors: 0 };
  }
  metrics.endpoints[endpoint].count++;
  metrics.endpoints[endpoint].totalTime += responseTime;
  if (statusCode >= 400) {
    metrics.endpoints[endpoint].errors++;
  }
}

/**
 * Request timing middleware
 */
export function requestTiming(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();
  
  // Track if we've already processed this response
  let hasProcessed = false;
  
  // Override res.end to capture timing
  const originalEnd = res.end.bind(res);
  
  // Use proper overloaded function type for res.end
  type EndCallback = () => void;
  type EndChunk = Buffer | string | undefined;
  type EndEncoding = BufferEncoding | undefined;
  
  res.end = function(
    chunkOrCb?: EndChunk | EndCallback,
    encodingOrCb?: EndEncoding | EndCallback,
    callback?: EndCallback
  ): Response {
    // Only process once to avoid double-send errors
    if (!hasProcessed) {
      hasProcessed = true;
      const endTime = process.hrtime.bigint();
      const durationNs = Number(endTime - startTime);
      const durationMs = durationNs / 1_000_000;
      
      // Set timing header only if headers haven't been sent yet
      if (!res.headersSent) {
        res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
      }
      
      // Normalize endpoint for grouping (replace UUIDs and IDs with placeholders)
      const endpoint = `${req.method} ${req.route?.path || req.path}`
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid')
        .replace(/\/\d+/g, '/:id');
      
      // Update metrics
      updateMetrics(durationMs, res.statusCode, endpoint);
      
      // Log slow requests
      if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
        logger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          duration: `${durationMs.toFixed(2)}ms`,
          statusCode: res.statusCode,
          requestId: req.requestId,
        });
      }
    }
    
    // Handle overloaded signatures
    if (typeof chunkOrCb === 'function') {
      return originalEnd(chunkOrCb);
    } else if (typeof encodingOrCb === 'function') {
      return originalEnd(chunkOrCb, encodingOrCb);
    } else if (encodingOrCb !== undefined) {
      return originalEnd(chunkOrCb, encodingOrCb as BufferEncoding, callback);
    } else {
      return originalEnd(chunkOrCb, callback);
    }
  };
  
  next();
}

/**
 * Get current metrics
 */
export function getMetrics(): Record<string, any> {
  const uptime = Date.now() - metrics.lastReset;
  const requestsPerSecond = metrics.totalRequests / (uptime / 1000) || 0;
  
  // Calculate slowest endpoints
  const slowestEndpoints = Object.entries(metrics.endpoints)
    .map(([endpoint, data]) => ({
      endpoint,
      avgTime: data.totalTime / data.count,
      count: data.count,
      errorRate: (data.errors / data.count) * 100,
    }))
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 10);
  
  return {
    uptime: `${Math.floor(uptime / 1000)}s`,
    requests: {
      total: metrics.totalRequests,
      perSecond: requestsPerSecond.toFixed(2),
      errors: metrics.totalErrors,
      errorRate: ((metrics.totalErrors / metrics.totalRequests) * 100 || 0).toFixed(2) + '%',
    },
    responseTime: {
      avg: `${metrics.avgResponseTime.toFixed(2)}ms`,
      p95: `${metrics.p95ResponseTime.toFixed(2)}ms`,
      p99: `${metrics.p99ResponseTime.toFixed(2)}ms`,
    },
    statusCodes: metrics.statusCodes,
    slowestEndpoints,
    memory: {
      heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)}MB`,
      rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`,
    },
  };
}

/**
 * Reset metrics
 */
export function resetMetrics(): void {
  metrics.totalRequests = 0;
  metrics.totalErrors = 0;
  metrics.avgResponseTime = 0;
  metrics.p95ResponseTime = 0;
  metrics.p99ResponseTime = 0;
  metrics.responseTimes = [];
  metrics.statusCodes = {};
  metrics.endpoints = {};
  metrics.lastReset = Date.now();
}

/**
 * Metrics endpoint handler
 */
export function metricsHandler(req: Request, res: Response): void {
  res.json({
    success: true,
    data: getMetrics(),
  });
}
