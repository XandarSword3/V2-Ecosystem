import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge Component', () => {
  describe('Rendering', () => {
    it('should render with default props', () => {
      render(<Badge>Default Badge</Badge>);
      expect(screen.getByText('Default Badge')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      render(<Badge className="custom-class">Custom</Badge>);
      const badge = screen.getByText('Custom');
      expect(badge).toHaveClass('custom-class');
    });

    it('should render children correctly', () => {
      render(<Badge><span data-testid="child">Child Content</span></Badge>);
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('should apply default variant styles', () => {
      render(<Badge variant="default">Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('bg-primary-500/15');
    });

    it('should apply secondary variant styles', () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      const badge = screen.getByText('Secondary');
      expect(badge).toHaveClass('bg-slate-500/10');
    });

    it('should apply destructive variant styles', () => {
      render(<Badge variant="destructive">Destructive</Badge>);
      const badge = screen.getByText('Destructive');
      expect(badge).toHaveClass('bg-red-500/15');
    });

    it('should apply success variant styles', () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText('Success');
      expect(badge).toHaveClass('bg-emerald-500/15');
    });

    it('should apply warning variant styles', () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText('Warning');
      expect(badge).toHaveClass('bg-amber-500/15');
    });

    it('should apply info variant styles', () => {
      render(<Badge variant="info">Info</Badge>);
      const badge = screen.getByText('Info');
      expect(badge).toHaveClass('bg-blue-500/15');
    });

    it('should apply outline variant styles', () => {
      render(<Badge variant="outline">Outline</Badge>);
      const badge = screen.getByText('Outline');
      expect(badge).toHaveClass('bg-transparent');
    });

    it('should apply glass variant styles', () => {
      render(<Badge variant="glass">Glass</Badge>);
      const badge = screen.getByText('Glass');
      expect(badge).toHaveClass('backdrop-blur-xl');
    });
  });

  describe('Sizes', () => {
    it('should apply small size', () => {
      render(<Badge size="sm">Small</Badge>);
      const badge = screen.getByText('Small');
      expect(badge).toHaveClass('px-2');
      expect(badge).toHaveClass('py-0.5');
    });

    it('should apply medium size (default)', () => {
      render(<Badge size="md">Medium</Badge>);
      const badge = screen.getByText('Medium');
      expect(badge).toHaveClass('px-3');
      expect(badge).toHaveClass('py-1');
    });

    it('should apply large size', () => {
      render(<Badge size="lg">Large</Badge>);
      const badge = screen.getByText('Large');
      expect(badge).toHaveClass('px-4');
      expect(badge).toHaveClass('py-1.5');
    });
  });

  describe('Base Styles', () => {
    it('should have rounded-full class', () => {
      render(<Badge>Rounded</Badge>);
      expect(screen.getByText('Rounded')).toHaveClass('rounded-full');
    });

    it('should have border class', () => {
      render(<Badge>Bordered</Badge>);
      expect(screen.getByText('Bordered')).toHaveClass('border');
    });

    it('should have font-semibold class', () => {
      render(<Badge>Bold</Badge>);
      expect(screen.getByText('Bold')).toHaveClass('font-semibold');
    });

    it('should have transition classes', () => {
      render(<Badge>Transition</Badge>);
      expect(screen.getByText('Transition')).toHaveClass('transition-all');
    });
  });

  describe('Accessibility', () => {
    it('should be focusable', () => {
      render(<Badge tabIndex={0}>Focusable</Badge>);
      const badge = screen.getByText('Focusable');
      expect(badge).toHaveAttribute('tabindex', '0');
    });

    it('should have focus ring styles', () => {
      render(<Badge>Focus Ring</Badge>);
      const badge = screen.getByText('Focus Ring');
      expect(badge.className).toContain('focus:ring-2');
    });
  });
});
