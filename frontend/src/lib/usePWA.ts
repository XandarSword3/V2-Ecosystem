'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  isPWASupported,
  registerServiceWorker,
  isAppInstalled,
  canInstall,
  promptInstall,
  setupInstallPrompt,
  requestNotificationPermission,
} from './pwa';

interface PWAState {
  isSupported: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  isUpdateAvailable: boolean;
  notificationPermission: NotificationPermission;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isSupported: false,
    isInstalled: false,
    canInstall: false,
    isUpdateAvailable: false,
    notificationPermission: 'default',
  });

  useEffect(() => {
    // Initial setup
    const isSupported = isPWASupported();
    const isInstalled = isAppInstalled();

    setState((prev) => ({
      ...prev,
      isSupported,
      isInstalled,
      notificationPermission: 'Notification' in window ? Notification.permission : 'denied',
    }));

    if (isSupported) {
      // Register service worker
      registerServiceWorker();
      
      // Setup install prompt handling
      setupInstallPrompt();

      // Listen for install availability
      const handleInstallAvailable = () => {
        setState((prev) => ({ ...prev, canInstall: true }));
      };

      // Listen for update availability
      const handleUpdateAvailable = () => {
        setState((prev) => ({ ...prev, isUpdateAvailable: true }));
      };

      // Listen for app installed
      const handleInstalled = () => {
        setState((prev) => ({ ...prev, isInstalled: true, canInstall: false }));
      };

      window.addEventListener('pwa-install-available', handleInstallAvailable);
      window.addEventListener('pwa-update-available', handleUpdateAvailable);
      window.addEventListener('pwa-installed', handleInstalled);

      return () => {
        window.removeEventListener('pwa-install-available', handleInstallAvailable);
        window.removeEventListener('pwa-update-available', handleUpdateAvailable);
        window.removeEventListener('pwa-installed', handleInstalled);
      };
    }
  }, []);

  const install = useCallback(async () => {
    if (!canInstall()) return false;
    const result = await promptInstall();
    return result;
  }, []);

  const requestNotifications = useCallback(async () => {
    const permission = await requestNotificationPermission();
    setState((prev) => ({ ...prev, notificationPermission: permission }));
    return permission;
  }, []);

  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  return {
    ...state,
    install,
    requestNotifications,
    refresh,
  };
}
