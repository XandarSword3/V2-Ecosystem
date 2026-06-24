import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/api', () => ({
  api: {
    get: apiGetMock,
    post: apiPostMock,
  },
  API_BASE_URL: 'http://localhost:3005/api/v1',
}));

vi.mock('../../src/lib/logger', () => ({
  authLogger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/stores/cartStore', () => ({
  useCartStore: (selector?: any) => {
    const state = { clearCart: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }),
  useMutation: vi.fn().mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    refetchQueries: vi.fn(),
    clear: vi.fn(),
    resetQueries: vi.fn(),
  }),
  QueryClient: vi.fn().mockImplementation(() => ({
    clear: vi.fn(),
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    resetQueries: vi.fn(),
  })),
  QueryClientProvider: ({ children }: any) => children,
}));

async function loadAuthModule() {
  return import('../../src/lib/auth-context');
}

describe('auth context', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    routerPushMock.mockReset();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('validates stored session and hydrates user from server', async () => {
    localStorage.setItem('accessToken', 'token-1');
    localStorage.setItem('refreshToken', 'refresh-1');
    localStorage.setItem('user', JSON.stringify({ id: 'stale' }));

    apiGetMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: 'u-1',
          email: 'staff@v2-hub.test',
          full_name: 'Staff User',
          preferred_language: 'fr',
          roles: ['staff'],
        },
      },
    });

    const mod = await loadAuthModule();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <mod.AuthProvider>{children}</mod.AuthProvider>
    );

    const hook = renderHook(() => mod.useAuth(), { wrapper });

    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(apiGetMock).toHaveBeenCalledWith('/auth/me');
    expect(hook.result.current.isAuthenticated).toBe(true);
    expect(hook.result.current.user).toMatchObject({
      id: 'u-1',
      email: 'staff@v2-hub.test',
      fullName: 'Staff User',
      preferredLanguage: 'fr',
      roles: ['staff'],
    });

    const stored = localStorage.getItem('user');
    expect(stored).toBeTruthy();
    expect(stored).toContain('Staff User');
  });

  it('handles OAuth callback tokens in URL and cleans query params', async () => {
    window.history.replaceState({}, '', '/staff?oauth=success&accessToken=oauth-a&refreshToken=oauth-r');

    apiGetMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: 'u-oauth',
          email: 'oauth@v2-hub.test',
          full_name: 'OAuth User',
          roles: ['customer'],
        },
      },
    });

    const mod = await loadAuthModule();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <mod.AuthProvider>{children}</mod.AuthProvider>
    );

    const hook = renderHook(() => mod.useAuth(), { wrapper });

    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    expect(localStorage.getItem('accessToken')).toBe('oauth-a');
    expect(localStorage.getItem('refreshToken')).toBe('oauth-r');
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/staff');
  });

  it('clears invalid session data when validation fails', async () => {
    localStorage.setItem('accessToken', 'bad-token');
    localStorage.setItem('refreshToken', 'bad-refresh');
    localStorage.setItem('user', JSON.stringify({ id: 'u-bad' }));

    apiGetMock.mockRejectedValueOnce(new Error('unauthorized'));

    const mod = await loadAuthModule();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <mod.AuthProvider>{children}</mod.AuthProvider>
    );

    const hook = renderHook(() => mod.useAuth(), { wrapper });

    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    expect(hook.result.current.isAuthenticated).toBe(false);
    expect(hook.result.current.user).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('returns two-factor challenge when backend requires 2FA', async () => {
    const mod = await loadAuthModule();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <mod.AuthProvider>{children}</mod.AuthProvider>
    );

    const hook = renderHook(() => mod.useAuth(), { wrapper });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    apiPostMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          requiresTwoFactor: true,
          userId: 'u-2fa',
          email: '2fa@v2-hub.test',
        },
      },
    });

    let result: unknown;
    await act(async () => {
      result = await hook.result.current.login('2fa@v2-hub.test', 'secret');
    });

    expect(result).toEqual({
      requiresTwoFactor: true,
      userId: 'u-2fa',
      email: '2fa@v2-hub.test',
    });
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('stores tokens and user on successful login and verify2FA', async () => {
    const mod = await loadAuthModule();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <mod.AuthProvider>{children}</mod.AuthProvider>
    );

    const hook = renderHook(() => mod.useAuth(), { wrapper });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    apiPostMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          user: {
            id: 'u-login',
            email: 'login@v2-hub.test',
            fullName: 'Login User',
            preferredLanguage: 'en',
            roles: ['customer'],
          },
          tokens: {
            accessToken: 'acc-login',
            refreshToken: 'ref-login',
          },
        },
      },
    });

    await act(async () => {
      await hook.result.current.login('login@v2-hub.test', 'secret');
    });

    expect(localStorage.getItem('accessToken')).toBe('acc-login');
    expect(localStorage.getItem('refreshToken')).toBe('ref-login');
    expect(hook.result.current.isAuthenticated).toBe(true);

    apiPostMock.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          user: {
            id: 'u-verified',
            email: 'verified@v2-hub.test',
            fullName: 'Verified User',
            preferredLanguage: 'ar',
            roles: ['staff'],
          },
          tokens: {
            accessToken: 'acc-verified',
            refreshToken: 'ref-verified',
          },
        },
      },
    });

    await act(async () => {
      await hook.result.current.verify2FA('u-2fa', '123456');
    });

    expect(localStorage.getItem('accessToken')).toBe('acc-verified');
    expect(localStorage.getItem('refreshToken')).toBe('ref-verified');
    expect(hook.result.current.user?.id).toBe('u-verified');
  });

  it('refreshes user from localStorage and logs out cleanly', async () => {
    const mod = await loadAuthModule();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <mod.AuthProvider>{children}</mod.AuthProvider>
    );

    const hook = renderHook(() => mod.useAuth(), { wrapper });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    localStorage.setItem('user', JSON.stringify({
      id: 'u-refresh',
      email: 'refresh@v2-hub.test',
      fullName: 'Refresh User',
      preferredLanguage: 'en',
      roles: ['customer'],
    }));

    act(() => {
      hook.result.current.refreshUser();
    });

    expect(hook.result.current.user?.id).toBe('u-refresh');

    localStorage.setItem('accessToken', 'logout-access');
    localStorage.setItem('refreshToken', 'logout-refresh');
    apiPostMock.mockResolvedValueOnce({ data: { success: true } });

    act(() => {
      hook.result.current.logout();
    });

    expect(apiPostMock).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'logout-refresh' });
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(hook.result.current.user).toBeNull();
    expect(routerPushMock).toHaveBeenCalledWith('/');
  });
});
