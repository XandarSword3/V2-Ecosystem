import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const themeState = vi.hoisted(() => ({
  theme: 'light',
  resolvedTheme: 'light',
}));

const setThemeMock = vi.hoisted(() =>
  vi.fn((nextTheme: string) => {
    themeState.theme = nextTheme;
    if (nextTheme === 'light' || nextTheme === 'dark') {
      themeState.resolvedTheme = nextTheme;
    }
  })
);

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: themeState.theme,
    resolvedTheme: themeState.resolvedTheme,
    setTheme: setThemeMock,
  }),
}));

import { ThemeToggle, ThemeDropdown } from '../../src/components/ThemeToggle';

describe('Theme toggle components coverage', () => {
  beforeEach(() => {
    themeState.theme = 'light';
    themeState.resolvedTheme = 'light';
    setThemeMock.mockClear();
  });

  it('cycles ThemeToggle through light -> dark -> system -> light', async () => {
    const user = userEvent.setup();

    const { rerender } = render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', expect.stringContaining('Current theme'));
    });

    await user.click(screen.getByRole('button'));
    expect(setThemeMock).toHaveBeenCalledWith('dark');

    themeState.theme = 'dark';
    themeState.resolvedTheme = 'dark';
    rerender(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(setThemeMock).toHaveBeenCalledWith('system');

    themeState.theme = 'system';
    themeState.resolvedTheme = 'light';
    rerender(<ThemeToggle />);

    await user.click(screen.getByRole('button'));
    expect(setThemeMock).toHaveBeenCalledWith('light');
  });

  it('opens ThemeDropdown and applies a selected theme', async () => {
    const user = userEvent.setup();

    themeState.theme = 'light';
    themeState.resolvedTheme = 'light';

    render(<ThemeDropdown />);

    await user.click(screen.getByRole('button', { name: /light/i }));
    await user.click(screen.getByRole('button', { name: /Dark/i }));

    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });
});
