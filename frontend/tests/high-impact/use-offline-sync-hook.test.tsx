import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  clearOfflineDataMock,
  getSyncStatusMock,
  initOfflineSyncMock,
  refreshAllCachesMock,
  retryFailedItemsMock,
  subscribeToSyncStatusMock,
  syncAllMock,
  unsubscribeMock,
} = vi.hoisted(() => ({
  getSyncStatusMock: vi.fn(),
  subscribeToSyncStatusMock: vi.fn(),
  syncAllMock: vi.fn(),
  initOfflineSyncMock: vi.fn(),
  refreshAllCachesMock: vi.fn(),
  retryFailedItemsMock: vi.fn(),
  clearOfflineDataMock: vi.fn(),
  unsubscribeMock: vi.fn(),
}));

vi.mock('../../src/lib/offline/offline-sync', () => ({
  subscribeToSyncStatus: subscribeToSyncStatusMock,
  getSyncStatus: getSyncStatusMock,
  syncAll: syncAllMock,
  initOfflineSync: initOfflineSyncMock,
  refreshAllCaches: refreshAllCachesMock,
  retryFailedItems: retryFailedItemsMock,
  clearOfflineData: clearOfflineDataMock,
}));

import { useOfflineSync, useOnlineStatus } from '../../src/lib/offline/use-offline-sync';

describe('offline sync hooks', () => {
  const baseStatus = {
    isOnline: true,
    isSyncing: false,
    pendingCount: 2,
    failedCount: 1,
    lastSyncAt: null,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    getSyncStatusMock.mockReturnValue(baseStatus);
    initOfflineSyncMock.mockResolvedValue(undefined);
    syncAllMock.mockResolvedValue({ synced: 3, failed: 0 });
    refreshAllCachesMock.mockResolvedValue(undefined);
    retryFailedItemsMock.mockResolvedValue({ retried: 2 });
    clearOfflineDataMock.mockResolvedValue(undefined);

    subscribeToSyncStatusMock.mockImplementation(() => unsubscribeMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes, subscribes to updates, and exposes command helpers', async () => {
    let statusListener: ((status: typeof baseStatus) => void) | undefined;

    subscribeToSyncStatusMock.mockImplementation((cb: (status: typeof baseStatus) => void) => {
      statusListener = cb;
      return unsubscribeMock;
    });

    const { result, unmount } = renderHook(() => useOfflineSync());

    expect(initOfflineSyncMock).toHaveBeenCalledTimes(1);
    expect(subscribeToSyncStatusMock).toHaveBeenCalledTimes(1);
    expect(result.current.pendingCount).toBe(2);
    expect(result.current.failedCount).toBe(1);

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });

    act(() => {
      statusListener?.({
        ...baseStatus,
        pendingCount: 0,
        failedCount: 0,
        isSyncing: true,
      });
    });

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.failedCount).toBe(0);
    expect(result.current.isSyncing).toBe(true);

    await act(async () => {
      await result.current.sync();
      await result.current.refresh();
      await result.current.retry();
      await result.current.clear();
    });

    expect(syncAllMock).toHaveBeenCalledTimes(1);
    expect(refreshAllCachesMock).toHaveBeenCalledTimes(1);
    expect(retryFailedItemsMock).toHaveBeenCalledTimes(1);
    expect(clearOfflineDataMock).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('tracks browser online and offline events', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});
