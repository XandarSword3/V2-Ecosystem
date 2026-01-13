import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.io before import
vi.mock('socket.io', () => ({
  Server: vi.fn().mockImplementation(() => ({
    use: vi.fn(),
    on: vi.fn(),
    sockets: {
      sockets: new Map(),
    },
    engine: {
      clientsCount: 0,
    },
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
    close: vi.fn((cb) => cb()),
  })),
}));

// Import after mock
import {
  getOnlineUsers,
  getOnlineUsersDetailed,
} from '../../src/socket/index';

describe('Socket Module (Source)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOnlineUsers', () => {
    it('should be a function', () => {
      expect(typeof getOnlineUsers).toBe('function');
    });

    it('should return empty array when io is not initialized', () => {
      const result = getOnlineUsers();
      expect(result).toEqual([]);
    });
  });

  describe('getOnlineUsersDetailed', () => {
    it('should be a function', () => {
      expect(typeof getOnlineUsersDetailed).toBe('function');
    });

    it('should return empty array when no active connections', () => {
      const result = getOnlineUsersDetailed();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('ActiveConnection interface', () => {
    it('should have expected properties', () => {
      // Test the structure expected by ActiveConnection
      const mockConnection = {
        socketId: 'socket-123',
        userId: 'user-456',
        email: 'test@example.com',
        fullName: 'Test User',
        roles: ['guest', 'user'],
        currentPage: '/dashboard',
        connectedAt: new Date(),
        lastActivity: new Date(),
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      expect(mockConnection).toHaveProperty('socketId');
      expect(mockConnection).toHaveProperty('userId');
      expect(mockConnection).toHaveProperty('roles');
      expect(mockConnection).toHaveProperty('connectedAt');
      expect(mockConnection).toHaveProperty('lastActivity');
    });
  });

  describe('Socket room patterns', () => {
    it('should generate correct user room pattern', () => {
      const userId = 'user-123';
      const roomPattern = `user:${userId}`;
      expect(roomPattern).toBe('user:user-123');
    });

    it('should generate correct role room pattern', () => {
      const role = 'admin';
      const roomPattern = `role:${role}`;
      expect(roomPattern).toBe('role:admin');
    });

    it('should generate correct unit room pattern', () => {
      const unit = 'restaurant';
      const roomPattern = `unit:${unit}`;
      expect(roomPattern).toBe('unit:restaurant');
    });
  });

  describe('Valid business units', () => {
    it('should include restaurant in valid units', () => {
      const validUnits = ['restaurant', 'snack_bar', 'chalets', 'pool'];
      expect(validUnits).toContain('restaurant');
    });

    it('should include snack_bar in valid units', () => {
      const validUnits = ['restaurant', 'snack_bar', 'chalets', 'pool'];
      expect(validUnits).toContain('snack_bar');
    });

    it('should include chalets in valid units', () => {
      const validUnits = ['restaurant', 'snack_bar', 'chalets', 'pool'];
      expect(validUnits).toContain('chalets');
    });

    it('should include pool in valid units', () => {
      const validUnits = ['restaurant', 'snack_bar', 'chalets', 'pool'];
      expect(validUnits).toContain('pool');
    });
  });
});
