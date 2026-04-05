import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

const apiMocks = vi.hoisted(() => ({
  get2FAStatus: vi.fn(),
  setup2FA: vi.fn(),
  enable2FA: vi.fn(),
  disable2FA: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => () => undefined,
}));

vi.mock('@/lib/api', () => ({
  authApi: apiMocks,
}));

vi.mock('sonner', () => ({
  toast: toastMocks,
}));

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  CardHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  CardTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }) => (
    <h2 {...props}>{children}</h2>
  ),
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/Input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

import { TwoFactorSettings } from '../../src/components/settings/TwoFactorSettings';

describe('TwoFactorSettings behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    apiMocks.get2FAStatus.mockResolvedValue({
      data: {
        data: { enabled: false },
      },
    });

    apiMocks.setup2FA.mockResolvedValue({
      data: {
        data: {
          qrCodeDataUrl: 'data:image/png;base64,abc123',
          secret: 'SECRET123',
          backupCodes: ['BACKUP-1', 'BACKUP-2'],
        },
      },
    });

    apiMocks.enable2FA.mockResolvedValue({
      data: {
        data: {
          backupCodes: ['NEW-1', 'NEW-2'],
        },
      },
    });

    apiMocks.disable2FA.mockResolvedValue({
      data: { success: true },
    });

    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it('starts setup when 2FA is disabled', async () => {
    const user = userEvent.setup();
    render(<TwoFactorSettings />);

    expect(await screen.findByText('2FA is not enabled')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Enable 2FA/i }));

    expect(apiMocks.setup2FA).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Scan QR Code')).toBeInTheDocument();
    expect(screen.getByAltText('2FA QR Code')).toBeInTheDocument();
    expect(screen.getByText('SECRET123')).toBeInTheDocument();
  });

  it('enables 2FA, allows copying backup codes, and finishes setup', async () => {
    const user = userEvent.setup();
    apiMocks.get2FAStatus
      .mockResolvedValueOnce({ data: { data: { enabled: false } } })
      .mockResolvedValueOnce({ data: { data: { enabled: true, backupCodesRemaining: 2 } } });

    render(<TwoFactorSettings />);

    await user.click(await screen.findByRole('button', { name: /Enable 2FA/i }));

    const verifyInput = await screen.findByPlaceholderText('000000');
    fireEvent.change(verifyInput, { target: { value: '123456' } });
    await user.click(screen.getByRole('button', { name: /Verify & Enable/i }));

    await screen.findByText('2FA Enabled Successfully!');
    expect(apiMocks.enable2FA).toHaveBeenCalledWith('123456');
    expect(toastMocks.success).toHaveBeenCalledWith('Two-factor authentication enabled!');

    await user.click(screen.getByRole('button', { name: /Copy all codes/i }));
    expect(await screen.findByRole('button', { name: /Copied!/i })).toBeInTheDocument();
    expect(toastMocks.success).toHaveBeenCalledWith('Backup codes copied to clipboard');

    await user.click(screen.getByRole('button', { name: /I\'ve saved my codes/i }));

    await waitFor(() => {
      expect(screen.getByText('2FA is enabled')).toBeInTheDocument();
    });
  });

  it('disables 2FA with a valid confirmation code', async () => {
    const user = userEvent.setup();
    apiMocks.get2FAStatus.mockResolvedValue({
      data: {
        data: {
          enabled: true,
          backupCodesRemaining: 5,
        },
      },
    });

    render(<TwoFactorSettings />);

    await user.click(await screen.findByRole('button', { name: /Disable 2FA/i }));

    const disableInput = await screen.findByPlaceholderText('000000');
    fireEvent.change(disableInput, { target: { value: '654321' } });
    await user.click(screen.getByRole('button', { name: /Disable 2FA/i }));

    await waitFor(() => {
      expect(apiMocks.disable2FA).toHaveBeenCalledWith('654321');
    });
    expect(toastMocks.success).toHaveBeenCalledWith('Two-factor authentication disabled');
  });
});
