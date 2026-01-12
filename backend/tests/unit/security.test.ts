/**
 * Security Middleware Unit Tests
 * 
 * Tests for authentication, authorization, and security measures.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock request/response types
interface MockRequest {
  headers: Record<string, string>;
  user?: { userId: string; roles: string[]; permissions: string[] };
  ip?: string;
}

interface MockResponse {
  status: (code: number) => MockResponse;
  json: (data: unknown) => void;
}

describe('JWT Token Validation', () => {
  const JWT_SECRET = 'test-secret-key';

  function verifyToken(token: string): { userId: string; roles: string[] } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as { userId: string; roles: string[] };
    } catch {
      return null;
    }
  }

  it('should verify valid token', () => {
    const token = jwt.sign({ userId: 'user-123', roles: ['customer'] }, JWT_SECRET, { expiresIn: '1h' });
    const result = verifyToken(token);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user-123');
  });

  it('should reject expired token', () => {
    const token = jwt.sign({ userId: 'user-123' }, JWT_SECRET, { expiresIn: '-1h' });
    const result = verifyToken(token);
    expect(result).toBeNull();
  });

  it('should reject token with wrong secret', () => {
    const token = jwt.sign({ userId: 'user-123' }, 'wrong-secret', { expiresIn: '1h' });
    const result = verifyToken(token);
    expect(result).toBeNull();
  });

  it('should reject malformed token', () => {
    const result = verifyToken('not.a.valid.token');
    expect(result).toBeNull();
  });
});

describe('Role-Based Authorization', () => {
  const roleHierarchy: Record<string, string[]> = {
    super_admin: ['admin', 'manager', 'staff', 'customer'],
    admin: ['manager', 'staff', 'customer'],
    manager: ['staff', 'customer'],
    staff: ['customer'],
    customer: []
  };

  function hasRole(userRoles: string[], requiredRole: string): boolean {
    for (const role of userRoles) {
      if (role === requiredRole) return true;
      if (roleHierarchy[role]?.includes(requiredRole)) return true;
    }
    return false;
  }

  function authorize(...allowedRoles: string[]) {
    return (req: MockRequest): boolean => {
      if (!req.user) return false;
      return allowedRoles.some(role => hasRole(req.user!.roles, role));
    };
  }

  it('should allow super_admin access to all roles', () => {
    const checkAccess = authorize('staff');
    const req: MockRequest = { 
      headers: {}, 
      user: { userId: '1', roles: ['super_admin'], permissions: [] } 
    };
    expect(checkAccess(req)).toBe(true);
  });

  it('should deny staff access to admin routes', () => {
    const checkAccess = authorize('admin');
    const req: MockRequest = { 
      headers: {}, 
      user: { userId: '1', roles: ['staff'], permissions: [] } 
    };
    expect(checkAccess(req)).toBe(false);
  });

  it('should allow user with exact matching role', () => {
    const checkAccess = authorize('manager');
    const req: MockRequest = { 
      headers: {}, 
      user: { userId: '1', roles: ['manager'], permissions: [] } 
    };
    expect(checkAccess(req)).toBe(true);
  });

  it('should deny unauthenticated users', () => {
    const checkAccess = authorize('customer');
    const req: MockRequest = { headers: {} };
    expect(checkAccess(req)).toBe(false);
  });

  it('should allow multiple roles', () => {
    const checkAccess = authorize('admin', 'manager');
    const req: MockRequest = { 
      headers: {}, 
      user: { userId: '1', roles: ['manager'], permissions: [] } 
    };
    expect(checkAccess(req)).toBe(true);
  });
});

describe('Permission-Based Authorization', () => {
  function hasPermission(userPermissions: string[], required: string): boolean {
    if (userPermissions.includes('*')) return true; // Superuser
    if (userPermissions.includes(required)) return true;
    
    // Check wildcard permissions (e.g., "orders.*" matches "orders.create")
    const [resource] = required.split('.');
    if (userPermissions.includes(`${resource}.*`)) return true;
    
    return false;
  }

  it('should allow exact permission match', () => {
    expect(hasPermission(['orders.create', 'orders.view'], 'orders.create')).toBe(true);
  });

  it('should allow wildcard permission', () => {
    expect(hasPermission(['orders.*'], 'orders.delete')).toBe(true);
  });

  it('should allow superuser permission', () => {
    expect(hasPermission(['*'], 'anything.you.want')).toBe(true);
  });

  it('should deny missing permission', () => {
    expect(hasPermission(['orders.view'], 'orders.delete')).toBe(false);
  });

  it('should not allow cross-resource wildcards', () => {
    expect(hasPermission(['orders.*'], 'bookings.view')).toBe(false);
  });
});

describe('Rate Limiting Logic', () => {
  interface RateLimitEntry {
    count: number;
    firstRequest: number;
  }

  class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private maxRequests: number;
    private windowMs: number;

    constructor(maxRequests: number = 100, windowMs: number = 900000) {
      this.maxRequests = maxRequests;
      this.windowMs = windowMs;
    }

    isAllowed(key: string): boolean {
      const now = Date.now();
      const entry = this.limits.get(key);

      if (!entry || now - entry.firstRequest > this.windowMs) {
        this.limits.set(key, { count: 1, firstRequest: now });
        return true;
      }

      if (entry.count >= this.maxRequests) {
        return false;
      }

      entry.count++;
      return true;
    }

    getRemainingRequests(key: string): number {
      const entry = this.limits.get(key);
      if (!entry) return this.maxRequests;
      return Math.max(0, this.maxRequests - entry.count);
    }
  }

  it('should allow requests within limit', () => {
    const limiter = new RateLimiter(5, 60000);
    for (let i = 0; i < 5; i++) {
      expect(limiter.isAllowed('user-1')).toBe(true);
    }
  });

  it('should block requests exceeding limit', () => {
    const limiter = new RateLimiter(3, 60000);
    limiter.isAllowed('user-1');
    limiter.isAllowed('user-1');
    limiter.isAllowed('user-1');
    expect(limiter.isAllowed('user-1')).toBe(false);
  });

  it('should track different users separately', () => {
    const limiter = new RateLimiter(2, 60000);
    limiter.isAllowed('user-1');
    limiter.isAllowed('user-1');
    expect(limiter.isAllowed('user-2')).toBe(true);
  });

  it('should report remaining requests', () => {
    const limiter = new RateLimiter(10, 60000);
    limiter.isAllowed('user-1');
    limiter.isAllowed('user-1');
    limiter.isAllowed('user-1');
    expect(limiter.getRemainingRequests('user-1')).toBe(7);
  });
});

describe('Input Sanitization', () => {
  function sanitizeHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  }

  function escapeForSql(input: string): string {
    // Note: This is for demonstration. Always use parameterized queries!
    return input.replace(/'/g, "''");
  }

  it('should strip HTML tags', () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitizeHtml('<b>bold</b>')).toBe('bold');
  });

  it('should handle nested tags', () => {
    expect(sanitizeHtml('<div><p>text</p></div>')).toBe('text');
  });

  it('should escape single quotes for SQL', () => {
    expect(escapeForSql("O'Connor")).toBe("O''Connor");
  });
});

describe('Session Management', () => {
  interface Session {
    id: string;
    userId: string;
    createdAt: number;
    expiresAt: number;
    ipAddress?: string;
    userAgent?: string;
  }

  class SessionManager {
    private sessions: Map<string, Session> = new Map();

    create(userId: string, ttlMs: number = 86400000): Session {
      const session: Session = {
        id: `sess_${Math.random().toString(36).substring(2)}`,
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs
      };
      this.sessions.set(session.id, session);
      return session;
    }

    validate(sessionId: string): Session | null {
      const session = this.sessions.get(sessionId);
      if (!session) return null;
      if (Date.now() > session.expiresAt) {
        this.sessions.delete(sessionId);
        return null;
      }
      return session;
    }

    invalidate(sessionId: string): boolean {
      return this.sessions.delete(sessionId);
    }

    getUserSessions(userId: string): Session[] {
      return Array.from(this.sessions.values())
        .filter(s => s.userId === userId && Date.now() <= s.expiresAt);
    }
  }

  it('should create valid session', () => {
    const manager = new SessionManager();
    const session = manager.create('user-123');
    expect(session.userId).toBe('user-123');
    expect(session.id).toMatch(/^sess_/);
  });

  it('should validate active session', () => {
    const manager = new SessionManager();
    const session = manager.create('user-123');
    expect(manager.validate(session.id)).not.toBeNull();
  });

  it('should reject invalid session', () => {
    const manager = new SessionManager();
    expect(manager.validate('invalid-session-id')).toBeNull();
  });

  it('should invalidate session', () => {
    const manager = new SessionManager();
    const session = manager.create('user-123');
    manager.invalidate(session.id);
    expect(manager.validate(session.id)).toBeNull();
  });
});
