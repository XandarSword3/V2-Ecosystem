/**
 * Skeleton Component Tests
 * 
 * Tests for Skeleton loading state components
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonMenuItem,
  SkeletonBookingCard,
} from '../../src/components/ui/Skeleton';

describe('Skeleton', () => {
  describe('basic rendering', () => {
    it('should render', () => {
      const { toJSON } = render(<Skeleton />);
      expect(toJSON()).toBeTruthy();
    });

    it('should render with custom width and height', () => {
      const { toJSON } = render(<Skeleton width={100} height={50} />);
      expect(toJSON()).toBeTruthy();
    });

    it('should render with percentage dimensions', () => {
      const { toJSON } = render(<Skeleton width="100%" height="50%" />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('variants', () => {
    it('should render text variant', () => {
      const { toJSON } = render(<Skeleton variant="text" />);
      expect(toJSON()).toBeTruthy();
    });

    it('should render circular variant', () => {
      const { toJSON } = render(<Skeleton variant="circular" />);
      expect(toJSON()).toBeTruthy();
    });

    it('should render rectangular variant', () => {
      const { toJSON } = render(<Skeleton variant="rectangular" />);
      expect(toJSON()).toBeTruthy();
    });

    it('should render rounded variant', () => {
      const { toJSON } = render(<Skeleton variant="rounded" />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('animation', () => {
    it('should render with animation enabled by default', () => {
      const { toJSON } = render(<Skeleton />);
      expect(toJSON()).toBeTruthy();
    });

    it('should render with animation disabled', () => {
      const { toJSON } = render(<Skeleton animate={false} />);
      expect(toJSON()).toBeTruthy();
    });
  });
});

describe('SkeletonText', () => {
  it('should render single line by default', () => {
    const { toJSON } = render(<SkeletonText />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render multiple lines', () => {
    const { toJSON } = render(<SkeletonText lines={3} />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render with custom last line width', () => {
    const { toJSON } = render(<SkeletonText lines={3} lastLineWidth={50} />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('SkeletonAvatar', () => {
  it('should render with default size', () => {
    const { toJSON } = render(<SkeletonAvatar />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render with custom size', () => {
    const { toJSON } = render(<SkeletonAvatar size={60} />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('SkeletonCard', () => {
  it('should render with image', () => {
    const { toJSON } = render(<SkeletonCard />);
    expect(toJSON()).toBeTruthy();
  });

  it('should render without image', () => {
    const { toJSON } = render(<SkeletonCard hasImage={false} />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('SkeletonMenuItem', () => {
  it('should render', () => {
    const { toJSON } = render(<SkeletonMenuItem />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('SkeletonBookingCard', () => {
  it('should render', () => {
    const { toJSON } = render(<SkeletonBookingCard />);
    expect(toJSON()).toBeTruthy();
  });
});
