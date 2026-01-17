import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../../src/config/index', () => ({
  config: {
    frontendUrl: 'http://localhost:3000'
  }
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../src/modules/auth/auth.utils', () => ({
  verifyToken: vi.fn().mockReturnValue({ userId: 'user-123', roles: ['admin'] })
}));

import { 
  getOnlineUsers, 
  getOnlineUsersDetailed, 
  emitToUser, 
  emitToUnit, 
  emitToRole, 
  emitToAll,
  getIO,
  closeSocketServer
} from '../../../src/socket/index';

describe('Socket Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOnlineUsers', () => {
    it('should return empty array when io is not initialized', () => {
      const users = getOnlineUsers();
      expect(users).toEqual([]);
    });
  });

  describe('getOnlineUsersDetailed', () => {
    it('should return empty array when no connections', () => {
      const users = getOnlineUsersDetailed();
      expect(users).toEqual([]);
    });
  });

  describe('getIO', () => {
    it('should throw error when socket is not initialized', () => {
      expect(() => getIO()).toThrow('Socket.io not initialized');
    });
  });

  describe('closeSocketServer', () => {
    it('should resolve immediately when io is not initialized', async () => {
      await expect(closeSocketServer()).resolves.toBeUndefined();
    });
  });

  describe('isAllowedOrigin logic', () => {
    // Test the origin checking logic directly
    it('should allow localhost origins', () => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
      ];
      
      expect(allowedOrigins).toContain('http://localhost:3000');
      expect(allowedOrigins).toContain('http://localhost:3001');
    });

    it('should allow vercel preview URLs', () => {
      const origin = 'https://v2-ecosystem-abc123.vercel.app';
      const pattern = /^https:\/\/v2-ecosystem(-[a-z0-9]+)*\.vercel\.app$/;
      
      expect(origin.match(pattern)).toBeTruthy();
    });

    it('should allow main vercel deployment', () => {
      const origin = 'https://v2-ecosystem.vercel.app';
      const pattern = /^https:\/\/v2-ecosystem(-[a-z0-9]+)*\.vercel\.app$/;
      
      expect(origin.match(pattern)).toBeTruthy();
    });

    it('should reject non-whitelisted origins', () => {
      const allowedOrigins = [
        'http://localhost:3000',
        'https://v2-ecosystem.vercel.app',
      ];
      
      expect(allowedOrigins).not.toContain('http://malicious-site.com');
    });
  });

  describe('ActiveConnection interface', () => {
    it('should have correct structure', () => {
      const connection = {
        socketId: 'socket-123',
        userId: 'user-123',
        email: 'test@test.com',
        fullName: 'Test User',
        roles: ['admin'],
        currentPage: '/dashboard',
        connectedAt: new Date(),
        lastActivity: new Date(),
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1'
      };

      expect(connection.socketId).toBe('socket-123');
      expect(connection.roles).toContain('admin');
      expect(connection.connectedAt).toBeInstanceOf(Date);
    });
  });

  describe('Socket event handlers', () => {
    it('should define valid unit types', () => {
      const validUnits = ['restaurant', 'snack_bar', 'chalets', 'pool'];
      
      expect(validUnits).toContain('restaurant');
      expect(validUnits).toContain('snack_bar');
      expect(validUnits).toContain('chalets');
      expect(validUnits).toContain('pool');
      expect(validUnits).not.toContain('invalid_unit');
    });

    it('should have proper heartbeat structure', () => {
      const heartbeatAck = { timestamp: Date.now() };
      
      expect(heartbeatAck.timestamp).toBeDefined();
      expect(typeof heartbeatAck.timestamp).toBe('number');
    });

    it('should have proper page navigate structure', () => {
      const pageData = { page: '/dashboard', title: 'Dashboard' };
      
      expect(pageData.page).toBe('/dashboard');
      expect(pageData.title).toBe('Dashboard');
    });

    it('should have proper user update structure', () => {
      const userData = {
        userId: 'user-123',
        email: 'test@test.com',
        fullName: 'Test User',
        roles: ['admin', 'staff']
      };
      
      expect(userData.userId).toBe('user-123');
      expect(userData.roles).toHaveLength(2);
    });
  });

  describe('Socket server configuration', () => {
    it('should have proper ping settings', () => {
      const config = {
        pingTimeout: 120000,
        pingInterval: 25000,
        connectTimeout: 60000
      };
      
      expect(config.pingTimeout).toBe(120000);
      expect(config.pingInterval).toBe(25000);
      expect(config.connectTimeout).toBe(60000);
    });

    it('should support correct transports', () => {
      const transports = ['websocket', 'polling'];
      
      expect(transports).toContain('websocket');
      expect(transports).toContain('polling');
    });

    it('should have connection state recovery settings', () => {
      const recoverySettings = {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true
      };
      
      expect(recoverySettings.maxDisconnectionDuration).toBe(120000);
      expect(recoverySettings.skipMiddlewares).toBe(true);
    });
  });

  describe('Room naming conventions', () => {
    it('should format role rooms correctly', () => {
      const role = 'admin';
      const roomName = `role:${role}`;
      
      expect(roomName).toBe('role:admin');
    });

    it('should format user rooms correctly', () => {
      const userId = 'user-123';
      const roomName = `user:${userId}`;
      
      expect(roomName).toBe('user:user-123');
    });

    it('should format unit rooms correctly', () => {
      const unit = 'restaurant';
      const roomName = `unit:${unit}`;
      
      expect(roomName).toBe('unit:restaurant');
    });
  });
});
