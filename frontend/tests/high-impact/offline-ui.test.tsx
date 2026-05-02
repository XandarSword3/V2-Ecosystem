import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineStatusIndicator } from '../../src/components/offline/OfflineStatusIndicator';
import React from 'react';

// Mock the hook
const useOfflineSyncMock = vi.fn();
vi.mock('@/lib/offline', () => ({
  useOfflineSync: () => useOfflineSyncMock(),
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('OfflineStatusIndicator component', () => {
  it('renders success indicator when online and synced (initial success pulse)', () => {
    useOfflineSyncMock.mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      error: null,
    });

    render(<OfflineStatusIndicator />);
    expect(screen.getByText('syncSuccess')).toBeDefined();
  });

  it('renders offline warning when offline', () => {
    useOfflineSyncMock.mockReturnValue({
      isOnline: false,
      isSyncing: false,
      pendingCount: 0,
      error: null,
    });

    render(<OfflineStatusIndicator />);
    expect(screen.getByText('showingCached')).toBeDefined();
  });

  it('renders syncing indicator when syncing', () => {
    useOfflineSyncMock.mockReturnValue({
      isOnline: true,
      isSyncing: true,
      pendingCount: 1,
      error: null,
    });

    render(<OfflineStatusIndicator />);
    expect(screen.getByText('syncing')).toBeDefined();
  });

  it('renders pending actions count', () => {
    useOfflineSyncMock.mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingCount: 5,
      error: null,
    });

    render(<OfflineStatusIndicator />);
    expect(screen.getByText('5 actions pending')).toBeDefined();
  });

  it('renders error indicator when there is an error', () => {
    useOfflineSyncMock.mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      error: 'Sync failed',
    });

    render(<OfflineStatusIndicator />);
    expect(screen.getByText('syncError')).toBeDefined();
  });
});
