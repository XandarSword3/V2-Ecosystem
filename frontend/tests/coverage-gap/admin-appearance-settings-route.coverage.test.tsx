import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.hoisted(() => vi.fn());
const setThemeMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: setThemeMock }),
}));

vi.mock('framer-motion', async () => {
  const React = await import('react');
  const motionProxy = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
          React.createElement(tag, props, children);
        return Component;
      },
    }
  );
  return { motion: motionProxy };
});

import AppearanceSettingsPage from '../../src/app/[property]/admin/settings/appearance/page';

describe('Admin appearance settings route coverage', () => {
  beforeEach(() => {
    pushMock.mockReset();
    setThemeMock.mockReset();
  });

  it('renders the appearance heading and display mode options', () => {
    render(<AppearanceSettingsPage />);

    expect(screen.getByRole('heading', { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
  });

  it('navigates to brand settings when the brand button is clicked', async () => {
    const user = userEvent.setup();

    render(<AppearanceSettingsPage />);

    await user.click(screen.getByRole('button', { name: /brand settings/i }));

    expect(pushMock).toHaveBeenCalledWith('/admin/settings/brand');
  });
});
