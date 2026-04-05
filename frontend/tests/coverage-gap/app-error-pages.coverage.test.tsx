import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', async () => {
  const React = await import('react');

  return {
    default: ({ href, children }: { href: string; children: React.ReactNode }) => (
      <a href={href}>{children}</a>
    ),
  };
});

vi.mock('@/components/ui/Button', async () => {
  const React = await import('react');

  return {
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
  };
});

vi.mock('lucide-react', async () => {
  const React = await import('react');

  const iconFactory = (name: string) => {
    const Icon = ({ className }: { className?: string }) => (
      <span data-icon={name} className={className}>
        {name}
      </span>
    );

    Icon.displayName = `${name}Icon`;
    return Icon;
  };

  return {
    AlertTriangle: iconFactory('AlertTriangle'),
    RefreshCw: iconFactory('RefreshCw'),
    Home: iconFactory('Home'),
  };
});

import AppError from '../../src/app/error';
import GlobalError from '../../src/app/global-error';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App error pages coverage', () => {
  it('renders app error details and retries via reset', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const error = Object.assign(new Error('boom'), { digest: 'ERR-123' });

    render(<AppError error={error} reset={reset} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Error ID: ERR-123')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Try Again/i }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Application error:', error);
  });

  it('renders app error without digest block when digest is absent', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reset = vi.fn();

    render(<AppError error={new Error('generic')} reset={reset} />);

    expect(screen.queryByText(/Error ID:/i)).not.toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Application error:', expect.any(Error));
  });

  it('renders global error and triggers reset action', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const error = Object.assign(new Error('global boom'), { digest: 'GLOBAL-9' });

    render(<GlobalError error={error} reset={reset} />);

    expect(screen.getByText('Critical Error')).toBeInTheDocument();
    expect(screen.getByText('Error ID: GLOBAL-9')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Try Again/i }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Global application error:', error);
  });
});
