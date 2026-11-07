import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replaceMock = vi.hoisted(() => vi.fn());
const loginMock = vi.hoisted(() => vi.fn());
const verify2FAMock = vi.hoisted(() => vi.fn());

const authState = vi.hoisted(() => ({
  user: null as { id: string; roles: string[] } | null,
  isAuthenticated: false,
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

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    login: loginMock,
    verify2FA: verify2FAMock,
  }),
}));

// The login page routes post-auth redirects through the property slug
// (/${propertySlug}/admin|staff). Provide a stable property context.
vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({ settings: { propertySlug: 'demo' } }),
}));

import LoginPage from '../../src/app/login/page';

describe('Login route behavior', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    loginMock.mockReset();
    verify2FAMock.mockReset();

    authState.user = null;
    authState.isAuthenticated = false;
  });

  it('redirects already authenticated admins to the admin dashboard', async () => {
    authState.user = { id: 'admin-1', roles: ['admin'] };
    authState.isAuthenticated = true;

    render(<LoginPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/demo/admin');
    });
  });

  it('redirects already authenticated platform admins to /platform-admin', async () => {
    authState.user = { id: 'root-1', roles: ['super_admin'], is_platform_admin: true };
    authState.isAuthenticated = true;

    render(<LoginPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/platform-admin');
    });
  });

  it('prompts for 2FA after password login and surfaces verification errors', async () => {
    const user = userEvent.setup();

    loginMock.mockResolvedValue({
      requiresTwoFactor: true,
      userId: 'user-2fa',
    });
    verify2FAMock.mockRejectedValue(new Error('Invalid verification code'));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
    await user.click(screen.getByRole('button', { name: 'title' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('user@example.com', 'secret123', undefined);
    });

    expect(await screen.findByText('Two-Factor Authentication')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify & Sign In' }));

    await waitFor(() => {
      expect(verify2FAMock).toHaveBeenCalledWith('user-2fa', '123456', false);
    });

    expect(await screen.findByText('Invalid verification code')).toBeInTheDocument();
  });

  it('logs in successfully and redirects staff-role users to the property staff area', async () => {
    const originalLocation = window.location;
    let navigatedTo = '';
    // jsdom cannot navigate; stub window.location so the post-login
    // window.location.href assignment (redirectAfterLogin contract) is
    // observable while getRedirectPath() keeps reading an empty search.
    try {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          get search() {
            return '';
          },
          get href() {
            return 'http://localhost/login';
          },
          set href(value: string) {
            navigatedTo = value;
          },
        },
      });

      authState.user = null;
      authState.isAuthenticated = false;
      loginMock.mockResolvedValue({
        id: 'user-1',
        email: 'staff@example.com',
        fullName: 'Staff Member',
        roles: ['staff'],
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'staff@example.com' } });
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret123' } });
      await user.click(screen.getByRole('button', { name: 'title' }));

      await waitFor(() => {
        expect(loginMock).toHaveBeenCalledWith('staff@example.com', 'secret123', undefined);
      });
      await waitFor(() => {
        expect(navigatedTo).toBe('/demo/staff');
      });
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
  });
});
