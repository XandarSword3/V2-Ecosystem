import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/Input';

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render an input element', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('should render with placeholder', () => {
      render(<Input placeholder="Enter text..." />);
      expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      render(<Input className="custom-input" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('custom-input');
    });

    it('should render with default value', () => {
      render(<Input defaultValue="Default text" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveValue('Default text');
    });
  });

  describe('Input Types', () => {
    it('should render input element', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('should render password input', () => {
      render(<Input type="password" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'password');
    });

    it('should render email input', () => {
      render(<Input type="email" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');
    });

    it('should render number input', () => {
      render(<Input type="number" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'number');
    });
  });

  describe('Variants', () => {
    it('should apply default variant', () => {
      render(<Input variant="default" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('bg-white/70');
    });

    it('should apply glass variant', () => {
      render(<Input variant="glass" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('bg-white/40');
    });

    it('should apply filled variant', () => {
      render(<Input variant="filled" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('bg-slate-100');
    });
  });

  describe('Error State', () => {
    it('should apply error styles when error is true', () => {
      render(<Input error data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.className).toContain('border-red');
    });

    it('should show helper text with error styling', () => {
      render(<Input error helperText="This field is required" />);
      const helperText = screen.getByText('This field is required');
      expect(helperText).toHaveClass('text-red-500');
    });

    it('should show helper text without error styling', () => {
      render(<Input helperText="Enter your email" />);
      const helperText = screen.getByText('Enter your email');
      expect(helperText).not.toHaveClass('text-red-500');
    });
  });

  describe('User Interaction', () => {
    it('should allow typing', async () => {
      const user = userEvent.setup();
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      
      await user.type(input, 'Hello World');
      expect(input).toHaveValue('Hello World');
    });

    it('should handle onChange', async () => {
      const user = userEvent.setup();
      let value = '';
      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        value = e.target.value;
      };
      
      render(<Input onChange={handleChange} data-testid="input" />);
      const input = screen.getByTestId('input');
      
      await user.type(input, 'Test');
      expect(value).toBe('Test');
    });

    it('should be focusable', async () => {
      const user = userEvent.setup();
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      
      await user.click(input);
      expect(input).toHaveFocus();
    });
  });

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<Input disabled data-testid="input" />);
      expect(screen.getByTestId('input')).toBeDisabled();
    });

    it('should have disabled styling', () => {
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('disabled:cursor-not-allowed');
      expect(input).toHaveClass('disabled:opacity-50');
    });
  });

  describe('Required State', () => {
    it('should be required when required prop is true', () => {
      render(<Input required data-testid="input" />);
      expect(screen.getByTestId('input')).toBeRequired();
    });
  });

  describe('Base Styles', () => {
    it('should have rounded corners', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('rounded-xl');
    });

    it('should have consistent height', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('h-11');
    });

    it('should have full width', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('w-full');
    });

    it('should have transition effects', () => {
      render(<Input data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveClass('transition-all');
    });
  });

  describe('Accessibility', () => {
    it('should support aria-label', () => {
      render(<Input aria-label="Email address" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('aria-label', 'Email address');
    });

    it('should support aria-describedby', () => {
      render(<Input aria-describedby="email-help" data-testid="input" />);
      expect(screen.getByTestId('input')).toHaveAttribute('aria-describedby', 'email-help');
    });

    it('should have focus ring for keyboard navigation', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input.className).toContain('focus:ring-2');
    });
  });
});
