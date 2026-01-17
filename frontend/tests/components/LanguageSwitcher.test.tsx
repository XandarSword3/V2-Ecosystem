/**
 * LanguageSwitcher Component Tests
 * 
 * Tests for the LanguageSwitcher component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher';

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: vi.fn(),
  }),
}));

// Mock i18n config
vi.mock('@/i18n', () => ({
  locales: ['en', 'ar', 'fr'],
  localeNames: {
    en: 'English',
    ar: 'العربية',
    fr: 'Français',
  },
  localeFlags: {
    en: '🇺🇸',
    ar: '🇸🇦',
    fr: '🇫🇷',
  },
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cookies
    document.cookie = 'NEXT_LOCALE=; path=/; max-age=0';
  });

  it('should render the language button', async () => {
    render(<LanguageSwitcher />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('should show English as default language', async () => {
    render(<LanguageSwitcher />);

    await waitFor(() => {
      expect(screen.getByText(/English/)).toBeInTheDocument();
    });
  });

  it('should open dropdown when clicked', async () => {
    render(<LanguageSwitcher />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });

    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('العربية')).toBeInTheDocument();
    expect(screen.getByText('Français')).toBeInTheDocument();
  });

  it('should close dropdown when clicking outside', async () => {
    render(<LanguageSwitcher />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });

    // Dropdown is open
    expect(screen.getByText('Français')).toBeInTheDocument();

    // Click the overlay to close
    const overlay = document.querySelector('.fixed.inset-0');
    if (overlay) {
      fireEvent.click(overlay);
    }

    // Dropdown should close
    await waitFor(() => {
      const dropdowns = document.querySelectorAll('.absolute.right-0');
      expect(dropdowns.length).toBe(0);
    });
  });

  it('should change language when option is clicked', async () => {
    render(<LanguageSwitcher />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });

    const arabicOption = screen.getByText('العربية');
    fireEvent.click(arabicOption);

    // Check that cookie was set
    expect(document.cookie).toContain('NEXT_LOCALE=ar');
  });

  it('should call router.refresh after language change', async () => {
    render(<LanguageSwitcher />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });

    const frenchOption = screen.getByText('Français');
    fireEvent.click(frenchOption);

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('should dispatch localeChange event on language change', async () => {
    const eventListener = vi.fn();
    window.addEventListener('localeChange', eventListener);

    render(<LanguageSwitcher />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });

    const arabicOption = screen.getByText('العربية');
    fireEvent.click(arabicOption);

    expect(eventListener).toHaveBeenCalled();

    window.removeEventListener('localeChange', eventListener);
  });

  it('should highlight current language', async () => {
    render(<LanguageSwitcher />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });

    // Find the English button and check if it has the active class
    const englishButtons = screen.getAllByText('English');
    const dropdownOption = englishButtons.find(el => 
      el.closest('button')?.classList.contains('text-blue-600') ||
      el.closest('button')?.classList.contains('bg-blue-50')
    );
    
    expect(dropdownOption).toBeDefined();
  });

  it('should read locale from cookie on mount', async () => {
    document.cookie = 'NEXT_LOCALE=fr; path=/';

    render(<LanguageSwitcher />);

    await waitFor(() => {
      expect(screen.getByText(/Français/)).toBeInTheDocument();
    });
  });
});
