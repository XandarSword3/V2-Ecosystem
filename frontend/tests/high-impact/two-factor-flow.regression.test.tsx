/**
 * 2FA Login Flow Regression Tests
 *
 * These tests verify the authentication flow for 2FA-enabled accounts:
 *
 * 1. useEffect does NOT redirect during 2FA intermediate state
 * 2. 2FA form appears after login returns requiresTwoFactor
 * 3. Invalid 2FA code shows error, does NOT create session
 * 4. setup2FAWithToken is NOT called for already-enrolled users
 * 5. setup2FA with already-enabled returns 400
 *
 * BUG FIX: Previously, the useEffect redirect in the login page could fire
 * during the 2FA intermediate state if validateSession() completed after
 * the user clicked Submit. This wiped the 2FA form and sent the user back
 * to the login page. The fix adds !show2FA && !setupToken guards to the
 * useEffect redirect condition.
 */

import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────

const replaceMock = vi.hoisted(() => vi.fn());
const loginMock = vi.hoisted(() => vi.fn());
const verify2FAMock = vi.hoisted(() => vi.fn());
const setup2FAWithTokenMock = vi.hoisted(() => vi.fn());
const setup2FAMock = vi.hoisted(() => vi.fn());

const authState = vi.hoisted(() => ({
  user: null as { id: string; roles: string[]; is_platform_admin?: boolean } | null,
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
    },
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('next/navigation', () => ({
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

vi.mock('@/lib/settings-context', () => ({
  useSiteSettings: () => ({
    settings: { propertySlug: 'test-property' },
  }),
}));

vi.mock('@/lib/api', () => ({
  authApi: {
    setup2FA: setup2FAMock,
    setup2FAWithToken: setup2FAWithTokenMock,
    enable2FAWithToken: vi.fn(),
  },
}));

vi.mock('@/components/auth/TurnstileCaptcha', () => ({
  TurnstileCaptcha: () => <div data-testid="captcha" />,
}));

vi.mock('@/types', () => ({
  getApiErrorMessage: (err: any, fallback: string) => err?.message || fallback,
}));

vi.mock('next-intl', () => ({
  useTranslations: (prefix: string) => (key: string) => {
    const translations: Record<string, string> = {
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot Password?',
      title: 'Login',
      signingIn: 'Signing in...',
      orContinueWith: 'Or continue with',
      continueWithGoogle: 'Continue with Google',
      facebookComingSoon: 'Facebook (Coming Soon)',
      continueWithApple: 'Continue with Apple',
      noAccount: "Don't have an account?",
      signUp: 'Sign Up',
      welcomeBack: 'Welcome Back',
      signInToAccount: 'Sign in to your account',
      demoCredentials: 'Demo Credentials',
      superAdmin: 'Super Admin',
      backToHome: '← Back to Home',
    };
    return translations[key] || key;
  },
}));

import LoginPage from '../../src/app/login/page';

// ── Tests ───────────────────────────────────────────────────────────────

describe('2FA Login Flow Regression', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    loginMock.mockReset();
    verify2FAMock.mockReset();
    setup2FAWithTokenMock.mockReset();
    setup2FAMock.mockReset();

    authState.user = null;
    authState.isAuthenticated = false;
  });

  it('does NOT redirect when isAuthenticated becomes true during 2FA intermediate state', async () => {
    // Simulate the race condition:
    // 1. User submits login → returns requiresTwoFactor
    // 2. show2FA is set to true
    // 3. validateSession() completes and sets user (stale session)
    // 4. useEffect should NOT redirect because show2FA is true

    let resolveLogin: (value: any) => void;
    loginMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    render(<LoginPage />);

    // Fill in credentials
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'admin123' } });

    // Submit — login is still pending
    fireEvent.click(screen.getByText('Login'));

    // Wait for loading state
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalled();
    });

    // Simulate: login returns requiresTwoFactor
    act(() => {
      resolveLogin!({
        requiresTwoFactor: true,
        userId: 'user-1',
        email: 'admin@example.com',
      });
    });

    // Wait for 2FA form to appear
    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeTruthy();
    });

    // Now simulate: validateSession() completes and sets user (stale session)
    // This would trigger the useEffect redirect
    act(() => {
      authState.user = { id: 'stale-user', roles: ['admin'] };
      authState.isAuthenticated = true;
    });

    // Give the useEffect time to fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // CRITICAL: router.replace should NOT have been called
    // The useEffect redirect should be blocked by !show2FA guard
    expect(replaceMock).not.toHaveBeenCalled();

    // 2FA form should still be visible
    expect(screen.getByText('Two-Factor Authentication')).toBeTruthy();
    expect(screen.getByText('Verification Code')).toBeTruthy();
  });

  it('shows 2FA form after login returns requiresTwoFactor', async () => {
    loginMock.mockResolvedValue({
      requiresTwoFactor: true,
      userId: 'user-2fa',
      email: 'user@example.com',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeTruthy();
      expect(screen.getByText('Verification Code')).toBeTruthy();
      expect(screen.getByText('Verify & Sign In')).toBeTruthy();
    });
  });

  it('does NOT call verify2FA until user enters code and submits', async () => {
    loginMock.mockResolvedValue({
      requiresTwoFactor: true,
      userId: 'user-2fa',
      email: 'user@example.com',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeTruthy();
    });

    // verify2FA should NOT have been called yet
    expect(verify2FAMock).not.toHaveBeenCalled();
  });

  it('does NOT call setup2FAWithToken for already-enrolled user', async () => {
    loginMock.mockResolvedValue({
      requiresTwoFactor: true,
      userId: 'user-2fa',
      email: 'user@example.com',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeTruthy();
    });

    // CRITICAL: setup2FAWithToken should NOT be called for an already-enrolled user
    // It's only for requiresTwoFactorSetup (mandatory enrollment)
    expect(setup2FAWithTokenMock).not.toHaveBeenCalled();
  });

  it('redirects to staff page after successful 2FA verification', async () => {
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, set href(v: string) { hrefSetter(v); } },
      writable: true,
      configurable: true,
    });

    loginMock.mockResolvedValue({
      requiresTwoFactor: true,
      userId: 'staff-1',
      email: 'staff@example.com',
    });

    verify2FAMock.mockResolvedValue({
      id: 'staff-1',
      email: 'staff@example.com',
      roles: ['staff'],
      is_platform_admin: false,
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'staff@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Login'));

    // Wait for 2FA form
    await waitFor(() => {
      expect(screen.getByText('Verification Code')).toBeTruthy();
    });

    // Enter code and submit
    const codeInput = screen.getByPlaceholderText('000000');
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verify & Sign In'));

    // Should redirect to staff page
    await waitFor(() => {
      expect(verify2FAMock).toHaveBeenCalledWith('staff-1', '123456');
      expect(hrefSetter).toHaveBeenCalledWith('/test-property/staff');
    });
  });

  it('shows error when 2FA verification fails', async () => {
    loginMock.mockResolvedValue({
      requiresTwoFactor: true,
      userId: 'user-2fa',
      email: 'user@example.com',
    });

    verify2FAMock.mockRejectedValue(new Error('Invalid verification code'));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByText('Verification Code')).toBeTruthy();
    });

    // Enter code and submit
    const codeInput = screen.getByPlaceholderText('000000');
    fireEvent.change(codeInput, { target: { value: '000000' } });
    fireEvent.click(screen.getByText('Verify & Sign In'));

    // Should show error, NOT redirect
    await waitFor(() => {
      expect(screen.getByText('Invalid verification code')).toBeTruthy();
    });

    // 2FA form should still be visible (NOT redirected away)
    expect(screen.getByText('Two-Factor Authentication')).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects authenticated admin away from login page immediately', async () => {
    authState.user = { id: 'admin-1', roles: ['admin'] };
    authState.isAuthenticated = true;

    render(<LoginPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/test-property/admin');
    });
  });

  it('does NOT redirect during setupToken enrollment flow', async () => {
    // Simulate requiresTwoFactorSetup flow
    loginMock.mockImplementation(() => {
      // Set the requiresTwoFactorSetup result
      return Promise.resolve({
        requiresTwoFactorSetup: true,
        userId: 'admin-1',
        email: 'admin@example.com',
        twoFactorSetupToken: 'setup-token-123',
      });
    });

    // Mock the setup2FAWithToken to fail (simulating the "already enabled" error)
    setup2FAWithTokenMock.mockRejectedValue({
      response: { data: { error: '2FA is already enabled. Disable it first to set up again.' } },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'admin123' } });
    fireEvent.click(screen.getByText('Login'));

    // Wait for the error to appear
    await waitFor(() => {
      expect(screen.getByText(/Failed to start 2FA enrollment/)).toBeTruthy();
    });

    // setup2FAWithToken should have been called
    expect(setup2FAWithTokenMock).toHaveBeenCalledWith('setup-token-123');

    // Should NOT have redirected
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
