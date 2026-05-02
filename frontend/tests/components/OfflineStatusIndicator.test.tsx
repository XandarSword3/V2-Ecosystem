import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineStatusIndicator } from '@/components/offline/OfflineStatusIndicator';

// Mock the hooks
const useOfflineSyncMock = vi.fn();
vi.mock('@/lib/offline', () => ({
  useOfflineSync: () => useOfflineSyncMock(),
}));

// Mock translations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('OfflineStatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing initially when all is good', () => {
    useOfflineSyncMock.mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      lastSyncAt: new Date(),
      error: null,
    });

    render(<OfflineStatusIndicator />);
    // When online and no pending, it might show success temporarily but mostly nothing
    expect(screen.queryByText(/showingCached/)).toBeNull();
  });

  it('renders offline warning when disconnected', () => {
    useOfflineSyncMock.mockReturnValue({
      isOnline: false,
      isSyncing: false,
      pendingCount: 0,
      lastSyncAt: new Date(),
      error: null,
    });

    render(<OfflineStatusIndicator />);
    expect(screen.getByText(/showingCached/)).toBeDefined();
  });

  it('renders syncing state', () => {
    useOfflineSyncMock.mockReturnValue({
      isOnline: true,
      isSyncing: true,
      pendingCount: 2,
      lastSyncAt: new Date(),
      error: null,
    });

    render(<OfflineStatusIndicator />);
    expect(screen.getByText(/syncing/)).toBeDefined();
  });

  it('renders pending actions count', () => {
    useOfflineSyncMock.mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingCount: 5,
      lastSyncAt: new Date(),
      error: null,
    });

    render(<OfflineStatusIndicator />);
    expect(screen.getByText(/5 actionsPending/)).toBeDefined();
  });

  it('renders error state', () => {
    useOfflineSyncMock.mockReturnValue({
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      lastSyncAt: new Date(),
      error: 'Sync Failed',
    });

    render(<OfflineStatusIndicator />);
    expect(screen.getByText(/syncError/)).toBeDefined();
  });
});
