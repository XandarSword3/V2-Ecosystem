/**
 * WebSocket Event Unit Tests
 * 
 * Tests for Socket.io connection, room management, and event emission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket storage
let mockSockets: Map<string, MockSocket> = new Map();
let mockRooms: Map<string, Set<string>> = new Map();
let mockEmittedEvents: Array<{ room: string; event: string; data: any }> = [];

interface MockSocket {
  id: string;
  userId?: string;
  roles?: string[];
  unit?: string;
  rooms: Set<string>;
  connected: boolean;
  handshake: {
    auth: { token?: string };
    headers: Record<string, string>;
  };
}

// Mock IO
const mockIO = {
  to: (room: string) => ({
    emit: (event: string, data: any) => {
      mockEmittedEvents.push({ room, event, data });
    },
  }),
  emit: (event: string, data: any) => {
    mockEmittedEvents.push({ room: 'broadcast', event, data });
  },
};

// Reset mocks before each test
beforeEach(() => {
  mockSockets.clear();
  mockRooms.clear();
  mockEmittedEvents = [];
});

describe('Socket Connection Authentication', () => {
  function authenticateSocket(socket: MockSocket): {
    authenticated: boolean;
    userId?: string;
    roles?: string[];
    error?: string;
  } {
    const token = socket.handshake.auth?.token;
    
    if (!token) {
      return { authenticated: false, error: 'No token provided' };
    }

    // Simulate JWT verification
    if (token === 'valid_token') {
      return { 
        authenticated: true, 
        userId: 'user_123',
        roles: ['customer'],
      };
    }

    if (token === 'admin_token') {
      return { 
        authenticated: true, 
        userId: 'admin_456',
        roles: ['admin', 'super_admin'],
      };
    }

    if (token === 'staff_token') {
      return { 
        authenticated: true, 
        userId: 'staff_789',
        roles: ['restaurant_staff'],
      };
    }

    if (token === 'expired_token') {
      return { authenticated: false, error: 'Token expired' };
    }

    return { authenticated: false, error: 'Invalid token' };
  }

  it('should authenticate with valid token', () => {
    const socket: MockSocket = {
      id: 'socket_1',
      rooms: new Set(),
      connected: true,
      handshake: { auth: { token: 'valid_token' }, headers: {} },
    };

    const result = authenticateSocket(socket);
    expect(result.authenticated).toBe(true);
    expect(result.userId).toBe('user_123');
    expect(result.roles).toContain('customer');
  });

  it('should reject missing token', () => {
    const socket: MockSocket = {
      id: 'socket_2',
      rooms: new Set(),
      connected: true,
      handshake: { auth: {}, headers: {} },
    };

    const result = authenticateSocket(socket);
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('No token provided');
  });

  it('should reject expired token', () => {
    const socket: MockSocket = {
      id: 'socket_3',
      rooms: new Set(),
      connected: true,
      handshake: { auth: { token: 'expired_token' }, headers: {} },
    };

    const result = authenticateSocket(socket);
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Token expired');
  });

  it('should reject invalid token', () => {
    const socket: MockSocket = {
      id: 'socket_4',
      rooms: new Set(),
      connected: true,
      handshake: { auth: { token: 'invalid_token' }, headers: {} },
    };

    const result = authenticateSocket(socket);
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe('Invalid token');
  });
});

describe('Room Management', () => {
  function joinRoom(socketId: string, room: string): boolean {
    const socket = mockSockets.get(socketId);
    if (!socket || !socket.connected) return false;

    socket.rooms.add(room);
    
    if (!mockRooms.has(room)) {
      mockRooms.set(room, new Set());
    }
    mockRooms.get(room)!.add(socketId);
    
    return true;
  }

  function leaveRoom(socketId: string, room: string): boolean {
    const socket = mockSockets.get(socketId);
    if (!socket) return false;

    socket.rooms.delete(room);
    mockRooms.get(room)?.delete(socketId);
    
    return true;
  }

  function getRoomMembers(room: string): string[] {
    return Array.from(mockRooms.get(room) || []);
  }

  beforeEach(() => {
    mockSockets.set('socket_1', {
      id: 'socket_1',
      userId: 'user_1',
      roles: ['customer'],
      rooms: new Set(),
      connected: true,
      handshake: { auth: {}, headers: {} },
    });
    mockSockets.set('socket_2', {
      id: 'socket_2',
      userId: 'user_2',
      roles: ['admin'],
      rooms: new Set(),
      connected: true,
      handshake: { auth: {}, headers: {} },
    });
  });

  it('should join room successfully', () => {
    const result = joinRoom('socket_1', 'role:customer');
    expect(result).toBe(true);
    expect(mockSockets.get('socket_1')!.rooms.has('role:customer')).toBe(true);
  });

  it('should track room members', () => {
    joinRoom('socket_1', 'notifications');
    joinRoom('socket_2', 'notifications');

    const members = getRoomMembers('notifications');
    expect(members).toHaveLength(2);
    expect(members).toContain('socket_1');
    expect(members).toContain('socket_2');
  });

  it('should leave room successfully', () => {
    joinRoom('socket_1', 'test_room');
    expect(getRoomMembers('test_room')).toHaveLength(1);

    leaveRoom('socket_1', 'test_room');
    expect(getRoomMembers('test_room')).toHaveLength(0);
  });

  it('should handle leaving non-joined room', () => {
    const result = leaveRoom('socket_1', 'never_joined');
    expect(result).toBe(true); // Should not error
  });

  it('should fail join for disconnected socket', () => {
    mockSockets.get('socket_1')!.connected = false;
    const result = joinRoom('socket_1', 'test_room');
    expect(result).toBe(false);
  });
});

describe('Role-Based Room Access', () => {
  function joinRoleRooms(socket: MockSocket): string[] {
    const joinedRooms: string[] = [];

    // Join user-specific room
    if (socket.userId) {
      const userRoom = `user:${socket.userId}`;
      socket.rooms.add(userRoom);
      joinedRooms.push(userRoom);
    }

    // Join role-based rooms
    for (const role of socket.roles || []) {
      const roleRoom = `role:${role}`;
      socket.rooms.add(roleRoom);
      joinedRooms.push(roleRoom);
    }

    // Join unit-based room (for staff)
    if (socket.unit) {
      const unitRoom = `unit:${socket.unit}`;
      socket.rooms.add(unitRoom);
      joinedRooms.push(unitRoom);
    }

    return joinedRooms;
  }

  it('should join user-specific room', () => {
    const socket: MockSocket = {
      id: 'socket_1',
      userId: 'user_123',
      roles: ['customer'],
      rooms: new Set(),
      connected: true,
      handshake: { auth: {}, headers: {} },
    };

    const rooms = joinRoleRooms(socket);
    expect(rooms).toContain('user:user_123');
    expect(socket.rooms.has('user:user_123')).toBe(true);
  });

  it('should join multiple role rooms', () => {
    const socket: MockSocket = {
      id: 'socket_2',
      userId: 'admin_456',
      roles: ['admin', 'super_admin'],
      rooms: new Set(),
      connected: true,
      handshake: { auth: {}, headers: {} },
    };

    const rooms = joinRoleRooms(socket);
    expect(rooms).toContain('role:admin');
    expect(rooms).toContain('role:super_admin');
  });

  it('should join unit room for staff', () => {
    const socket: MockSocket = {
      id: 'socket_3',
      userId: 'staff_789',
      roles: ['restaurant_staff'],
      unit: 'restaurant',
      rooms: new Set(),
      connected: true,
      handshake: { auth: {}, headers: {} },
    };

    const rooms = joinRoleRooms(socket);
    expect(rooms).toContain('unit:restaurant');
  });
});

describe('Event Emission', () => {
  function emitToRoom(room: string, event: string, data: any): void {
    mockIO.to(room).emit(event, data);
  }

  function emitToUser(userId: string, event: string, data: any): void {
    emitToRoom(`user:${userId}`, event, data);
  }

  function emitToRole(role: string, event: string, data: any): void {
    emitToRoom(`role:${role}`, event, data);
  }

  function emitToUnit(unit: string, event: string, data: any): void {
    emitToRoom(`unit:${unit}`, event, data);
  }

  function broadcastAll(event: string, data: any): void {
    mockIO.emit(event, data);
  }

  it('should emit to specific room', () => {
    emitToRoom('room_1', 'test_event', { message: 'Hello' });

    expect(mockEmittedEvents).toHaveLength(1);
    expect(mockEmittedEvents[0].room).toBe('room_1');
    expect(mockEmittedEvents[0].event).toBe('test_event');
    expect(mockEmittedEvents[0].data.message).toBe('Hello');
  });

  it('should emit to user room', () => {
    emitToUser('user_123', 'notification', { text: 'You have a message' });

    expect(mockEmittedEvents[0].room).toBe('user:user_123');
    expect(mockEmittedEvents[0].event).toBe('notification');
  });

  it('should emit to role room', () => {
    emitToRole('admin', 'stats:update', { orders: 50 });

    expect(mockEmittedEvents[0].room).toBe('role:admin');
    expect(mockEmittedEvents[0].event).toBe('stats:update');
  });

  it('should emit to unit room', () => {
    emitToUnit('restaurant', 'order:new', { orderId: 'ord_123' });

    expect(mockEmittedEvents[0].room).toBe('unit:restaurant');
    expect(mockEmittedEvents[0].event).toBe('order:new');
  });

  it('should broadcast to all', () => {
    broadcastAll('server:announcement', { message: 'Maintenance in 5 minutes' });

    expect(mockEmittedEvents[0].room).toBe('broadcast');
    expect(mockEmittedEvents[0].event).toBe('server:announcement');
  });
});

describe('Order Event Emission', () => {
  function emitOrderEvent(order: {
    id: string;
    status: string;
    unit: string;
    customerId?: string;
  }): void {
    const event = `order:${order.status}`;
    const data = { orderId: order.id, status: order.status };

    // Emit to unit (staff)
    mockIO.to(`unit:${order.unit}`).emit(event, data);

    // Emit to admins
    mockIO.to('role:admin').emit(event, data);
    mockIO.to('role:super_admin').emit(event, data);

    // Emit to customer if authenticated
    if (order.customerId) {
      mockIO.to(`user:${order.customerId}`).emit(event, data);
    }
  }

  it('should emit new order to unit', () => {
    emitOrderEvent({
      id: 'ord_123',
      status: 'new',
      unit: 'restaurant',
    });

    const unitEvent = mockEmittedEvents.find(e => e.room === 'unit:restaurant');
    expect(unitEvent).toBeDefined();
    expect(unitEvent!.event).toBe('order:new');
  });

  it('should emit order update to admins', () => {
    emitOrderEvent({
      id: 'ord_123',
      status: 'preparing',
      unit: 'restaurant',
    });

    const adminEvent = mockEmittedEvents.find(e => e.room === 'role:admin');
    const superAdminEvent = mockEmittedEvents.find(e => e.room === 'role:super_admin');
    
    expect(adminEvent).toBeDefined();
    expect(superAdminEvent).toBeDefined();
  });

  it('should emit order update to customer', () => {
    emitOrderEvent({
      id: 'ord_123',
      status: 'ready',
      unit: 'restaurant',
      customerId: 'cust_456',
    });

    const customerEvent = mockEmittedEvents.find(e => e.room === 'user:cust_456');
    expect(customerEvent).toBeDefined();
    expect(customerEvent!.event).toBe('order:ready');
  });
});

describe('Pool Event Emission', () => {
  function emitPoolEvent(eventType: 'ticket:new' | 'entry' | 'exit' | 'capacity', data: any): void {
    const event = `pool:${eventType}`;

    // Emit to pool staff
    mockIO.to('unit:pool').emit(event, data);

    // Emit to admins
    mockIO.to('role:admin').emit(event, data);

    // Capacity updates are interesting to admins only
    if (eventType === 'capacity') {
      mockIO.to('role:super_admin').emit(event, data);
    }
  }

  it('should emit ticket purchase to pool unit', () => {
    emitPoolEvent('ticket:new', { ticketId: 'tkt_123' });

    const poolEvent = mockEmittedEvents.find(e => e.room === 'unit:pool');
    expect(poolEvent).toBeDefined();
    expect(poolEvent!.event).toBe('pool:ticket:new');
  });

  it('should emit entry to pool unit', () => {
    emitPoolEvent('entry', { ticketId: 'tkt_123', guestCount: 3 });

    const poolEvent = mockEmittedEvents.find(e => e.room === 'unit:pool');
    expect(poolEvent).toBeDefined();
    expect(poolEvent!.event).toBe('pool:entry');
  });

  it('should emit capacity update to admins', () => {
    emitPoolEvent('capacity', { current: 45, max: 50 });

    const adminEvent = mockEmittedEvents.find(e => e.room === 'role:admin');
    const superAdminEvent = mockEmittedEvents.find(e => e.room === 'role:super_admin');
    
    expect(adminEvent).toBeDefined();
    expect(superAdminEvent).toBeDefined();
  });
});

describe('Connection Cleanup', () => {
  function handleDisconnect(socketId: string): {
    removed: boolean;
    roomsLeft: string[];
  } {
    const socket = mockSockets.get(socketId);
    if (!socket) {
      return { removed: false, roomsLeft: [] };
    }

    const roomsLeft = Array.from(socket.rooms);

    // Remove from all rooms
    for (const room of socket.rooms) {
      mockRooms.get(room)?.delete(socketId);
    }

    // Remove socket
    mockSockets.delete(socketId);

    return { removed: true, roomsLeft };
  }

  beforeEach(() => {
    const socket: MockSocket = {
      id: 'socket_cleanup',
      userId: 'user_1',
      roles: ['customer'],
      rooms: new Set(['user:user_1', 'role:customer', 'notifications']),
      connected: true,
      handshake: { auth: {}, headers: {} },
    };
    mockSockets.set('socket_cleanup', socket);

    mockRooms.set('user:user_1', new Set(['socket_cleanup']));
    mockRooms.set('role:customer', new Set(['socket_cleanup']));
    mockRooms.set('notifications', new Set(['socket_cleanup']));
  });

  it('should remove socket on disconnect', () => {
    const result = handleDisconnect('socket_cleanup');
    
    expect(result.removed).toBe(true);
    expect(mockSockets.has('socket_cleanup')).toBe(false);
  });

  it('should leave all rooms on disconnect', () => {
    const result = handleDisconnect('socket_cleanup');
    
    expect(result.roomsLeft).toContain('user:user_1');
    expect(result.roomsLeft).toContain('role:customer');
    expect(mockRooms.get('user:user_1')?.has('socket_cleanup')).toBeFalsy();
  });

  it('should handle non-existent socket', () => {
    const result = handleDisconnect('nonexistent');
    expect(result.removed).toBe(false);
  });
});

describe('Online User Tracking', () => {
  function getOnlineUsers(): Array<{ id: string; roles: string[] }> {
    return Array.from(mockSockets.values())
      .filter(s => s.connected && s.userId)
      .map(s => ({
        id: s.userId!,
        roles: s.roles || [],
      }));
  }

  function getOnlineCount(): { total: number; byRole: Record<string, number> } {
    const users = getOnlineUsers();
    const byRole: Record<string, number> = {};

    for (const user of users) {
      for (const role of user.roles) {
        byRole[role] = (byRole[role] || 0) + 1;
      }
    }

    return { total: users.length, byRole };
  }

  beforeEach(() => {
    mockSockets.set('s1', {
      id: 's1', userId: 'u1', roles: ['customer'],
      rooms: new Set(), connected: true,
      handshake: { auth: {}, headers: {} },
    });
    mockSockets.set('s2', {
      id: 's2', userId: 'u2', roles: ['customer'],
      rooms: new Set(), connected: true,
      handshake: { auth: {}, headers: {} },
    });
    mockSockets.set('s3', {
      id: 's3', userId: 'u3', roles: ['admin'],
      rooms: new Set(), connected: true,
      handshake: { auth: {}, headers: {} },
    });
    mockSockets.set('s4', {
      id: 's4', userId: 'u4', roles: ['restaurant_staff'],
      rooms: new Set(), connected: true,
      handshake: { auth: {}, headers: {} },
    });
  });

  it('should count total online users', () => {
    const stats = getOnlineCount();
    expect(stats.total).toBe(4);
  });

  it('should count users by role', () => {
    const stats = getOnlineCount();
    expect(stats.byRole['customer']).toBe(2);
    expect(stats.byRole['admin']).toBe(1);
    expect(stats.byRole['restaurant_staff']).toBe(1);
  });

  it('should not count disconnected users', () => {
    mockSockets.get('s1')!.connected = false;
    
    const stats = getOnlineCount();
    expect(stats.total).toBe(3);
    expect(stats.byRole['customer']).toBe(1);
  });

  it('should return user list', () => {
    const users = getOnlineUsers();
    expect(users).toHaveLength(4);
    expect(users.map(u => u.id)).toContain('u1');
  });
});
