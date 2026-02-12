/**
 * Tests for Input component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input data-testid="input" />);
    expect(screen.getByTestId('input')).toBeTruthy();
  });

  it('renders with correct type', () => {
    render(<Input type="email" data-testid="input" />);
    expect(screen.getByTestId('input').getAttribute('type')).toBe('email');
  });

  it('renders with placeholder', () => {
    render(<Input placeholder="Enter email" />);
    expect(screen.getByPlaceholderText('Enter email')).toBeTruthy();
  });

  it('renders with default variant styling', () => {
    const { container } = render(<Input data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input.className).toContain('rounded-xl');
  });

  it('shows helper text', () => {
    render(<Input helperText="This field is required" />);
    expect(screen.getByText('This field is required')).toBeTruthy();
  });

  it('shows error styling when error prop is true', () => {
    render(<Input error helperText="Invalid email" />);
    const text = screen.getByText('Invalid email');
    expect(text.className).toContain('text-red');
  });

  it('handles value changes', () => {
    const onChange = vi.fn();
    render(<Input data-testid="input" onChange={onChange} />);
    
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('can be disabled', () => {
    render(<Input disabled data-testid="input" />);
    expect(screen.getByTestId('input')).toHaveProperty('disabled', true);
  });

  it('accepts additional className', () => {
    render(<Input className="my-class" data-testid="input" />);
    expect(screen.getByTestId('input').className).toContain('my-class');
  });

  it('forwards ref', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('renders glass variant', () => {
    render(<Input variant="glass" data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input.className).toContain('backdrop-blur-xl');
  });

  it('renders filled variant', () => {
    render(<Input variant="filled" data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input.className).toContain('border-transparent');
  });
});
