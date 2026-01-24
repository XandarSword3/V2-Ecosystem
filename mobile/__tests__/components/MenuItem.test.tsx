/**
 * MenuItem Component Tests
 * 
 * Tests for MenuItem and QuantityControl components
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MenuItem, QuantityControl, MenuItemData } from '../../src/components/ui/MenuItem';

const mockItem: MenuItemData = {
  id: 'item-1',
  name: 'Test Burger',
  description: 'A delicious test burger with all the fixings',
  price: 12.99,
  imageUrl: 'https://example.com/burger.jpg',
  category: 'Burgers',
  available: true,
  preparationTime: 15,
  calories: 550,
  tags: ['Popular', 'Spicy'],
};

describe('MenuItem', () => {
  describe('horizontal variant (default)', () => {
    it('should render item name', () => {
      const { getByText } = render(<MenuItem item={mockItem} />);
      expect(getByText('Test Burger')).toBeTruthy();
    });

    it('should render item price', () => {
      const { getByText } = render(<MenuItem item={mockItem} />);
      expect(getByText('$12.99')).toBeTruthy();
    });

    it('should render item description', () => {
      const { getByText } = render(<MenuItem item={mockItem} />);
      expect(getByText('A delicious test burger with all the fixings')).toBeTruthy();
    });

    it('should render preparation time', () => {
      const { getByText } = render(<MenuItem item={mockItem} />);
      expect(getByText('15 min')).toBeTruthy();
    });

    it('should render calories', () => {
      const { getByText } = render(<MenuItem item={mockItem} />);
      expect(getByText('550 cal')).toBeTruthy();
    });

    it('should render tags', () => {
      const { getByText } = render(<MenuItem item={mockItem} />);
      expect(getByText('Popular')).toBeTruthy();
      expect(getByText('Spicy')).toBeTruthy();
    });

    it('should show Add button when showAddButton is true', () => {
      const { getByText } = render(<MenuItem item={mockItem} showAddButton />);
      expect(getByText('Add')).toBeTruthy();
    });

    it('should hide Add button when showAddButton is false', () => {
      const { queryByText } = render(<MenuItem item={mockItem} showAddButton={false} />);
      expect(queryByText('Add')).toBeNull();
    });
  });

  describe('vertical variant', () => {
    it('should render item name', () => {
      const { getByText } = render(<MenuItem item={mockItem} variant="vertical" />);
      expect(getByText('Test Burger')).toBeTruthy();
    });

    it('should render item price', () => {
      const { getByText } = render(<MenuItem item={mockItem} variant="vertical" />);
      expect(getByText('$12.99')).toBeTruthy();
    });
  });

  describe('compact variant', () => {
    it('should render item name', () => {
      const { getByText } = render(<MenuItem item={mockItem} variant="compact" />);
      expect(getByText('Test Burger')).toBeTruthy();
    });

    it('should render item price', () => {
      const { getByText } = render(<MenuItem item={mockItem} variant="compact" />);
      expect(getByText('$12.99')).toBeTruthy();
    });
  });

  describe('currency', () => {
    it('should display custom currency symbol', () => {
      const { getByText } = render(<MenuItem item={mockItem} currency="€" />);
      expect(getByText('€12.99')).toBeTruthy();
    });
  });

  describe('availability', () => {
    it('should show unavailable badge when item is not available', () => {
      const unavailableItem = { ...mockItem, available: false };
      const { getByText } = render(<MenuItem item={unavailableItem} />);
      expect(getByText('Unavailable')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('should call onPress when item is pressed', () => {
      const onPress = jest.fn();
      const { getByText } = render(<MenuItem item={mockItem} onPress={onPress} />);
      fireEvent.press(getByText('Test Burger'));
      expect(onPress).toHaveBeenCalledWith(mockItem);
    });

    it('should call onAdd when Add button is pressed', () => {
      const onAdd = jest.fn();
      const { getByText } = render(<MenuItem item={mockItem} onAdd={onAdd} showAddButton />);
      fireEvent.press(getByText('Add'));
      expect(onAdd).toHaveBeenCalledWith(mockItem);
    });

    it('should not call onPress when item is unavailable', () => {
      const onPress = jest.fn();
      const unavailableItem = { ...mockItem, available: false };
      const { getByText } = render(<MenuItem item={unavailableItem} onPress={onPress} />);
      fireEvent.press(getByText('Test Burger'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('quantity control', () => {
    it('should show QuantityControl when quantity > 0', () => {
      const onQuantityChange = jest.fn();
      const { getByText, queryByText } = render(
        <MenuItem
          item={mockItem}
          quantity={2}
          onQuantityChange={onQuantityChange}
          showAddButton
        />
      );
      expect(getByText('2')).toBeTruthy();
      expect(queryByText('Add')).toBeNull();
    });

    it('should call onQuantityChange when + is pressed', () => {
      const onQuantityChange = jest.fn();
      const { getByText } = render(
        <MenuItem
          item={mockItem}
          quantity={2}
          onQuantityChange={onQuantityChange}
          showAddButton
        />
      );
      fireEvent.press(getByText('+'));
      expect(onQuantityChange).toHaveBeenCalledWith(mockItem, 3);
    });

    it('should call onQuantityChange when − is pressed', () => {
      const onQuantityChange = jest.fn();
      const { getByText } = render(
        <MenuItem
          item={mockItem}
          quantity={2}
          onQuantityChange={onQuantityChange}
          showAddButton
        />
      );
      fireEvent.press(getByText('−'));
      expect(onQuantityChange).toHaveBeenCalledWith(mockItem, 1);
    });
  });
});

describe('QuantityControl', () => {
  it('should render current quantity', () => {
    const { getByText } = render(
      <QuantityControl
        quantity={5}
        onIncrease={jest.fn()}
        onDecrease={jest.fn()}
      />
    );
    expect(getByText('5')).toBeTruthy();
  });

  it('should call onIncrease when + is pressed', () => {
    const onIncrease = jest.fn();
    const { getByText } = render(
      <QuantityControl
        quantity={5}
        onIncrease={onIncrease}
        onDecrease={jest.fn()}
      />
    );
    fireEvent.press(getByText('+'));
    expect(onIncrease).toHaveBeenCalled();
  });

  it('should call onDecrease when − is pressed', () => {
    const onDecrease = jest.fn();
    const { getByText } = render(
      <QuantityControl
        quantity={5}
        onIncrease={jest.fn()}
        onDecrease={onDecrease}
      />
    );
    fireEvent.press(getByText('−'));
    expect(onDecrease).toHaveBeenCalled();
  });

  it('should disable decrease when quantity equals min', () => {
    const onDecrease = jest.fn();
    const { getByText } = render(
      <QuantityControl
        quantity={0}
        min={0}
        onIncrease={jest.fn()}
        onDecrease={onDecrease}
      />
    );
    fireEvent.press(getByText('−'));
    expect(onDecrease).not.toHaveBeenCalled();
  });

  it('should disable increase when quantity equals max', () => {
    const onIncrease = jest.fn();
    const { getByText } = render(
      <QuantityControl
        quantity={10}
        max={10}
        onIncrease={onIncrease}
        onDecrease={jest.fn()}
      />
    );
    fireEvent.press(getByText('+'));
    expect(onIncrease).not.toHaveBeenCalled();
  });
});
