import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routerPushMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn(async () => undefined));
const toastInfoMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ isAuthenticated: true }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: authState.isAuthenticated,
    logout: logoutMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    info: toastInfoMock,
    success: toastSuccessMock,
  },
}));

import { useIdleTimer } from '../../src/hooks/useIdleTimer';

describe('useIdleTimer', () => {
  beforeEach(() => {
    authState.isAuthenticated = true;
    routerPushMock.mockReset();
    logoutMock.mockReset();
    toastInfoMock.mockReset();
    toastSuccessMock.mockReset();

    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('activates warning and auto-logs out after inactivity timeout', async () => {
    renderHook(() =>
      useIdleTimer({
        warningTimeoutMinutes: 0.01,
        logoutTimeoutMinutes: 0.03,
      })
    );

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(toastInfoMock).toHaveBeenCalledWith('You have been logged out due to inactivity');
    expect(routerPushMock).toHaveBeenCalledWith('/login');
  });

  it('extends session from warning state and resets countdown', async () => {
    const hook = renderHook(() =>
      useIdleTimer({
        warningTimeoutMinutes: 0.01,
        logoutTimeoutMinutes: 0.2,
      })
    );

    act(() => {
      hook.result.current.extendSession();
    });

    expect(toastSuccessMock).toHaveBeenCalledWith('Session extended');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(logoutMock).not.toHaveBeenCalled();
  });

  it('logs out on cross-tab logout storage event', async () => {
    renderHook(() =>
      useIdleTimer({
        warningTimeoutMinutes: 1,
        logoutTimeoutMinutes: 2,
      })
    );

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'logout-event' }));
      await Promise.resolve();
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(routerPushMock).toHaveBeenCalledWith('/login');
  });

  it('does not start timers when user is unauthenticated', () => {
    authState.isAuthenticated = false;

    const hook = renderHook(() =>
      useIdleTimer({
        warningTimeoutMinutes: 0.001,
        logoutTimeoutMinutes: 0.002,
      })
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(hook.result.current.isWarningActive).toBe(false);
    expect(logoutMock).not.toHaveBeenCalled();
  });
});
