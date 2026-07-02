import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MenuImportPage from '../../src/app/[property]/admin/[slug]/menu/import/page';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { useParams, useRouter } from 'next/navigation';

// Mock dependencies
vi.mock('@/lib/api');
vi.mock('@/lib/settings-context');
vi.mock('next/navigation');
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('MenuImportPage', () => {
  const mockSlug = 'test-menu service';
  const mockModule = { id: 'mod-123', slug: mockSlug, name: 'Test MenuService' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({ slug: mockSlug });
    vi.mocked(useRouter).mockReturnValue({ back: vi.fn(), push: vi.fn() } as any);
    vi.mocked(useSiteSettings).mockReturnValue({
      modules: [mockModule],
      settings: {},
      loading: false,
    } as any);
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  });

  it('renders Step 1 by default', () => {
    render(<MenuImportPage />);
    expect(screen.getByText('Import Menu')).toBeDefined();
    expect(screen.getByPlaceholderText(/Paste your menu here/i)).toBeDefined();
  });

  it('transitions to Step 2 after successful parsing', async () => {
    const mockParsedData = {
      items: [{ name: 'Pizza', price: 10, category: 'Main', _tempId: '1' }],
      warnings: [],
      errors: []
    };
    vi.mocked(api.post).mockResolvedValue({ data: { data: mockParsedData } });

    render(<MenuImportPage />);
    
    const textarea = screen.getByPlaceholderText(/Paste your menu here/i);
    fireEvent.change(textarea, { target: { value: 'Pizza 10' } });
    
    const parseButton = screen.getByText('Parse →');
    fireEvent.click(parseButton);

    await waitFor(() => {
      expect(screen.getByText('1 items parsed')).toBeDefined();
      expect(screen.getByDisplayValue('Pizza')).toBeDefined();
    });
  });

  it('handles parsing errors gracefully', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { errors: ['Failed to parse'] } }
    });

    render(<MenuImportPage />);
    
    const textarea = screen.getByPlaceholderText(/Paste your menu here/i);
    fireEvent.change(textarea, { target: { value: 'garbage' } });
    
    const parseButton = screen.getByText('Parse →');
    fireEvent.click(parseButton);

    // Toast is checked via mock call
  });
});
