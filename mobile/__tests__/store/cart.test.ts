/**
 * Cart Store Tests
 * 
 * Comprehensive test coverage for the cart store including:
 * - Item management (add, remove, update)
 * - Quantity updates
 * - Special instructions
 * - Variant and addon handling
 * - Price calculations
 * - Loyalty points redemption
 * - Gift card application
 * - Module-specific operations
 * - Persistence behavior
 */

import { act, renderHook } from '@testing-library/react-native';
import { useCartStore, CartItem, CartModuleType } from '../../src/store/cart';

// Helper to create mock cart items
const createMockItem = (overrides: Partial<CartItem> = {}): Omit<CartItem, 'cartItemId' | 'quantity'> => ({
  id: `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  name: 'Test Item',
  price: 10.00,
  moduleId: 'restaurant' as CartModuleType,
  moduleName: 'Restaurant',
  category: 'Main Course',
  imageUrl: 'https://example.com/image.jpg',
  ...overrides,
});

describe('Cart Store', () => {
  // Reset store before each test
  beforeEach(() => {
    const store = useCartStore.getState();
    store.clearCart();
  });

  // =========================================================================
  // Add Item Tests
  // =========================================================================

  describe('addItem()', () => {
    it('should add a new item to the cart', () => {
      const { result } = renderHook(() => useCartStore());
      const item = createMockItem({ id: 'test-1', name: 'Burger', price: 15.99 });

      act(() => {
        result.current.addItem(item);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]).toMatchObject({
        id: 'test-1',
        name: 'Burger',
        price: 15.99,
        quantity: 1,
      });
      expect(result.current.items[0].cartItemId).toBeDefined();
    });

    it('should add item with specified quantity', () => {
      const { result } = renderHook(() => useCartStore());
      const item = createMockItem({ id: 'test-2' });

      act(() => {
        result.current.addItem({ ...item, quantity: 3 });
      });

      expect(result.current.items[0].quantity).toBe(3);
    });

    it('should increment quantity for existing item', () => {
      const { result } = renderHook(() => useCartStore());
      const item = createMockItem({ id: 'test-3' });

      act(() => {
        result.current.addItem(item);
        result.current.addItem(item);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].quantity).toBe(2);
    });

    it('should not merge items with different special instructions', () => {
      const { result } = renderHook(() => useCartStore());
      const item1 = createMockItem({ id: 'test-4', specialInstructions: 'No onions' });
      const item2 = createMockItem({ id: 'test-4', specialInstructions: 'Extra cheese' });

      act(() => {
        result.current.addItem(item1);
        result.current.addItem(item2);
      });

      expect(result.current.items).toHaveLength(2);
    });

    it('should not merge items with different variants', () => {
      const { result } = renderHook(() => useCartStore());
      const item1 = createMockItem({ 
        id: 'test-5', 
        variant: { id: 'small', name: 'Small', priceModifier: 0 } 
      });
      const item2 = createMockItem({ 
        id: 'test-5', 
        variant: { id: 'large', name: 'Large', priceModifier: 3 } 
      });

      act(() => {
        result.current.addItem(item1);
        result.current.addItem(item2);
      });

      expect(result.current.items).toHaveLength(2);
    });

    it('should not merge items with different addons', () => {
      const { result } = renderHook(() => useCartStore());
      const item1 = createMockItem({ 
        id: 'test-6', 
        addons: [{ id: 'cheese', name: 'Extra Cheese', price: 2 }] 
      });
      const item2 = createMockItem({ 
        id: 'test-6', 
        addons: [{ id: 'bacon', name: 'Bacon', price: 3 }] 
      });

      act(() => {
        result.current.addItem(item1);
        result.current.addItem(item2);
      });

      expect(result.current.items).toHaveLength(2);
    });

    it('should not merge items from different modules', () => {
      const { result } = renderHook(() => useCartStore());
      const item1 = createMockItem({ id: 'test-7', moduleId: 'restaurant' });
      const item2 = createMockItem({ id: 'test-7', moduleId: 'snack-bar' });

      act(() => {
        result.current.addItem(item1);
        result.current.addItem(item2);
      });

      expect(result.current.items).toHaveLength(2);
    });
  });

  // =========================================================================
  // Remove Item Tests
  // =========================================================================

  describe('removeItem()', () => {
    it('should remove item by cartItemId', () => {
      const { result } = renderHook(() => useCartStore());
      const item = createMockItem({ id: 'test-8' });

      act(() => {
        result.current.addItem(item);
      });

      const cartItemId = result.current.items[0].cartItemId;

      act(() => {
        result.current.removeItem(cartItemId);
      });

      expect(result.current.items).toHaveLength(0);
    });

    it('should not affect other items when removing one', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'item-a', name: 'Item A' }));
        result.current.addItem(createMockItem({ id: 'item-b', name: 'Item B' }));
        result.current.addItem(createMockItem({ id: 'item-c', name: 'Item C' }));
      });

      const itemToRemove = result.current.items[1];

      act(() => {
        result.current.removeItem(itemToRemove.cartItemId);
      });

      expect(result.current.items).toHaveLength(2);
      expect(result.current.items.find(i => i.name === 'Item B')).toBeUndefined();
      expect(result.current.items.find(i => i.name === 'Item A')).toBeDefined();
      expect(result.current.items.find(i => i.name === 'Item C')).toBeDefined();
    });

    it('should handle removing non-existent item gracefully', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'test-9' }));
        result.current.removeItem('non-existent-id');
      });

      expect(result.current.items).toHaveLength(1);
    });
  });

  // =========================================================================
  // Update Quantity Tests
  // =========================================================================

  describe('updateQuantity()', () => {
    it('should update item quantity', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'test-10' }));
      });

      const cartItemId = result.current.items[0].cartItemId;

      act(() => {
        result.current.updateQuantity(cartItemId, 5);
      });

      expect(result.current.items[0].quantity).toBe(5);
    });

    it('should remove item when quantity is set to 0', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'test-11' }));
      });

      const cartItemId = result.current.items[0].cartItemId;

      act(() => {
        result.current.updateQuantity(cartItemId, 0);
      });

      expect(result.current.items).toHaveLength(0);
    });

    it('should remove item when quantity is negative', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'test-12' }));
      });

      const cartItemId = result.current.items[0].cartItemId;

      act(() => {
        result.current.updateQuantity(cartItemId, -1);
      });

      expect(result.current.items).toHaveLength(0);
    });
  });

  // =========================================================================
  // Update Instructions Tests
  // =========================================================================

  describe('updateInstructions()', () => {
    it('should update special instructions for an item', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'test-13' }));
      });

      const cartItemId = result.current.items[0].cartItemId;

      act(() => {
        result.current.updateInstructions(cartItemId, 'No pickles please');
      });

      expect(result.current.items[0].specialInstructions).toBe('No pickles please');
    });

    it('should clear instructions when empty string provided', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'test-14', specialInstructions: 'Some instructions' }));
      });

      const cartItemId = result.current.items[0].cartItemId;

      act(() => {
        result.current.updateInstructions(cartItemId, '');
      });

      expect(result.current.items[0].specialInstructions).toBe('');
    });
  });

  // =========================================================================
  // Clear Cart Tests
  // =========================================================================

  describe('clearCart()', () => {
    it('should remove all items from cart', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'item-1' }));
        result.current.addItem(createMockItem({ id: 'item-2' }));
        result.current.addItem(createMockItem({ id: 'item-3' }));
      });

      expect(result.current.items).toHaveLength(3);

      act(() => {
        result.current.clearCart();
      });

      expect(result.current.items).toHaveLength(0);
    });

    it('should reset loyalty points to 0', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.setLoyaltyPointsToRedeem(500);
        result.current.clearCart();
      });

      expect(result.current.loyaltyPointsToRedeem).toBe(0);
    });

    it('should remove applied gift card', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.applyGiftCard('GIFT123', 50, 25);
        result.current.clearCart();
      });

      expect(result.current.appliedGiftCard).toBeNull();
    });
  });

  // =========================================================================
  // Clear Module Cart Tests
  // =========================================================================

  describe('clearModuleCart()', () => {
    it('should clear only items from specified module', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'r-1', moduleId: 'restaurant' }));
        result.current.addItem(createMockItem({ id: 'r-2', moduleId: 'restaurant' }));
        result.current.addItem(createMockItem({ id: 's-1', moduleId: 'snack-bar' }));
      });

      expect(result.current.items).toHaveLength(3);

      act(() => {
        result.current.clearModuleCart('restaurant');
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].moduleId).toBe('snack-bar');
    });
  });

  // =========================================================================
  // Loyalty Points Tests
  // =========================================================================

  describe('setLoyaltyPointsToRedeem()', () => {
    it('should set loyalty points to redeem', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.setLoyaltyPointsToRedeem(500);
      });

      expect(result.current.loyaltyPointsToRedeem).toBe(500);
    });

    it('should not allow negative points', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.setLoyaltyPointsToRedeem(-100);
      });

      expect(result.current.loyaltyPointsToRedeem).toBe(0);
    });
  });

  // =========================================================================
  // Gift Card Tests
  // =========================================================================

  describe('applyGiftCard()', () => {
    it('should apply gift card with correct values', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.applyGiftCard('GIFT123', 50, 30);
      });

      expect(result.current.appliedGiftCard).toEqual({
        code: 'GIFT123',
        balance: 50,
        amountApplied: 30,
      });
    });

    it('should cap amount applied at gift card balance', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.applyGiftCard('GIFT456', 25, 100);
      });

      expect(result.current.appliedGiftCard?.amountApplied).toBe(25);
    });
  });

  describe('removeGiftCard()', () => {
    it('should remove applied gift card', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.applyGiftCard('GIFT789', 100, 50);
        result.current.removeGiftCard();
      });

      expect(result.current.appliedGiftCard).toBeNull();
    });
  });

  // =========================================================================
  // Computed Getters Tests
  // =========================================================================

  describe('getItemCount()', () => {
    it('should return total item count', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem({ ...createMockItem({ id: 'c-1' }), quantity: 2 });
        result.current.addItem({ ...createMockItem({ id: 'c-2' }), quantity: 3 });
      });

      expect(result.current.getItemCount()).toBe(5);
    });

    it('should return 0 for empty cart', () => {
      const { result } = renderHook(() => useCartStore());
      expect(result.current.getItemCount()).toBe(0);
    });
  });

  describe('getModuleItemCount()', () => {
    it('should return count for specific module only', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem({ ...createMockItem({ id: 'm-1', moduleId: 'restaurant' }), quantity: 2 });
        result.current.addItem({ ...createMockItem({ id: 'm-2', moduleId: 'snack-bar' }), quantity: 3 });
      });

      expect(result.current.getModuleItemCount('restaurant')).toBe(2);
      expect(result.current.getModuleItemCount('snack-bar')).toBe(3);
    });
  });

  describe('getSubtotal()', () => {
    it('should calculate subtotal correctly', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem({ ...createMockItem({ id: 's-1', price: 10 }), quantity: 2 });
        result.current.addItem({ ...createMockItem({ id: 's-2', price: 15 }), quantity: 1 });
      });

      expect(result.current.getSubtotal()).toBe(35); // (10*2) + (15*1)
    });

    it('should include variant price modifiers', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem({ 
          ...createMockItem({ 
            id: 'v-1', 
            price: 10,
            variant: { id: 'large', name: 'Large', priceModifier: 5 }
          }), 
          quantity: 2 
        });
      });

      expect(result.current.getSubtotal()).toBe(30); // (10+5)*2
    });

    it('should include addon prices', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem({ 
          ...createMockItem({ 
            id: 'a-1', 
            price: 10,
            addons: [
              { id: 'cheese', name: 'Cheese', price: 2 },
              { id: 'bacon', name: 'Bacon', price: 3 },
            ]
          }), 
          quantity: 2 
        });
      });

      expect(result.current.getSubtotal()).toBe(30); // (10+2+3)*2
    });
  });

  describe('getTotals()', () => {
    it('should calculate all totals correctly', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem({ ...createMockItem({ id: 't-1', price: 100 }), quantity: 1 });
      });

      const totals = result.current.getTotals();

      expect(totals.subtotal).toBe(100);
      expect(totals.tax).toBeCloseTo(11); // 11% of 100
      expect(totals.serviceFee).toBeCloseTo(5); // 5% of 100
      expect(totals.loyaltyDiscount).toBe(0);
      expect(totals.giftCardDiscount).toBe(0);
      expect(totals.total).toBeCloseTo(116); // 100 + 11 + 5
    });

    it('should apply loyalty discount', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem({ ...createMockItem({ id: 't-2', price: 100 }), quantity: 1 });
        result.current.setLoyaltyPointsToRedeem(1000); // $10 discount
      });

      const totals = result.current.getTotals();

      expect(totals.loyaltyDiscount).toBe(10);
      expect(totals.total).toBeCloseTo(106); // 116 - 10
    });

    it('should apply gift card discount', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem({ ...createMockItem({ id: 't-3', price: 100 }), quantity: 1 });
        result.current.applyGiftCard('GIFT', 50, 20);
      });

      const totals = result.current.getTotals();

      expect(totals.giftCardDiscount).toBe(20);
      expect(totals.total).toBeCloseTo(96); // 116 - 20
    });

    it('should not allow negative total', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem({ ...createMockItem({ id: 't-4', price: 10 }), quantity: 1 });
        result.current.setLoyaltyPointsToRedeem(10000); // $100 discount
        result.current.applyGiftCard('GIFT', 100, 100);
      });

      const totals = result.current.getTotals();

      expect(totals.total).toBe(0);
    });
  });

  describe('getItemsByModule()', () => {
    it('should return items filtered by module', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'f-1', moduleId: 'restaurant' }));
        result.current.addItem(createMockItem({ id: 'f-2', moduleId: 'snack-bar' }));
        result.current.addItem(createMockItem({ id: 'f-3', moduleId: 'restaurant' }));
      });

      const restaurantItems = result.current.getItemsByModule('restaurant');
      const snackItems = result.current.getItemsByModule('snack-bar');

      expect(restaurantItems).toHaveLength(2);
      expect(snackItems).toHaveLength(1);
    });
  });

  // =========================================================================
  // Legacy Compatibility Tests
  // =========================================================================

  describe('Legacy Methods', () => {
    it('addToRestaurant() should add item to restaurant module', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addToRestaurant({ id: 'l-1', name: 'Pasta', price: 20 });
      });

      expect(result.current.items[0].moduleId).toBe('restaurant');
      expect(result.current.items[0].moduleName).toBe('Restaurant');
    });

    it('addToSnack() should add item to snack-bar module', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addToSnack({ id: 'l-2', name: 'Chips', price: 5 });
      });

      expect(result.current.items[0].moduleId).toBe('snack-bar');
      expect(result.current.items[0].moduleName).toBe('Snack Bar');
    });

    it('getRestaurantTotal() should return correct total', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem({ ...createMockItem({ id: 'l-3', price: 25, moduleId: 'restaurant' }), quantity: 2 });
        result.current.addItem({ ...createMockItem({ id: 'l-4', price: 10, moduleId: 'snack-bar' }), quantity: 1 });
      });

      expect(result.current.getRestaurantTotal()).toBe(50);
    });

    it('getRestaurantCount() should return correct count', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem({ ...createMockItem({ id: 'l-5', moduleId: 'restaurant' }), quantity: 3 });
        result.current.addItem({ ...createMockItem({ id: 'l-6', moduleId: 'snack-bar' }), quantity: 2 });
      });

      expect(result.current.getRestaurantCount()).toBe(3);
    });

    it('clearRestaurantCart() should clear only restaurant items', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'l-7', moduleId: 'restaurant' }));
        result.current.addItem(createMockItem({ id: 'l-8', moduleId: 'snack-bar' }));
        result.current.clearRestaurantCart();
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].moduleId).toBe('snack-bar');
    });

    it('clearSnackCart() should clear only snack-bar items', () => {
      const { result } = renderHook(() => useCartStore());

      act(() => {
        result.current.addItem(createMockItem({ id: 'l-9', moduleId: 'restaurant' }));
        result.current.addItem(createMockItem({ id: 'l-10', moduleId: 'snack-bar' }));
        result.current.clearSnackCart();
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].moduleId).toBe('restaurant');
    });
  });
});
