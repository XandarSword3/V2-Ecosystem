import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import { CurrencySwitcher } from '../../src/components/CurrencySwitcher';
import { useSettingsStore } from '../../src/stores/settingsStore';

describe('Currency switcher component coverage', () => {
  beforeEach(() => {
    useSettingsStore.setState({ currency: 'USD' });
  });

  it('opens picker and updates currency selection', async () => {
    const user = userEvent.setup();

    render(<CurrencySwitcher />);

    expect(screen.getByText('$')).toBeInTheDocument();

    const triggerButton = screen.getAllByRole('button')[0];
    await user.click(triggerButton);

    await user.click(screen.getByRole('button', { name: /EUR/i }));

    await waitFor(() => {
      expect(useSettingsStore.getState().currency).toBe('EUR');
    });

    await user.click(screen.getByRole('button', { name: /€/i }));
    await user.click(await screen.findByRole('button', { name: /LBP/i }));

    await waitFor(() => {
      expect(useSettingsStore.getState().currency).toBe('LBP');
    });
  });
});
