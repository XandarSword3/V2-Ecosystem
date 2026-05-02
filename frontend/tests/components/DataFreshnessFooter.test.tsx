import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataFreshnessFooter } from '@/components/offline/DataFreshnessFooter';

// Mock cacheManager
vi.mock('@/lib/offline/offline-storage', () => ({
  cacheManager: {
    getMetadata: vi.fn(),
  },
}));

// Mock translations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { cacheManager } from '@/lib/offline/offline-storage';

describe('DataFreshnessFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no sync metadata exists', async () => {
    (cacheManager.getMetadata as any).mockResolvedValue(null);
    render(<DataFreshnessFooter storeName="test" />);
    const footer = screen.queryByText(/Last updated/);
    expect(footer).toBeNull();
  });

  it('renders "just now" when recently synced', async () => {
    (cacheManager.getMetadata as any).mockResolvedValue({ lastSyncAt: new Date().toISOString() });
    render(<DataFreshnessFooter storeName="test" />);
    // Wait for the async metadata fetch
    const text = await screen.findByText(/Last updated just now/);
    expect(text).toBeDefined();
  });

  it('renders warning when data is old', async () => {
    const fortyMinsAgo = new Date(Date.now() - 40 * 60 * 1000).toISOString();
    (cacheManager.getMetadata as any).mockResolvedValue({ lastSyncAt: fortyMinsAgo });
    render(<DataFreshnessFooter storeName="test" />);
    const text = await screen.findByText(/40m ago/);
    const warning = await screen.findByText(/Data may be old/);
    expect(text).toBeDefined();
    expect(warning).toBeDefined();
  });

  it('renders error when data is stale', async () => {
    const seventyMinsAgo = new Date(Date.now() - 70 * 60 * 1000).toISOString();
    (cacheManager.getMetadata as any).mockResolvedValue({ lastSyncAt: seventyMinsAgo });
    render(<DataFreshnessFooter storeName="test" />);
    const text = await screen.findByText(/70m ago/);
    const error = await screen.findByText(/Stale data/);
    expect(text).toBeDefined();
    expect(error).toBeDefined();
  });
});
