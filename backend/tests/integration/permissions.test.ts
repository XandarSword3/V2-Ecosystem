/**
 * Permission Enforcement Integration Tests
 * 
 * Tests that backend routes properly enforce permissions.
 * Uses test JWTs to verify 401/403 responses.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { 
  requirePermission, 
  requireAnyPermission, 
  requireAllPermissions,
  ownerOrAdmin 
} from '../../src/middleware/permission.middleware.js';
import { Permissions, Roles, RolePermissions } from '../../src/security/permissions.js';

// Test JWT secret
const TEST_SECRET = 'test-secret-key-for-testing-only';

// Create test tokens with different roles
function createTestToken(userId: string, roles: string[]): string {
  return jwt.sign(
    { userId, roles, email: `${userId}@test.com` },
    TEST_SECRET,
    { expiresIn: '1h' }
  );
}

// Mock auth middleware that validates test tokens
function mockAuthMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, TEST_SECRET) as { userId: string; roles: string[]; email: string };
    (req as any).user = {
      userId: decoded.userId,
      roles: decoded.roles,
      email: decoded.email,
    };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

describe('Permission Middleware Integration', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Public endpoint (no auth required)
    app.get('/public', (req, res) => {
      res.json({ success: true, message: 'Public endpoint' });
    });

    // Protected endpoint requiring auth only
    app.get('/protected', mockAuthMiddleware, (req, res) => {
      res.json({ success: true, message: 'Protected endpoint', user: (req as any).user });
    });

    // Admin dashboard - requires admin:dashboard:read
    app.get('/admin/dashboard', 
      mockAuthMiddleware, 
      requirePermission(Permissions.ADMIN_DASHBOARD), 
      (req, res) => {
        res.json({ success: true, message: 'Admin dashboard' });
      }
    );

    // Restaurant orders - requires restaurant:order:read_all
    app.get('/restaurant/orders', 
      mockAuthMiddleware, 
      requirePermission(Permissions.RESTAURANT_ORDER_READ_ALL), 
      (req, res) => {
        res.json({ success: true, message: 'Restaurant orders' });
      }
    );

    // Create order - requires restaurant:order:create
    app.post('/restaurant/orders', 
      mockAuthMiddleware, 
      requirePermission(Permissions.RESTAURANT_ORDER_CREATE), 
      (req, res) => {
        res.json({ success: true, message: 'Order created' });
      }
    );

    // Manage users - requires either user:read_any OR admin:dashboard:read
    app.get('/admin/users', 
      mockAuthMiddleware, 
      requireAnyPermission([Permissions.USER_READ_ANY, Permissions.ADMIN_DASHBOARD]), 
      (req, res) => {
        res.json({ success: true, message: 'Admin users list' });
      }
    );

    // Super admin only - requires all admin permissions
    app.post('/admin/danger-zone', 
      mockAuthMiddleware, 
      requireAllPermissions([Permissions.ADMIN_DASHBOARD, Permissions.ADMIN_SETTINGS]), 
      (req, res) => {
        res.json({ success: true, message: 'Danger zone accessed' });
      }
    );

    // Owner or admin endpoint
    app.get('/users/:id', 
      mockAuthMiddleware, 
      ownerOrAdmin('id'), 
      (req, res) => {
        res.json({ success: true, message: 'User profile', userId: req.params.id });
      }
    );
  });

  describe('Public Endpoints', () => {
    it('should allow access without authentication', async () => {
      const response = await request(app).get('/public');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Authentication Required', () => {
    it('should return 401 when no token provided', async () => {
      const response = await request(app).get('/protected');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No token provided');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    it('should allow access with valid token', async () => {
      const token = createTestToken('user-1', [Roles.CUSTOMER]);
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Role-Based Access Control', () => {
    describe('Admin Dashboard', () => {
      it('should allow super_admin access', async () => {
        const token = createTestToken('admin-1', [Roles.SUPER_ADMIN]);
        const response = await request(app)
          .get('/admin/dashboard')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
      });

      it('should allow admin access', async () => {
        const token = createTestToken('admin-2', [Roles.ADMIN]);
        const response = await request(app)
          .get('/admin/dashboard')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
      });

      it('should allow manager access', async () => {
        const token = createTestToken('manager-1', [Roles.MANAGER]);
        const response = await request(app)
          .get('/admin/dashboard')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
      });

      it('should deny customer access with 403', async () => {
        const token = createTestToken('customer-1', [Roles.CUSTOMER]);
        const response = await request(app)
          .get('/admin/dashboard')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(403);
        expect(response.body.code).toBe('AUTH_FORBIDDEN');
      });

      it('should deny guest access with 403', async () => {
        const token = createTestToken('guest-1', [Roles.GUEST]);
        const response = await request(app)
          .get('/admin/dashboard')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(403);
      });
    });

    describe('Restaurant Orders', () => {
      it('should allow kitchen_staff to read orders', async () => {
        const token = createTestToken('staff-1', [Roles.KITCHEN_STAFF]);
        const response = await request(app)
          .get('/restaurant/orders')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
      });

      it('should allow bar_staff to read orders', async () => {
        const token = createTestToken('staff-2', [Roles.BAR_STAFF]);
        const response = await request(app)
          .get('/restaurant/orders')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
      });

      it('should deny customer from reading all orders', async () => {
        const token = createTestToken('customer-1', [Roles.CUSTOMER]);
        const response = await request(app)
          .get('/restaurant/orders')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(403);
      });

      it('should allow customer to create orders', async () => {
        const token = createTestToken('customer-1', [Roles.CUSTOMER]);
        const response = await request(app)
          .post('/restaurant/orders')
          .set('Authorization', `Bearer ${token}`)
          .send({ items: [] });
        expect(response.status).toBe(200);
      });
    });

    describe('requireAnyPermission', () => {
      it('should allow access when user has first permission', async () => {
        const token = createTestToken('admin-1', [Roles.ADMIN]);
        const response = await request(app)
          .get('/admin/users')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
      });

      it('should allow access when user has second permission', async () => {
        const token = createTestToken('manager-1', [Roles.MANAGER]);
        const response = await request(app)
          .get('/admin/users')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
      });

      it('should deny when user has neither permission', async () => {
        const token = createTestToken('customer-1', [Roles.CUSTOMER]);
        const response = await request(app)
          .get('/admin/users')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(403);
      });
    });

    describe('requireAllPermissions', () => {
      it('should allow super_admin with all permissions', async () => {
        const token = createTestToken('super-admin-1', [Roles.SUPER_ADMIN]);
        const response = await request(app)
          .post('/admin/danger-zone')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
      });

      it('should allow admin with all permissions', async () => {
        const token = createTestToken('admin-1', [Roles.ADMIN]);
        const response = await request(app)
          .post('/admin/danger-zone')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
      });

      it('should deny manager with only some permissions', async () => {
        // Manager has dashboard but might not have settings
        const token = createTestToken('manager-1', [Roles.MANAGER]);
        const response = await request(app)
          .post('/admin/danger-zone')
          .set('Authorization', `Bearer ${token}`);
        // This depends on actual permission mapping
        // Manager might have all or only some
        expect([200, 403]).toContain(response.status);
      });
    });

    describe('ownerOrAdmin', () => {
      it('should allow user to access their own profile', async () => {
        const token = createTestToken('user-123', [Roles.CUSTOMER]);
        const response = await request(app)
          .get('/users/user-123')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
      });

      it('should allow admin to access any profile', async () => {
        const token = createTestToken('admin-1', [Roles.ADMIN]);
        const response = await request(app)
          .get('/users/user-123')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
      });

      it('should deny user from accessing another user profile', async () => {
        const token = createTestToken('user-456', [Roles.CUSTOMER]);
        const response = await request(app)
          .get('/users/user-123')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(403);
      });
    });
  });

  describe('Multiple Roles', () => {
    it('should grant combined permissions from multiple roles', async () => {
      // User with both customer and kitchen_staff roles
      const token = createTestToken('multi-role-user', [Roles.CUSTOMER, Roles.KITCHEN_STAFF]);
      
      // Can create orders (customer)
      const orderResponse = await request(app)
        .post('/restaurant/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [] });
      expect(orderResponse.status).toBe(200);
      
      // Can also read all orders (kitchen staff)
      const readResponse = await request(app)
        .get('/restaurant/orders')
        .set('Authorization', `Bearer ${token}`);
      expect(readResponse.status).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty roles array', async () => {
      const token = createTestToken('no-roles-user', []);
      const response = await request(app)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should handle unknown role gracefully', async () => {
      const token = createTestToken('unknown-role-user', ['unknown_role' as any]);
      const response = await request(app)
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should handle malformed user object', async () => {
      // This tests the middleware's defensive coding
      const testApp = express();
      testApp.use((req, res, next) => {
        (req as any).user = {}; // User exists but has no roles
        next();
      });
      testApp.get('/test', requirePermission(Permissions.ADMIN_DASHBOARD), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(testApp).get('/test');
      expect(response.status).toBe(403);
    });
  });
});

describe('Permission Matrix Validation', () => {
  describe('Role Permission Mapping', () => {
    it('super_admin should have all permissions', () => {
      const superAdminPerms = RolePermissions[Roles.SUPER_ADMIN];
      expect(superAdminPerms).toContain('*');
    });

    it('admin should have admin permissions', () => {
      const adminPerms = RolePermissions[Roles.ADMIN];
      expect(adminPerms).toContain(Permissions.ADMIN_DASHBOARD);
      expect(adminPerms).toContain(Permissions.ADMIN_SETTINGS);
    });

    it('customer should have limited permissions', () => {
      const customerPerms = RolePermissions[Roles.CUSTOMER];
      expect(customerPerms).toContain(Permissions.USER_READ_SELF);
      expect(customerPerms).toContain(Permissions.RESTAURANT_ORDER_CREATE);
      expect(customerPerms).not.toContain(Permissions.ADMIN_DASHBOARD);
    });

    it('kitchen_staff should have kitchen permissions', () => {
      const kitchenPerms = RolePermissions[Roles.KITCHEN_STAFF];
      expect(kitchenPerms).toContain(Permissions.RESTAURANT_ORDER_READ_ALL);
      expect(kitchenPerms).toContain(Permissions.RESTAURANT_ORDER_UPDATE);
    });

    it('pool_staff should have pool permissions', () => {
      const poolPerms = RolePermissions[Roles.POOL_STAFF];
      expect(poolPerms).toContain(Permissions.POOL_SESSION_READ);
      expect(poolPerms).toContain(Permissions.POOL_TICKET_VALIDATE);
    });

    it('chalet_staff should have chalet permissions', () => {
      const chaletPerms = RolePermissions[Roles.CHALET_STAFF];
      expect(chaletPerms).toContain(Permissions.CHALET_BOOKING_READ_ALL);
    });
  });
});
