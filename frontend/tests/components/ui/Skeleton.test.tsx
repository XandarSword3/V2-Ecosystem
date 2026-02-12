/**
 * Tests for Skeleton component
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton, CardSkeleton, MenuItemSkeleton } from '@/components/ui/Skeleton';

describe('Skeleton', () => {
  it('renders a div element', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toBeTruthy();
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('applies shimmer by default', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('overflow-hidden');
  });

  it('can disable shimmer', () => {
    const { container } = render(<Skeleton shimmer={false} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toContain('overflow-hidden');
  });

  it('accepts custom className', () => {
    const { container } = render(<Skeleton className="h-40 w-full" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('h-40');
    expect(el.className).toContain('w-full');
  });

  it('includes base background classes', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-lg');
    expect(el.className).toContain('bg-slate-200');
  });
});

describe('CardSkeleton', () => {
  it('renders without errors', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('contains multiple skeleton elements', () => {
    const { container } = render(<CardSkeleton />);
    const skeletons = container.querySelectorAll('.rounded-lg');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('MenuItemSkeleton', () => {
  it('renders without errors', () => {
    const { container } = render(<MenuItemSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });
});
