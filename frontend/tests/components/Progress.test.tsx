import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Progress } from '@/components/ui/Progress';

describe('Progress Component', () => {
  describe('Rendering', () => {
    it('should render a progress bar', () => {
      render(<Progress data-testid="progress" />);
      expect(screen.getByTestId('progress')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      render(<Progress className="custom-progress" data-testid="progress" />);
      expect(screen.getByTestId('progress')).toHaveClass('custom-progress');
    });
  });

  describe('Value', () => {
    it('should show 0% progress by default', () => {
      render(<Progress data-testid="progress" />);
      const progressBar = screen.getByTestId('progress');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveStyle({ transform: 'translateX(-100%)' });
    });

    it('should show 50% progress', () => {
      render(<Progress value={50} data-testid="progress" />);
      const progressBar = screen.getByTestId('progress');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveStyle({ transform: 'translateX(-50%)' });
    });

    it('should show 100% progress', () => {
      render(<Progress value={100} data-testid="progress" />);
      const progressBar = screen.getByTestId('progress');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveStyle({ transform: 'translateX(-0%)' });
    });

    it('should show 25% progress', () => {
      render(<Progress value={25} data-testid="progress" />);
      const progressBar = screen.getByTestId('progress');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveStyle({ transform: 'translateX(-75%)' });
    });

    it('should show 75% progress', () => {
      render(<Progress value={75} data-testid="progress" />);
      const progressBar = screen.getByTestId('progress');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveStyle({ transform: 'translateX(-25%)' });
    });
  });

  describe('Base Styles', () => {
    it('should have relative positioning', () => {
      render(<Progress data-testid="progress" />);
      expect(screen.getByTestId('progress')).toHaveClass('relative');
    });

    it('should have correct height', () => {
      render(<Progress data-testid="progress" />);
      expect(screen.getByTestId('progress')).toHaveClass('h-4');
    });

    it('should have full width', () => {
      render(<Progress data-testid="progress" />);
      expect(screen.getByTestId('progress')).toHaveClass('w-full');
    });

    it('should have overflow hidden', () => {
      render(<Progress data-testid="progress" />);
      expect(screen.getByTestId('progress')).toHaveClass('overflow-hidden');
    });

    it('should have rounded corners', () => {
      render(<Progress data-testid="progress" />);
      expect(screen.getByTestId('progress')).toHaveClass('rounded-full');
    });

    it('should have secondary background color', () => {
      render(<Progress data-testid="progress" />);
      expect(screen.getByTestId('progress')).toHaveClass('bg-secondary');
    });
  });

  describe('Indicator Styles', () => {
    it('should have full height indicator', () => {
      render(<Progress value={50} data-testid="progress" />);
      const progressBar = screen.getByTestId('progress');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('h-full');
    });

    it('should have full width indicator', () => {
      render(<Progress value={50} data-testid="progress" />);
      const progressBar = screen.getByTestId('progress');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('w-full');
    });

    it('should have primary background on indicator', () => {
      render(<Progress value={50} data-testid="progress" />);
      const progressBar = screen.getByTestId('progress');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('bg-primary');
    });

    it('should have transition on indicator', () => {
      render(<Progress value={50} data-testid="progress" />);
      const progressBar = screen.getByTestId('progress');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveClass('transition-all');
    });
  });

  describe('Edge Cases', () => {
    it('should handle value of 0', () => {
      render(<Progress value={0} data-testid="progress" />);
      const progressBar = screen.getByTestId('progress');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveStyle({ transform: 'translateX(-100%)' });
    });

    it('should handle undefined value', () => {
      render(<Progress value={undefined} data-testid="progress" />);
      const progressBar = screen.getByTestId('progress');
      const indicator = progressBar.querySelector('div');
      expect(indicator).toHaveStyle({ transform: 'translateX(-100%)' });
    });
  });

  describe('HTML Attributes', () => {
    it('should pass through data attributes', () => {
      render(<Progress data-custom="value" data-testid="progress" />);
      expect(screen.getByTestId('progress')).toHaveAttribute('data-custom', 'value');
    });

    it('should pass through id', () => {
      render(<Progress id="my-progress" data-testid="progress" />);
      expect(screen.getByTestId('progress')).toHaveAttribute('id', 'my-progress');
    });

    it('should pass through aria attributes', () => {
      render(
        <Progress 
          aria-label="Loading progress" 
          aria-valuenow={50}
          data-testid="progress" 
        />
      );
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveAttribute('aria-label', 'Loading progress');
      expect(progress).toHaveAttribute('aria-valuenow', '50');
    });
  });
});
