import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routerRefreshMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

import { LanguageSwitcher, LanguageSwitcherCompact } from '../../src/components/LanguageSwitcher';

describe('Language switcher components coverage', () => {
  beforeEach(() => {
    routerRefreshMock.mockReset();
    document.cookie = 'NEXT_LOCALE=fr; path=/';
  });

  it('switches locale from dropdown and refreshes router', async () => {
    const user = userEvent.setup();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<LanguageSwitcher />);

    expect(await screen.findByText('🇫🇷 Français')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Français/i }));
    await user.click(screen.getByRole('button', { name: /English/i }));

    await waitFor(() => {
      expect(routerRefreshMock).toHaveBeenCalled();
    });

    expect(document.cookie).toContain('NEXT_LOCALE=en');
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('changes locale using compact switcher', async () => {
    const user = userEvent.setup();

    render(<LanguageSwitcherCompact />);

    const germanButton = screen.getByTitle('Deutsch');
    await user.click(germanButton);

    await waitFor(() => {
      expect(routerRefreshMock).toHaveBeenCalled();
    });

    expect(document.cookie).toContain('NEXT_LOCALE=de');
  });
});
