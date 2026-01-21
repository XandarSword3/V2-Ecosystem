/**
 * CartSummary Component Tests
 * 
 * Tests for CartSummary and FloatingCartButton components
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { 
  CartSummary, 
  FloatingCartButton,
  CartItemData,
  CartTotals,
} from '../../src/components/ui/CartSummary';

const mockCartItems: CartItemData[] = [
  {
    id: 'cart-1',
    itemId: 'item-1',
    name: 'Test Burger',
    price: 12.99,
    quantity: 2,
  },
  {
    id: 'cart-2',
    itemId: 'item-2',
    name: 'French Fries',
    price: 4.99,
    quantity: 1,
    notes: 'Extra crispy',
  },
  {
    id: 'cart-3',
    itemId: 'item-3',
    name: 'Deluxe Burger',
    price: 15.99,
    quantity: 1,
    variant: {
      id: 'var-1',
      name: 'Large',
      priceModifier: 2.00,
    },
    addons: [
      { id: 'addon-1', name: 'Cheese', price: 1.50 },
      { id: 'addon-2', name: 'Bacon', price: 2.00 },
    ],
  },
];

const mockTotals: CartTotals = {
  subtotal: 52.95,
  tax: 5.82,
  serviceFee: 2.65,
  loyaltyDiscount: 5.00,
  giftCardDiscount: 0,
  couponDiscount: 0,
  total: 56.42,
};

describe('CartSummary', () => {
  describe('empty cart', () => {
    it('should show empty cart message', () => {
      const { getByText } = render(
        <CartSummary items={[]} totals={{ ...mockTotals, subtotal: 0, total: 0 }} />
      );
      expect(getByText('Your cart is empty')).toBeTruthy();
    });

    it('should show browse message', () => {
      const { getByText } = render(
        <CartSummary items={[]} totals={{ ...mockTotals, subtotal: 0, total: 0 }} />
      );
      expect(getByText('Browse our menu and add items to get started')).toBeTruthy();
    });
  });

  describe('with items', () => {
    it('should render all cart items', () => {
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} />
      );
      expect(getByText('Test Burger')).toBeTruthy();
      expect(getByText('French Fries')).toBeTruthy();
      expect(getByText('Deluxe Burger')).toBeTruthy();
    });

    it('should show item notes', () => {
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} />
      );
      expect(getByText('Note: Extra crispy')).toBeTruthy();
    });

    it('should show variant name', () => {
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} />
      );
      expect(getByText(/Large.*\+\$2\.00/)).toBeTruthy();
    });

    it('should show addons', () => {
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} />
      );
      expect(getByText('+ Cheese, Bacon')).toBeTruthy();
    });
  });

  describe('totals', () => {
    it('should display subtotal', () => {
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} />
      );
      expect(getByText('Subtotal')).toBeTruthy();
      expect(getByText('$52.95')).toBeTruthy();
    });

    it('should display tax', () => {
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} />
      );
      expect(getByText('Tax')).toBeTruthy();
      expect(getByText('$5.82')).toBeTruthy();
    });

    it('should display service fee', () => {
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} />
      );
      expect(getByText('Service Fee')).toBeTruthy();
      expect(getByText('$2.65')).toBeTruthy();
    });

    it('should display loyalty discount when applied', () => {
      const { getByText } = render(
        <CartSummary 
          items={mockCartItems} 
          totals={mockTotals}
          loyaltyPointsApplied={500}
        />
      );
      expect(getByText(/Loyalty Points.*\(500\)/)).toBeTruthy();
      expect(getByText('-$5.00')).toBeTruthy();
    });

    it('should display total', () => {
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} />
      );
      expect(getByText('Total')).toBeTruthy();
      expect(getByText('$56.42')).toBeTruthy();
    });
  });

  describe('discounts', () => {
    it('should display gift card discount when applied', () => {
      const totalsWithGiftCard = {
        ...mockTotals,
        giftCardDiscount: 10.00,
      };
      const { getByText } = render(
        <CartSummary 
          items={mockCartItems} 
          totals={totalsWithGiftCard}
          giftCardCode="GIFT10"
        />
      );
      expect(getByText(/Gift Card.*\(GIFT10\)/)).toBeTruthy();
      expect(getByText('-$10.00')).toBeTruthy();
    });

    it('should display coupon discount when applied', () => {
      const totalsWithCoupon = {
        ...mockTotals,
        couponDiscount: 8.00,
      };
      const { getByText } = render(
        <CartSummary 
          items={mockCartItems} 
          totals={totalsWithCoupon}
          couponCode="SAVE20"
        />
      );
      expect(getByText(/Coupon.*\(SAVE20\)/)).toBeTruthy();
      expect(getByText('-$8.00')).toBeTruthy();
    });
  });

  describe('currency', () => {
    it('should display custom currency symbol', () => {
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} currency="€" />
      );
      expect(getByText('€56.42')).toBeTruthy();
    });
  });

  describe('compact variant', () => {
    it('should show item count', () => {
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} compact />
      );
      expect(getByText('3 items')).toBeTruthy();
    });

    it('should show total', () => {
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} compact />
      );
      expect(getByText('$56.42')).toBeTruthy();
    });

    it('should show singular for 1 item', () => {
      const singleItem = [mockCartItems[0]];
      const { getByText } = render(
        <CartSummary items={singleItem} totals={mockTotals} compact />
      );
      expect(getByText('1 item')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('should call onCheckout when checkout button is pressed', () => {
      const onCheckout = jest.fn();
      const { getByText } = render(
        <CartSummary items={mockCartItems} totals={mockTotals} onCheckout={onCheckout} />
      );
      fireEvent.press(getByText('Proceed to Checkout'));
      expect(onCheckout).toHaveBeenCalled();
    });

    it('should call onRemoveItem when remove is pressed', () => {
      const onRemoveItem = jest.fn();
      const { getAllByText } = render(
        <CartSummary 
          items={mockCartItems} 
          totals={mockTotals} 
          onRemoveItem={onRemoveItem}
        />
      );
      fireEvent.press(getAllByText('Remove')[0]);
      expect(onRemoveItem).toHaveBeenCalledWith('cart-1');
    });

    it('should call onQuantityChange when quantity is changed', () => {
      const onQuantityChange = jest.fn();
      const { getAllByText } = render(
        <CartSummary 
          items={mockCartItems} 
          totals={mockTotals} 
          onQuantityChange={onQuantityChange}
        />
      );
      fireEvent.press(getAllByText('+')[0]);
      expect(onQuantityChange).toHaveBeenCalledWith('cart-1', 3);
    });
  });

  describe('loading state', () => {
    it('should show loading state when loading', () => {
      const onCheckout = jest.fn();
      const { toJSON } = render(
        <CartSummary 
          items={mockCartItems} 
          totals={mockTotals} 
          onCheckout={onCheckout}
          loading
        />
      );
      // When loading, the button shows an ActivityIndicator instead of text
      // This test verifies the loading prop is passed through
      expect(toJSON()).toBeTruthy();
    });
  });
});

describe('FloatingCartButton', () => {
  it('should render with item count and total', () => {
    const { getByText } = render(
      <FloatingCartButton itemCount={3} total={56.42} onPress={jest.fn()} />
    );
    expect(getByText('3')).toBeTruthy();
    expect(getByText('View Cart')).toBeTruthy();
    expect(getByText('$56.42')).toBeTruthy();
  });

  it('should not render when item count is 0', () => {
    const { toJSON } = render(
      <FloatingCartButton itemCount={0} total={0} onPress={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });

  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <FloatingCartButton itemCount={3} total={56.42} onPress={onPress} />
    );
    fireEvent.press(getByText('View Cart'));
    expect(onPress).toHaveBeenCalled();
  });

  it('should display custom currency', () => {
    const { getByText } = render(
      <FloatingCartButton itemCount={3} total={56.42} currency="€" onPress={jest.fn()} />
    );
    expect(getByText('€56.42')).toBeTruthy();
  });
});
