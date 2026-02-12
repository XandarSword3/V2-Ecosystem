/**
 * Tests for cn() utility (Tailwind class merger)
 */
import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/cn';

describe('cn utility', () => {
  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('passes through a single class', () => {
    expect(cn('px-4')).toBe('px-4');
  });

  it('merges multiple class strings', () => {
    const result = cn('px-4', 'py-2', 'text-sm');
    expect(result).toContain('px-4');
    expect(result).toContain('py-2');
    expect(result).toContain('text-sm');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    const result = cn('px-4', 'px-8');
    expect(result).toBe('px-8');
  });

  it('resolves color conflicts', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('handles conditional classes via clsx', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active');
    expect(result).toContain('base');
    expect(result).toContain('active');
  });

  it('filters out falsy values', () => {
    const result = cn('base', false, null, undefined, '', 'extra');
    expect(result).toBe('base extra');
  });

  it('handles object syntax', () => {
    const result = cn({ 'bg-red-500': true, 'bg-blue-500': false });
    expect(result).toBe('bg-red-500');
  });

  it('handles array syntax', () => {
    const result = cn(['px-4', 'py-2']);
    expect(result).toContain('px-4');
    expect(result).toContain('py-2');
  });

  it('merges padding conflicts correctly', () => {
    const result = cn('p-4', 'px-8');
    // twMerge should keep both since px is more specific
    expect(result).toContain('px-8');
  });
});
