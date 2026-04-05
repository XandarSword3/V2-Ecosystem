import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SocketHandler = (...args: unknown[]) => void;

const socketState = vi.hoisted(() => ({
  socket: null as null | {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  },
  handlers: new Map<string, SocketHandler>(),
}));

vi.mock('../../src/lib/socket', () => ({
  useSocket: () => ({ socket: socketState.socket }),
}));

vi.mock('../../src/lib/logger', () => ({
  settingsLogger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

function createSocketMock() {
  const handlers = new Map<string, SocketHandler>();
  const socket = {
    on: vi.fn((event: string, cb: SocketHandler) => {
      handlers.set(event, cb);
    }),
    off: vi.fn((event: string, cb?: SocketHandler) => {
      if (!cb) {
        handlers.delete(event);
        return;
      }
      const existing = handlers.get(event);
      if (existing === cb) {
        handlers.delete(event);
      }
    }),
  };
  return { socket, handlers };
}

describe('settings context', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();

    const created = createSocketMock();
    socketState.socket = created.socket;
    socketState.handlers = created.handlers;

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads settings and modules successfully', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/settings')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              resortName: 'Oceanic Resort',
              theme: 'forest',
              currency: 'EUR',
            },
          }),
        } as Response;
      }

      if (url.includes('/api/modules?activeOnly=true')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'mod-1',
                template_type: 'menu_service',
                name: 'Restaurant',
                slug: 'restaurant',
                is_active: true,
                sort_order: 1,
              },
            ],
          }),
        } as Response;
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const mod = await import('../../src/lib/settings-context');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <mod.SettingsProvider>{children}</mod.SettingsProvider>
    );

    const hook = renderHook(() => mod.useSiteSettings(), { wrapper });

    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.settings.resortName).toBe('Oceanic Resort');
    expect(hook.result.current.settings.currency).toBe('EUR');
    expect(hook.result.current.modules).toHaveLength(1);
    expect(hook.result.current.modules[0].slug).toBe('restaurant');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sets error state when settings fetch fails', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/settings')) {
        return {
          ok: false,
          json: async () => ({ success: false }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ success: true, data: [] }),
      } as Response;
    });

    const mod = await import('../../src/lib/settings-context');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <mod.SettingsProvider>{children}</mod.SettingsProvider>
    );

    const hook = renderHook(() => mod.useSiteSettings(), { wrapper });

    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    expect(hook.result.current.error).toBe('Failed to load settings');
    expect(hook.result.current.settings.taxRate).toBe(0.11);
  });

  it('refetches settings when storage update event is received', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    let settingsVersion = 1;

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/settings')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              resortName: `Resort ${settingsVersion}`,
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ success: true, data: [] }),
      } as Response;
    });

    const mod = await import('../../src/lib/settings-context');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <mod.SettingsProvider>{children}</mod.SettingsProvider>
    );

    const hook = renderHook(() => mod.useSiteSettings(), { wrapper });

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.settings.resortName).toBe('Resort 1');

    settingsVersion = 2;

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'v2-settings-updated',
          newValue: Date.now().toString(),
        })
      );
    });

    await waitFor(() => expect(hook.result.current.settings.resortName).toBe('Resort 2'));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('refetches when socket settings/modules events fire and removes listeners on unmount', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/settings')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              resortName: 'Socket Resort',
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ success: true, data: [] }),
      } as Response;
    });

    const mod = await import('../../src/lib/settings-context');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <mod.SettingsProvider>{children}</mod.SettingsProvider>
    );

    const hook = renderHook(() => mod.useSiteSettings(), { wrapper });

    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    const settingsHandler = socketState.handlers.get('settings.updated');
    const modulesHandler = socketState.handlers.get('modules.updated');

    expect(settingsHandler).toBeTypeOf('function');
    expect(modulesHandler).toBeTypeOf('function');

    await act(async () => {
      await settingsHandler?.({ resortName: 'ignored' });
    });

    await act(async () => {
      modulesHandler?.();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));

    hook.unmount();

    expect(socketState.socket?.off).toHaveBeenCalledWith('settings.updated', expect.any(Function));
    expect(socketState.socket?.off).toHaveBeenCalledWith('modules.updated', expect.any(Function));
  });
});
