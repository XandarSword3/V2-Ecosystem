import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  canInstallMock,
  isAppInstalledMock,
  isPWASupportedMock,
  promptInstallMock,
  registerServiceWorkerMock,
  requestNotificationPermissionMock,
  setupInstallPromptMock,
} = vi.hoisted(() => ({
  isPWASupportedMock: vi.fn(),
  registerServiceWorkerMock: vi.fn(),
  isAppInstalledMock: vi.fn(),
  canInstallMock: vi.fn(),
  promptInstallMock: vi.fn(),
  setupInstallPromptMock: vi.fn(),
  requestNotificationPermissionMock: vi.fn(),
}));

vi.mock('../../src/lib/pwa', () => ({
  isPWASupported: isPWASupportedMock,
  registerServiceWorker: registerServiceWorkerMock,
  isAppInstalled: isAppInstalledMock,
  canInstall: canInstallMock,
  promptInstall: promptInstallMock,
  setupInstallPrompt: setupInstallPromptMock,
  requestNotificationPermission: requestNotificationPermissionMock,
}));

import { usePWA } from '../../src/lib/usePWA';

describe('usePWA hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    isPWASupportedMock.mockReturnValue(true);
    isAppInstalledMock.mockReturnValue(false);
    canInstallMock.mockReturnValue(true);
    registerServiceWorkerMock.mockResolvedValue(null);
    promptInstallMock.mockResolvedValue(true);
    requestNotificationPermissionMock.mockResolvedValue('granted');

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes state, registers pwa handlers, and reacts to custom events', async () => {
    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isSupported).toBe(true);
    });

    expect(registerServiceWorkerMock).toHaveBeenCalledTimes(1);
    expect(setupInstallPromptMock).toHaveBeenCalledTimes(1);
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.notificationPermission).toBe('default');

    act(() => {
      window.dispatchEvent(new Event('pwa-install-available'));
    });
    expect(result.current.canInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('pwa-update-available'));
    });
    expect(result.current.isUpdateAvailable).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('pwa-installed'));
    });
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('returns false from install when canInstall is false', async () => {
    canInstallMock.mockReturnValue(false);

    const { result } = renderHook(() => usePWA());
    let installResult = true;

    await act(async () => {
      installResult = await result.current.install();
    });

    expect(installResult).toBe(false);
    expect(promptInstallMock).not.toHaveBeenCalled();
  });

  it('requests notifications and updates permission in state', async () => {
    requestNotificationPermissionMock.mockResolvedValue('granted');

    const { result } = renderHook(() => usePWA());

    let permission: NotificationPermission = 'default';
    await act(async () => {
      permission = await result.current.requestNotifications();
    });

    expect(permission).toBe('granted');
    expect(result.current.notificationPermission).toBe('granted');
  });

  it('skips registration when PWA is unsupported', async () => {
    isPWASupportedMock.mockReturnValue(false);

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current.isSupported).toBe(false);
    });

    expect(registerServiceWorkerMock).not.toHaveBeenCalled();
    expect(setupInstallPromptMock).not.toHaveBeenCalled();
  });
});
