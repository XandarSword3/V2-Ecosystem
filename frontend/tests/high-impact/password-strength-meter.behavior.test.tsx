import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PasswordStrengthMeter, usePasswordValidation } from '../../src/components/PasswordStrengthMeter';

function ControlledMeter({ onStrengthChange }: { onStrengthChange?: (strength: any) => void }) {
  const [value, setValue] = useState('');

  return (
    <PasswordStrengthMeter
      value={value}
      onChange={setValue}
      onStrengthChange={onStrengthChange}
      showRequirements
      placeholder="Enter password"
    />
  );
}

describe('PasswordStrengthMeter behavior', () => {
  it('shows weak feedback and requirements for short/common passwords', async () => {
    const user = userEvent.setup();

    render(<ControlledMeter />);

    await user.type(screen.getByPlaceholderText('Enter password'), 'pass');

    expect(screen.getByText('Weak')).toBeInTheDocument();
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('One number')).toBeInTheDocument();
    expect(screen.getByText('Not a common password')).toBeInTheDocument();
  });

  it('updates strength to strong and toggles password visibility', async () => {
    const user = userEvent.setup();
    const onStrengthChange = vi.fn();

    render(<ControlledMeter onStrengthChange={onStrengthChange} />);

    const input = screen.getByPlaceholderText('Enter password') as HTMLInputElement;
    await user.type(input, 'ValidPass1!');

    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(onStrengthChange).toHaveBeenCalled();
    expect(onStrengthChange.mock.calls[onStrengthChange.mock.calls.length - 1][0].level).toBe('strong');

    const toggleButton = screen.getByRole('button');
    expect(input.type).toBe('password');

    await user.click(toggleButton);
    expect((screen.getByPlaceholderText('Enter password') as HTMLInputElement).type).toBe('text');
  });

  it('validates password rules via usePasswordValidation hook', () => {
    const { result, rerender } = renderHook(({ pwd }: { pwd: string }) => usePasswordValidation(pwd), {
      initialProps: { pwd: 'password123' },
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errors.length).toBeGreaterThan(0);
    expect(result.current.meetsMinimum('fair')).toBe(false);

    rerender({ pwd: 'ValidPass1!' });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errors).toEqual([]);
    expect(result.current.meetsMinimum('good')).toBe(true);
  });
});
