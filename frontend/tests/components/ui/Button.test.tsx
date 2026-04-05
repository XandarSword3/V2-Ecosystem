import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, whileHover, whileTap, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

vi.mock('lucide-react', () => ({
  Loader2: (props: any) => <svg data-testid="loader-icon" {...props} />,
}));

import { Button, GlassButton } from '@/components/ui/Button';

describe('Button', () => {
  it('renders button label', () => {
    render(<Button>Book Now</Button>);

    expect(screen.getByRole('button', { name: 'Book Now' })).toBeInTheDocument();
  });

  it('calls click handler when enabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continue</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders left and right icons when provided', () => {
    render(
      <Button leftIcon={<span data-testid="left-icon">L</span>} rightIcon={<span data-testid="right-icon">R</span>}>
        Icons
      </Button>
    );

    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  it('disables interactions and hides right icon while loading', () => {
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick} rightIcon={<span data-testid="right-icon">R</span>}>
        Save
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies full-width utility class when fullWidth is true', () => {
    render(<Button fullWidth>Full Width</Button>);

    expect(screen.getByRole('button', { name: 'Full Width' })).toHaveClass('w-full');
  });
});

describe('GlassButton', () => {
  it('uses glass styling wrapper class', () => {
    render(<GlassButton>Premium</GlassButton>);

    expect(screen.getByRole('button', { name: 'Premium' })).toHaveClass('hover:shadow-2xl');
  });
});
