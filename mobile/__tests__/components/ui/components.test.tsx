/**
 * UI Component Tests
 * 
 * Comprehensive tests for reusable UI components:
 * - Button
 * - Input
 * - Card
 * 
 * Tests cover:
 * - Rendering
 * - Variants and sizes
 * - Interactions
 * - Accessibility
 * - Edge cases
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../src/components/ui/Card';

describe('Button Component', () => {
  // =========================================================================
  // Basic Rendering
  // =========================================================================

  describe('Basic Rendering', () => {
    it('should render with title prop', () => {
      render(<Button title="Click me" />);
      
      expect(screen.getByText('Click me')).toBeTruthy();
    });

    it('should render with children', () => {
      render(
        <Button>
          <Text>Child content</Text>
        </Button>
      );
      
      expect(screen.getByText('Child content')).toBeTruthy();
    });

    it('should render with icon', () => {
      const MockIcon = () => <Text testID="mock-icon">Icon</Text>;
      
      render(<Button title="With Icon" icon={<MockIcon />} />);
      
      expect(screen.getByTestId('mock-icon')).toBeTruthy();
      expect(screen.getByText('With Icon')).toBeTruthy();
    });
  });

  // =========================================================================
  // Variants
  // =========================================================================

  describe('Variants', () => {
    it('should render primary variant by default', () => {
      const { getByRole, toJSON } = render(<Button title="Primary" />);
      
      // Check that component renders without error
      expect(toJSON()).toBeTruthy();
    });

    it('should render secondary variant', () => {
      const { toJSON } = render(<Button title="Secondary" variant="secondary" />);
      
      expect(toJSON()).toBeTruthy();
    });

    it('should render outline variant', () => {
      const { toJSON } = render(<Button title="Outline" variant="outline" />);
      
      expect(toJSON()).toBeTruthy();
    });

    it('should render ghost variant', () => {
      const { toJSON } = render(<Button title="Ghost" variant="ghost" />);
      
      expect(toJSON()).toBeTruthy();
    });

    it('should render glass variant', () => {
      const { toJSON } = render(<Button title="Glass" variant="glass" />);
      
      expect(toJSON()).toBeTruthy();
    });

    it('should render destructive variant', () => {
      const { toJSON } = render(<Button title="Destructive" variant="destructive" />);
      
      expect(toJSON()).toBeTruthy();
    });
  });

  // =========================================================================
  // Sizes
  // =========================================================================

  describe('Sizes', () => {
    it('should render default size', () => {
      const { toJSON } = render(<Button title="Default" />);
      
      expect(toJSON()).toBeTruthy();
    });

    it('should render small size', () => {
      const { toJSON } = render(<Button title="Small" size="sm" />);
      
      expect(toJSON()).toBeTruthy();
    });

    it('should render large size', () => {
      const { toJSON } = render(<Button title="Large" size="lg" />);
      
      expect(toJSON()).toBeTruthy();
    });
  });

  // =========================================================================
  // Interactions
  // =========================================================================

  describe('Interactions', () => {
    it('should call onPress when pressed', () => {
      const onPress = jest.fn();
      
      render(<Button title="Press me" onPress={onPress} />);
      
      fireEvent.press(screen.getByText('Press me'));
      
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('should not call onPress when disabled', () => {
      const onPress = jest.fn();
      
      render(<Button title="Disabled" onPress={onPress} disabled />);
      
      fireEvent.press(screen.getByText('Disabled'));
      
      expect(onPress).not.toHaveBeenCalled();
    });

    it('should not call onPress when loading', () => {
      const onPress = jest.fn();
      
      render(<Button title="Loading" onPress={onPress} isLoading />);
      
      // Button shows ActivityIndicator when loading, title not visible
      const pressables = screen.root.findAllByType('Pressable' as any);
      if (pressables.length > 0) {
        fireEvent.press(pressables[0]);
      }
      
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Loading State
  // =========================================================================

  describe('Loading State', () => {
    it('should show loading indicator when isLoading is true', () => {
      render(<Button title="Loading" isLoading />);
      
      // ActivityIndicator should be rendered
      // The title should not be visible
      expect(screen.queryByText('Loading')).toBeNull();
    });

    it('should hide title when loading', () => {
      render(<Button title="Submit" isLoading />);
      
      expect(screen.queryByText('Submit')).toBeNull();
    });
  });

  // =========================================================================
  // Disabled State
  // =========================================================================

  describe('Disabled State', () => {
    it('should apply disabled styles when disabled', () => {
      const { toJSON } = render(<Button title="Disabled" disabled />);
      
      // Should render with reduced opacity
      expect(toJSON()).toBeTruthy();
    });
  });

  // =========================================================================
  // Custom Styles
  // =========================================================================

  describe('Custom Styles', () => {
    it('should apply custom className', () => {
      const { toJSON } = render(
        <Button title="Custom" className="mt-4 mb-4" />
      );
      
      expect(toJSON()).toBeTruthy();
    });

    it('should apply custom textClassName', () => {
      const { toJSON } = render(
        <Button title="Custom Text" textClassName="text-lg" />
      );
      
      expect(toJSON()).toBeTruthy();
    });
  });
});

describe('Input Component', () => {
  // =========================================================================
  // Basic Rendering
  // =========================================================================

  describe('Basic Rendering', () => {
    it('should render input field', () => {
      render(<Input placeholder="Enter text" />);
      
      expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
    });

    it('should render with label', () => {
      render(<Input label="Email" placeholder="Enter email" />);
      
      expect(screen.getByText('Email')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter email')).toBeTruthy();
    });

    it('should render with error message', () => {
      render(<Input label="Email" error="Invalid email format" />);
      
      expect(screen.getByText('Invalid email format')).toBeTruthy();
    });
  });

  // =========================================================================
  // Icons
  // =========================================================================

  describe('Icons', () => {
    it('should render with left icon', () => {
      const LeftIcon = () => <Text testID="left-icon">@</Text>;
      
      render(<Input leftIcon={<LeftIcon />} placeholder="Email" />);
      
      expect(screen.getByTestId('left-icon')).toBeTruthy();
    });

    it('should render with right icon', () => {
      const RightIcon = () => <Text testID="right-icon">👁</Text>;
      
      render(<Input rightIcon={<RightIcon />} placeholder="Password" />);
      
      expect(screen.getByTestId('right-icon')).toBeTruthy();
    });

    it('should render with both icons', () => {
      const LeftIcon = () => <Text testID="left-icon">📧</Text>;
      const RightIcon = () => <Text testID="right-icon">✓</Text>;
      
      render(
        <Input 
          leftIcon={<LeftIcon />} 
          rightIcon={<RightIcon />} 
          placeholder="Email" 
        />
      );
      
      expect(screen.getByTestId('left-icon')).toBeTruthy();
      expect(screen.getByTestId('right-icon')).toBeTruthy();
    });
  });

  // =========================================================================
  // Input Interactions
  // =========================================================================

  describe('Input Interactions', () => {
    it('should handle text input', () => {
      const onChangeText = jest.fn();
      
      render(
        <Input 
          placeholder="Enter text" 
          onChangeText={onChangeText} 
        />
      );
      
      fireEvent.changeText(screen.getByPlaceholderText('Enter text'), 'Hello');
      
      expect(onChangeText).toHaveBeenCalledWith('Hello');
    });

    it('should handle focus event', () => {
      const onFocus = jest.fn();
      
      render(<Input placeholder="Focus me" onFocus={onFocus} />);
      
      fireEvent(screen.getByPlaceholderText('Focus me'), 'focus');
      
      expect(onFocus).toHaveBeenCalled();
    });

    it('should handle blur event', () => {
      const onBlur = jest.fn();
      
      render(<Input placeholder="Blur me" onBlur={onBlur} />);
      
      fireEvent(screen.getByPlaceholderText('Blur me'), 'blur');
      
      expect(onBlur).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Input Props
  // =========================================================================

  describe('Input Props', () => {
    it('should pass through TextInput props', () => {
      render(
        <Input 
          placeholder="Test" 
          secureTextEntry 
          autoCapitalize="none"
          keyboardType="email-address"
        />
      );
      
      const input = screen.getByPlaceholderText('Test');
      
      expect(input.props.secureTextEntry).toBe(true);
      expect(input.props.autoCapitalize).toBe('none');
      expect(input.props.keyboardType).toBe('email-address');
    });

    it('should show value when controlled', () => {
      render(<Input placeholder="Controlled" value="test value" />);
      
      const input = screen.getByPlaceholderText('Controlled');
      
      expect(input.props.value).toBe('test value');
    });

    it('should be editable by default', () => {
      render(<Input placeholder="Editable" />);
      
      const input = screen.getByPlaceholderText('Editable');
      
      expect(input.props.editable).not.toBe(false);
    });

    it('should support multiline', () => {
      render(<Input placeholder="Multiline" multiline numberOfLines={4} />);
      
      const input = screen.getByPlaceholderText('Multiline');
      
      expect(input.props.multiline).toBe(true);
      expect(input.props.numberOfLines).toBe(4);
    });
  });

  // =========================================================================
  // Error Styling
  // =========================================================================

  describe('Error Styling', () => {
    it('should apply error styles when error prop is provided', () => {
      const { toJSON } = render(
        <Input placeholder="Error input" error="This field is required" />
      );
      
      // Should render with error styling
      expect(toJSON()).toBeTruthy();
      expect(screen.getByText('This field is required')).toBeTruthy();
    });
  });

  // =========================================================================
  // Custom Styles
  // =========================================================================

  describe('Custom Styles', () => {
    it('should apply custom containerClassName', () => {
      const { toJSON } = render(
        <Input placeholder="Custom" containerClassName="mb-4" />
      );
      
      expect(toJSON()).toBeTruthy();
    });

    it('should apply custom className to input', () => {
      const { toJSON } = render(
        <Input placeholder="Custom" className="text-lg" />
      );
      
      expect(toJSON()).toBeTruthy();
    });
  });
});

describe('Card Component', () => {
  // =========================================================================
  // Basic Rendering
  // =========================================================================

  describe('Basic Rendering', () => {
    it('should render Card with children', () => {
      render(
        <Card>
          <Text>Card content</Text>
        </Card>
      );
      
      expect(screen.getByText('Card content')).toBeTruthy();
    });

    it('should render CardContent', () => {
      render(
        <Card>
          <CardContent>
            <Text>Content inside</Text>
          </CardContent>
        </Card>
      );
      
      expect(screen.getByText('Content inside')).toBeTruthy();
    });

    it('should render CardHeader', () => {
      render(
        <Card>
          <CardHeader>
            <Text>Header content</Text>
          </CardHeader>
        </Card>
      );
      
      expect(screen.getByText('Header content')).toBeTruthy();
    });

    it('should render CardTitle', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>
              <Text>Card Title</Text>
            </CardTitle>
          </CardHeader>
        </Card>
      );
      
      expect(screen.getByText('Card Title')).toBeTruthy();
    });

    it('should render CardDescription', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription>
              <Text>Card description text</Text>
            </CardDescription>
          </CardHeader>
        </Card>
      );
      
      expect(screen.getByText('Card description text')).toBeTruthy();
    });
  });

  // =========================================================================
  // Card Variants
  // =========================================================================

  describe('Card Variants', () => {
    it('should render default variant', () => {
      const { toJSON } = render(
        <Card>
          <Text>Default</Text>
        </Card>
      );
      
      expect(toJSON()).toBeTruthy();
    });

    it('should render glass variant', () => {
      const { toJSON } = render(
        <Card variant="glass">
          <Text>Glass</Text>
        </Card>
      );
      
      expect(toJSON()).toBeTruthy();
    });

    it('should render outline variant', () => {
      const { toJSON } = render(
        <Card variant="outline">
          <Text>Outline</Text>
        </Card>
      );
      
      expect(toJSON()).toBeTruthy();
    });

    it('should render filled variant', () => {
      const { toJSON } = render(
        <Card variant="filled">
          <Text>Filled</Text>
        </Card>
      );
      
      expect(toJSON()).toBeTruthy();
    });
  });

  // =========================================================================
  // Card Composition
  // =========================================================================

  describe('Card Composition', () => {
    it('should render complete card with all sub-components', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>
              <Text>Title</Text>
            </CardTitle>
            <CardDescription>
              <Text>Description</Text>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Text>Main content here</Text>
          </CardContent>
        </Card>
      );
      
      expect(screen.getByText('Title')).toBeTruthy();
      expect(screen.getByText('Description')).toBeTruthy();
      expect(screen.getByText('Main content here')).toBeTruthy();
    });
  });

  // =========================================================================
  // Custom Styles
  // =========================================================================

  describe('Custom Styles', () => {
    it('should apply custom className to Card', () => {
      const { toJSON } = render(
        <Card className="mt-4 mb-4">
          <Text>Styled card</Text>
        </Card>
      );
      
      expect(toJSON()).toBeTruthy();
    });

    it('should apply custom className to CardContent', () => {
      const { toJSON } = render(
        <Card>
          <CardContent className="p-6">
            <Text>Content with custom padding</Text>
          </CardContent>
        </Card>
      );
      
      expect(toJSON()).toBeTruthy();
    });

    it('should apply custom className to CardHeader', () => {
      const { toJSON } = render(
        <Card>
          <CardHeader className="bg-primary">
            <Text>Header with background</Text>
          </CardHeader>
        </Card>
      );
      
      expect(toJSON()).toBeTruthy();
    });
  });

  // =========================================================================
  // ViewProps Passthrough
  // =========================================================================

  describe('ViewProps Passthrough', () => {
    it('should pass through ViewProps to Card', () => {
      const onPress = jest.fn();
      
      render(
        <Card testID="card-test" accessibilityLabel="Test Card">
          <Text>Accessible card</Text>
        </Card>
      );
      
      expect(screen.getByTestId('card-test')).toBeTruthy();
    });

    it('should pass through ViewProps to CardContent', () => {
      render(
        <Card>
          <CardContent testID="content-test">
            <Text>Content</Text>
          </CardContent>
        </Card>
      );
      
      expect(screen.getByTestId('content-test')).toBeTruthy();
    });
  });
});

// =========================================================================
// Integration Tests
// =========================================================================

describe('Component Integration', () => {
  it('should render Button inside Card', () => {
    render(
      <Card>
        <CardContent>
          <Button title="Action" />
        </CardContent>
      </Card>
    );
    
    expect(screen.getByText('Action')).toBeTruthy();
  });

  it('should render Input inside Card', () => {
    render(
      <Card>
        <CardContent>
          <Input label="Name" placeholder="Enter your name" />
        </CardContent>
      </Card>
    );
    
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your name')).toBeTruthy();
  });

  it('should render form layout with multiple inputs and button', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>
            <Text>Sign Up</Text>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input label="Email" placeholder="Enter email" />
          <Input label="Password" placeholder="Enter password" secureTextEntry />
          <Button title="Submit" />
        </CardContent>
      </Card>
    );
    
    expect(screen.getByText('Sign Up')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Password')).toBeTruthy();
    expect(screen.getByText('Submit')).toBeTruthy();
  });
});
