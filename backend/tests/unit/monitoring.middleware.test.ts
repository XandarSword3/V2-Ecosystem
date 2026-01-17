/**
 * Monitoring Middleware Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  requestTiming,
  getMetrics,
  resetMetrics,
} from '../../src/middleware/monitoring.middleware.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Monitoring Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    resetMetrics();
    
    mockReq = {
      method: 'GET',
      path: '/api/test',
      route: { path: '/test' },
      requestId: 'test-request-id',
    };
    
    const originalEnd = vi.fn();
    mockRes = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: originalEnd,
    };
    
    mockNext = vi.fn();
  });

  describe('requestTiming', () => {
    it('should call next', () => {
      requestTiming(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should override res.end to capture timing', () => {
      const originalEnd = mockRes.end;
      
      requestTiming(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.end).not.toBe(originalEnd);
    });

    it('should set X-Response-Time header when response ends', () => {
      requestTiming(mockReq as Request, mockRes as Response, mockNext);
      
      // Simulate response ending
      (mockRes.end as any)();
      
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Response-Time',
        expect.stringMatching(/\d+\.\d+ms/)
      );
    });

    it('should update metrics when response ends', () => {
      requestTiming(mockReq as Request, mockRes as Response, mockNext);
      
      // Simulate response ending
      (mockRes.end as any)();
      
      const metrics = getMetrics();
      expect(metrics.requests.total).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics object with required fields', () => {
      const metrics = getMetrics();
      
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('requests');
      expect(metrics).toHaveProperty('responseTime');
      expect(metrics).toHaveProperty('statusCodes');
      expect(metrics).toHaveProperty('memory');
    });

    it('should include request statistics', () => {
      const metrics = getMetrics();
      
      expect(metrics.requests).toHaveProperty('total');
      expect(metrics.requests).toHaveProperty('perSecond');
      expect(metrics.requests).toHaveProperty('errors');
      expect(metrics.requests).toHaveProperty('errorRate');
    });

    it('should include response time percentiles', () => {
      const metrics = getMetrics();
      
      expect(metrics.responseTime).toHaveProperty('avg');
      expect(metrics.responseTime).toHaveProperty('p95');
      expect(metrics.responseTime).toHaveProperty('p99');
    });

    it('should include memory usage', () => {
      const metrics = getMetrics();
      
      expect(metrics.memory).toHaveProperty('heapUsed');
      expect(metrics.memory).toHaveProperty('heapTotal');
      expect(metrics.memory).toHaveProperty('rss');
      expect(metrics.memory.heapUsed).toMatch(/\d+\.\d+MB/);
    });

    it('should include slowest endpoints list', () => {
      const metrics = getMetrics();
      
      expect(metrics).toHaveProperty('slowestEndpoints');
      expect(Array.isArray(metrics.slowestEndpoints)).toBe(true);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial values', () => {
      // Simulate some activity
      requestTiming(mockReq as Request, mockRes as Response, mockNext);
      (mockRes.end as any)();
      
      let metrics = getMetrics();
      expect(metrics.requests.total).toBe(1);
      
      // Reset
      resetMetrics();
      
      metrics = getMetrics();
      expect(metrics.requests.total).toBe(0);
    });

    it('should reset uptime counter', async () => {
      const beforeReset = getMetrics();
      
      // Wait a tiny bit for uptime to increase
      await new Promise(r => setTimeout(r, 50));
      
      resetMetrics();
      
      const afterReset = getMetrics();
      // Uptime should be near zero after reset
      expect(parseFloat(afterReset.uptime)).toBeLessThan(1);
    });
  });

  describe('metrics accuracy', () => {
    it('should track multiple requests', () => {
      for (let i = 0; i < 5; i++) {
        const req = { ...mockReq, path: `/api/test${i}` };
        const res = {
          statusCode: 200,
          setHeader: vi.fn(),
          end: vi.fn(),
        };
        
        requestTiming(req as Request, res as Response, mockNext);
        (res.end as any)();
      }
      
      const metrics = getMetrics();
      expect(metrics.requests.total).toBe(5);
    });

    it('should track error status codes', () => {
      const res = {
        statusCode: 500,
        setHeader: vi.fn(),
        end: vi.fn(),
      };
      
      requestTiming(mockReq as Request, res as Response, mockNext);
      (res.end as any)();
      
      const metrics = getMetrics();
      expect(metrics.requests.errors).toBe(1);
      expect(metrics.statusCodes['5xx']).toBe(1);
    });

    it('should group status codes correctly', () => {
      const statuses = [200, 201, 400, 404, 500];
      
      for (const status of statuses) {
        const res = {
          statusCode: status,
          setHeader: vi.fn(),
          end: vi.fn(),
        };
        
        requestTiming(mockReq as Request, res as Response, mockNext);
        (res.end as any)();
      }
      
      const metrics = getMetrics();
      expect(metrics.statusCodes['2xx']).toBe(2);
      expect(metrics.statusCodes['4xx']).toBe(2);
      expect(metrics.statusCodes['5xx']).toBe(1);
    });
  });
});
