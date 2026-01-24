/**
 * Badge Component Tests
 * 
 * Tests for Badge and CountBadge components
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Badge, CountBadge } from '../../src/components/ui/Badge';

describe('Badge', () => {
  describe('rendering', () => {
    it('should render with label', () => {
      const { getByText } = render(<Badge label="Test" />);
      expect(getByText('Test')).toBeTruthy();
    });

    it('should render with default variant', () => {
      const { getByText } = render(<Badge label="Default" />);
      expect(getByText('Default')).toBeTruthy();
    });

    it('should render success variant', () => {
      const { getByText } = render(<Badge label="Success" variant="success" />);
      expect(getByText('Success')).toBeTruthy();
    });

    it('should render warning variant', () => {
      const { getByText } = render(<Badge label="Warning" variant="warning" />);
      expect(getByText('Warning')).toBeTruthy();
    });

    it('should render error variant', () => {
      const { getByText } = render(<Badge label="Error" variant="error" />);
      expect(getByText('Error')).toBeTruthy();
    });

    it('should render info variant', () => {
      const { getByText } = render(<Badge label="Info" variant="info" />);
      expect(getByText('Info')).toBeTruthy();
    });

    it('should render outline variant', () => {
      const { getByText } = render(<Badge label="Outline" variant="outline" />);
      expect(getByText('Outline')).toBeTruthy();
    });
  });

  describe('sizes', () => {
    it('should render small size', () => {
      const { getByText } = render(<Badge label="Small" size="sm" />);
      expect(getByText('Small')).toBeTruthy();
    });

    it('should render medium size', () => {
      const { getByText } = render(<Badge label="Medium" size="md" />);
      expect(getByText('Medium')).toBeTruthy();
    });

    it('should render large size', () => {
      const { getByText } = render(<Badge label="Large" size="lg" />);
      expect(getByText('Large')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('should accept testID prop', () => {
      const { getByTestId } = render(
        <Badge label="Test" testID="test-badge" />
      );
      expect(getByTestId('test-badge')).toBeTruthy();
    });
  });
});

describe('CountBadge', () => {
  describe('rendering', () => {
    it('should render with count', () => {
      const { getByText } = render(<CountBadge count={5} />);
      expect(getByText('5')).toBeTruthy();
    });

    it('should return null when count is 0', () => {
      const { queryByText } = render(<CountBadge count={0} />);
      expect(queryByText('0')).toBeNull();
    });

    it('should return null when count is negative', () => {
      const { queryByText } = render(<CountBadge count={-1} />);
      expect(queryByText('-1')).toBeNull();
    });
  });

  describe('max count', () => {
    it('should show exact count when under max', () => {
      const { getByText } = render(<CountBadge count={50} max={99} />);
      expect(getByText('50')).toBeTruthy();
    });

    it('should show 99+ when count exceeds default max', () => {
      const { getByText } = render(<CountBadge count={100} />);
      expect(getByText('99+')).toBeTruthy();
    });

    it('should show custom max+ when count exceeds custom max', () => {
      const { getByText } = render(<CountBadge count={20} max={9} />);
      expect(getByText('9+')).toBeTruthy();
    });
  });

  describe('variants', () => {
    it('should render primary variant', () => {
      const { getByText } = render(<CountBadge count={5} variant="primary" />);
      expect(getByText('5')).toBeTruthy();
    });

    it('should render error variant', () => {
      const { getByText } = render(<CountBadge count={5} variant="error" />);
      expect(getByText('5')).toBeTruthy();
    });
  });
});
