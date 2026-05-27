'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  subscribeToSyncStatus,
  getSyncStatus,
  syncAll,
  initOfflineSync,
  refreshAllCaches,
  retryFailedItems,
  clearOfflineData,
  type SyncStatus,
} from './offline-sync';
import { startBackgroundRefresh, stopBackgroundRefresh } from './offline-hydration';

/**
 * Hook for monitoring and controlling offline sync status
 */
export function useOfflineSync() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Only initialize offline sync if the user has an auth token.
    // Without a token the hydration calls will 401 before login is complete.
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('auth_token') ||
          localStorage.getItem('token') ||
          sessionStorage.getItem('auth_token') ||
          sessionStorage.getItem('token')
        : null;

    if (!token) {
      // No token yet — skip init. The hook will re-run if the component re-mounts
      // after login, or the sync can be triggered manually.
      return;
    }

    // Initialize offline sync
    initOfflineSync().then(() => {
      setInitialized(true);
    });

    // Subscribe to status updates
    const unsubscribe = subscribeToSyncStatus(setStatus);

    // Start background refresh loop
    startBackgroundRefresh();

    return () => {
      unsubscribe();
      stopBackgroundRefresh();
    };
  }, []);

  const sync = useCallback(async () => {
    return syncAll();
  }, []);

  const refresh = useCallback(async () => {
    return refreshAllCaches();
  }, []);

  const retry = useCallback(async () => {
    return retryFailedItems();
  }, []);

  const clear = useCallback(async () => {
    return clearOfflineData();
  }, []);

  return {
    ...status,
    initialized,
    sync,
    refresh,
    retry,
    clear,
  };
}

/**
 * Hook for checking if we're online
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
