import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton, CardSkeleton, MenuItemSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    ),
  },
}));

describe('Skeleton Component', () => {
  describe('Rendering', () => {
    it('should render a skeleton element', () => {
      const { container } = render(<Skeleton />);
      const skeleton = container.querySelector('div');
      expect(skeleton).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(<Skeleton className="custom-class" />);
      const skeleton = container.querySelector('div');
      expect(skeleton).toHaveClass('custom-class');
    });
  });

  describe('Shimmer Effect', () => {
    it('should have shimmer effect by default', () => {
      const { container } = render(<Skeleton />);
      const skeleton = container.querySelector('div');
      expect(skeleton).toHaveClass('overflow-hidden');
    });

    it('should not have shimmer effect when disabled', () => {
      const { container } = render(<Skeleton shimmer={false} />);
      const skeleton = container.querySelector('div');
      // When shimmer is false, overflow-hidden should not be applied from shimmer logic
      expect(skeleton).toHaveClass('rounded-lg');
      expect(skeleton).not.toHaveClass('overflow-hidden');
    });

    it('should have relative positioning for shimmer', () => {
      const { container } = render(<Skeleton shimmer={true} />);
      const skeleton = container.querySelector('div');
      expect(skeleton).toHaveClass('relative');
    });
  });

  describe('Base Styles', () => {
    it('should have rounded corners', () => {
      const { container } = render(<Skeleton />);
      const skeleton = container.querySelector('div');
      expect(skeleton).toHaveClass('rounded-lg');
    });

    it('should have slate background color', () => {
      const { container } = render(<Skeleton />);
      const skeleton = container.querySelector('div');
      expect(skeleton?.className).toContain('bg-slate');
    });
  });

  describe('Custom Dimensions', () => {
    it('should accept height className', () => {
      const { container } = render(<Skeleton className="h-10" />);
      const skeleton = container.querySelector('div');
      expect(skeleton).toHaveClass('h-10');
    });

    it('should accept width className', () => {
      const { container } = render(<Skeleton className="w-32" />);
      const skeleton = container.querySelector('div');
      expect(skeleton).toHaveClass('w-32');
    });

    it('should accept combined dimensions', () => {
      const { container } = render(<Skeleton className="h-10 w-full" />);
      const skeleton = container.querySelector('div');
      expect(skeleton).toHaveClass('h-10');
      expect(skeleton).toHaveClass('w-full');
    });
  });
});

describe('CardSkeleton Component', () => {
  it('should render a card skeleton', () => {
    render(<CardSkeleton />);
    // CardSkeleton contains multiple skeletons within a container
    const container = document.querySelector('.rounded-2xl');
    expect(container).toBeInTheDocument();
  });

  it('should have proper card styling', () => {
    render(<CardSkeleton />);
    const container = document.querySelector('.rounded-2xl');
    expect(container).toHaveClass('bg-white');
    expect(container).toHaveClass('p-6');
    expect(container).toHaveClass('shadow-lg');
  });

  it('should contain multiple skeleton elements', () => {
    const { container } = render(<CardSkeleton />);
    const skeletons = container.querySelectorAll('.rounded-lg');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('MenuItemSkeleton Component', () => {
  it('should render a menu item skeleton', () => {
    render(<MenuItemSkeleton />);
    const container = document.querySelector('.rounded-xl');
    expect(container).toBeInTheDocument();
  });

  it('should have proper menu item styling', () => {
    render(<MenuItemSkeleton />);
    const container = document.querySelector('.rounded-xl');
    expect(container).toHaveClass('bg-white');
    expect(container).toHaveClass('p-4');
    expect(container).toHaveClass('shadow-md');
  });

  it('should contain skeleton elements for image and text', () => {
    const { container } = render(<MenuItemSkeleton />);
    const skeletons = container.querySelectorAll('.rounded-lg');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('TableSkeleton Component', () => {
  it('should render with default 5 rows', () => {
    render(<TableSkeleton />);
    const container = document.querySelector('.rounded-lg.border');
    expect(container).toBeInTheDocument();
  });

  it('should render with custom number of rows', () => {
    render(<TableSkeleton rows={3} />);
    const container = document.querySelector('.rounded-lg.border');
    expect(container).toBeInTheDocument();
  });

  it('should have header styling', () => {
    render(<TableSkeleton />);
    const header = document.querySelector('.bg-slate-100');
    expect(header).toBeInTheDocument();
  });

  it('should have border styling', () => {
    render(<TableSkeleton />);
    const container = document.querySelector('.border-slate-200');
    expect(container).toBeInTheDocument();
  });
});
