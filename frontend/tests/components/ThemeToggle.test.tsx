/**
 * ThemeToggle Component Tests
 * 
 * Tests for the ThemeToggle and ThemeDropdown components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeToggle, ThemeDropdown } from '../../src/components/ThemeToggle';

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = 'light';
let mockResolvedTheme = 'light';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
    resolvedTheme: mockResolvedTheme,
  }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = 'light';
    mockResolvedTheme = 'light';
  });

  it('should render toggle button', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('should show sun icon in light mode', async () => {
    mockTheme = 'light';
    mockResolvedTheme = 'light';
    
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', expect.stringContaining('light'));
    });
  });

  it('should cycle themes when clicked: light -> dark', async () => {
    mockTheme = 'light';
    
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });
    
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('should cycle themes when clicked: dark -> system', async () => {
    mockTheme = 'dark';
    mockResolvedTheme = 'dark';
    
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });
    
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('should cycle themes when clicked: system -> light', async () => {
    mockTheme = 'system';
    mockResolvedTheme = 'light';
    
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });
    
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('should have accessible aria-label', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-label')).toBeDefined();
    });
  });
});

describe('ThemeDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = 'light';
    mockResolvedTheme = 'light';
  });

  it('should render dropdown button', async () => {
    render(<ThemeDropdown />);
    
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('should open dropdown when clicked', async () => {
    render(<ThemeDropdown />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });
    
    // Dropdown should show theme options
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('should set theme when option is clicked', async () => {
    render(<ThemeDropdown />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });
    
    const darkOption = screen.getByText('Dark');
    fireEvent.click(darkOption);
    
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('should close dropdown after selection', async () => {
    render(<ThemeDropdown />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });
    
    const lightOption = screen.getByText('Light');
    fireEvent.click(lightOption);
    
    // Dropdown should close
    await waitFor(() => {
      expect(screen.queryByText('System')).not.toBeInTheDocument();
    });
  });
});
