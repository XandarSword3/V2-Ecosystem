import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

interface SocketMock {
  id: string;
  connected: boolean;
  disconnected: boolean;
  auth?: { token?: string };
  io: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function createSocketHarness() {
  const socketHandlers = new Map<string, Set<Handler>>();
  const ioHandlers = new Map<string, Set<Handler>>();

  const on = vi.fn((event: string, handler: Handler) => {
    if (!socketHandlers.has(event)) socketHandlers.set(event, new Set());
    socketHandlers.get(event)!.add(handler);
  });

  const off = vi.fn((event: string, handler?: Handler) => {
    if (!socketHandlers.has(event)) return;
    if (!handler) {
      socketHandlers.delete(event);
      return;
    }
    socketHandlers.get(event)!.delete(handler);
  });

  const ioOn = vi.fn((event: string, handler: Handler) => {
    if (!ioHandlers.has(event)) ioHandlers.set(event, new Set());
    ioHandlers.get(event)!.add(handler);
  });

  const ioOff = vi.fn((event: string, handler?: Handler) => {
    if (!ioHandlers.has(event)) return;
    if (!handler) {
      ioHandlers.delete(event);
      return;
    }
    ioHandlers.get(event)!.delete(handler);
  });

  const socket: SocketMock = {
    id: 'socket-1',
    connected: false,
    disconnected: true,
    auth: {},
    io: {
      on: ioOn,
      off: ioOff,
    },
    on,
    off,
    emit: vi.fn((event: string, ...args: unknown[]) => {
      const maybeCallback = args[args.length - 1];
      if (event === 'join-room' && typeof maybeCallback === 'function') {
        (maybeCallback as (ok: boolean) => void)(true);
      }
    }),
    connect: vi.fn(() => {
      socket.connected = true;
      socket.disconnected = false;
      triggerSocket('connect');
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
      socket.disconnected = true;
      triggerSocket('disconnect', 'io client disconnect');
    }),
  };

  function triggerSocket(event: string, ...args: unknown[]) {
    const handlers = socketHandlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(...args);
    }
  }

  function triggerIo(event: string, ...args: unknown[]) {
    const handlers = ioHandlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(...args);
    }
  }

  return {
    socket,
    triggerSocket,
    triggerIo,
  };
}

const ioMock = vi.hoisted(() => vi.fn());

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

vi.mock('../../src/lib/logger', () => ({
  socketLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

async function loadModule() {
  vi.resetModules();
  return import('../../src/lib/socket');
}

describe('socket hooks', () => {
  beforeEach(() => {
    ioMock.mockReset();
    localStorage.clear();
  });

  it('creates singleton socket, handles connection, room join/leave, and reconnect', async () => {
    const harness = createSocketHarness();
    ioMock.mockReturnValue(harness.socket);
    localStorage.setItem('accessToken', 'socket-token');

    const mod = await loadModule();

    const hook = renderHook(() => mod.useSocket());

    await waitFor(() => expect(hook.result.current.socket).toBeTruthy());
    expect(ioMock).toHaveBeenCalledWith(
      expect.stringContaining('localhost:3005'),
      expect.objectContaining({ auth: { token: 'socket-token' } })
    );

    act(() => {
      harness.triggerSocket('connect');
    });

    await waitFor(() => expect(hook.result.current.isConnected).toBe(true));

    act(() => {
      hook.result.current.joinRoom('room-1');
      hook.result.current.leaveRoom('room-1');
      hook.result.current.reconnect();
    });

    expect(harness.socket.emit).toHaveBeenCalledWith('join-room', 'room-1', expect.any(Function));
    expect(harness.socket.emit).toHaveBeenCalledWith('leave-room', 'room-1');
    expect(harness.socket.disconnect).toHaveBeenCalled();
    expect(harness.socket.connect).toHaveBeenCalled();

    hook.unmount();
    expect(harness.socket.off).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('wires order, menu service, kiosk item, and waitlist event hooks', async () => {
    const harness = createSocketHarness();
    ioMock.mockReturnValue(harness.socket);

    const mod = await loadModule();
    const onOrderUpdate = vi.fn();
    const onRestaurantNew = vi.fn();
    const onRestaurantStatus = vi.fn();
    const onSnackNew = vi.fn();
    const onSnackStatus = vi.fn();
    const onWaitlist = vi.fn();

    const orderHook = renderHook(() => mod.useOrderUpdates('order-1', onOrderUpdate));
    const restaurantHook = renderHook(() => mod.useModuleOrders('menu_service', onRestaurantNew, onRestaurantStatus));
    const snackHook = renderHook(() => mod.useModuleOrders('kiosk', onSnackNew, onSnackStatus));
    const waitlistHook = renderHook(() => mod.useWaitlistUpdates(onWaitlist));

    act(() => {
      harness.triggerSocket('order:updated', { orderId: 'order-1', status: 'ready', updatedAt: 'now' });
      harness.triggerSocket('order:new', { orderId: 'order-2', moduleId: 'menu_service', totalAmount: 100, items: 2, createdAt: 'now' });
      harness.triggerSocket('waitlist.updated', { action: 'created', entryId: 'w-1' });
    });

    expect(onOrderUpdate).toHaveBeenCalled();
    expect(onRestaurantNew).toHaveBeenCalled();
    expect(onRestaurantStatus).toHaveBeenCalled();
    expect(onSnackNew).toHaveBeenCalled();
    expect(onSnackStatus).toHaveBeenCalled();
    expect(onWaitlist).toHaveBeenCalledWith({ action: 'created', entryId: 'w-1' });
    expect(harness.socket.emit).toHaveBeenCalledWith('join:unit', 'menu_service');
    expect(harness.socket.emit).toHaveBeenCalledWith('join:unit', 'kiosk');

    orderHook.unmount();
    restaurantHook.unmount();
    snackHook.unmount();
    waitlistHook.unmount();
  });

  it('tracks page navigation and emits user updates', async () => {
    const harness = createSocketHarness();
    ioMock.mockReturnValue(harness.socket);

    const mod = await loadModule();

    const trackingHook = renderHook(() => mod.usePageTracking());

    act(() => {
      harness.socket.connect();
    });

    act(() => {
      history.pushState({}, '', '/staff/manager');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    mod.updateSocketUserInfo({
      userId: 'u-1',
      email: 'staff@v2-hub.test',
      fullName: 'Staff User',
      roles: ['staff'],
    });

    expect(harness.socket.emit).toHaveBeenCalledWith('page:navigate', expect.objectContaining({ path: '/staff/manager' }));
    expect(harness.socket.emit).toHaveBeenCalledWith('user:update', expect.objectContaining({ userId: 'u-1' }));

    trackingHook.unmount();
  });
});
