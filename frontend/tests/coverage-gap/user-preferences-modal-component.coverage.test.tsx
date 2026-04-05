import { render, screen, waitFor, within } from '@testing-library/react';
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

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dictionary: Record<string, string> = {
      'preferences.title': 'Preferences',
      'preferences.subtitle': 'Customize your experience',
      'preferences.animations.title': 'Animations',
      'preferences.animations.enableAll': 'Enable all animations',
      'preferences.animations.enableAllDesc': 'Turn motion effects on or off',
      'preferences.transitions.title': 'Page transitions',
      'preferences.transitions.enable': 'Enable transitions',
      'preferences.transitions.enableDesc': 'Use animated page transitions',
      'preferences.transitions.style': 'Transition style',
      'preferences.loading.title': 'Loading animation',
      'preferences.loading.enable': 'Enable loading animation',
      'preferences.loading.enableDesc': 'Show loading effects',
      'preferences.done': 'Done',
    };

    return dictionary[key] || key;
  },
}));

import { UserPreferencesModal } from '../../src/components/settings/UserPreferencesModal';
import { useSettingsStore } from '../../src/stores/settingsStore';

describe('User preferences modal component coverage', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      animationsEnabled: true,
      enableTransitions: true,
      transitionStyle: 'reveal',
      enableLoadingAnimation: true,
    });
  });

  it('renders modal, updates settings, and closes through action buttons', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<UserPreferencesModal isOpen onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'User Preferences' });
    expect(dialog).toBeInTheDocument();

    const animationLabel = screen.getByText('Enable all animations');
    const animationRow = animationLabel.closest('div')?.parentElement;
    if (animationRow) {
      const toggle = within(animationRow).getByRole('button');
      await user.click(toggle);
    }

    expect(useSettingsStore.getState().animationsEnabled).toBe(false);

    await user.click(screen.getByRole('button', { name: /Scale/i }));
    expect(useSettingsStore.getState().transitionStyle).toBe('scale');

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when clicking on the backdrop', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<UserPreferencesModal isOpen onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'User Preferences' });
    await user.click(dialog);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
