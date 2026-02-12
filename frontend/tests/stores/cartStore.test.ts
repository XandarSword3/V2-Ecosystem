/**
 * Tests for cartStore (Zustand)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '@/stores/cartStore';

const createItem = (overrides: Record<string, any> = {}) => ({
  id: 'item-1',
  name: 'Margherita Pizza',
  price: 12.99,
  quantity: 1,
  ...overrides,
});

describe('cartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], restaurantItems: [], snackItems: [] });
  });

  describe('addItem', () => {
    it('adds a new item to cart', () => {
      useCartStore.getState().addItem(createItem());
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].name).toBe('Margherita Pizza');
    });

    it('increments quantity for existing item', () => {
      const item = createItem();
      useCartStore.getState().addItem(item);
      useCartStore.getState().addItem(item);
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].quantity).toBe(2);
    });

    it('treats items with different modifiers as separate', () => {
      const item1 = createItem({
        selectedModifiers: [{ optionId: 'mod1', quantity: 1 }],
      });
      const item2 = createItem({
        selectedModifiers: [{ optionId: 'mod2', quantity: 1 }],
      });
      useCartStore.getState().addItem(item1);
      useCartStore.getState().addItem(item2);
      expect(useCartStore.getState().items).toHaveLength(2);
    });

    it('defaults quantity to 1', () => {
      useCartStore.getState().addItem({ ...createItem(), quantity: 0 });
      // When quantity is 0/falsy, addItem uses || 1
      expect(useCartStore.getState().items[0].quantity).toBe(1);
    });
  });

  describe('removeItem', () => {
    it('removes item by id', () => {
      useCartStore.getState().addItem(createItem());
      useCartStore.getState().removeItem('item-1');
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('removes item by uniqueKey', () => {
      useCartStore.getState().addItem(createItem());
      const uniqueKey = useCartStore.getState().items[0].uniqueKey!;
      useCartStore.getState().removeItem('item-1', uniqueKey);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('does nothing for non-existent id', () => {
      useCartStore.getState().addItem(createItem());
      useCartStore.getState().removeItem('non-existent');
      expect(useCartStore.getState().items).toHaveLength(1);
    });
  });

  describe('updateQuantity', () => {
    it('updates quantity for existing item', () => {
      useCartStore.getState().addItem(createItem());
      useCartStore.getState().updateQuantity('item-1', 5);
      expect(useCartStore.getState().items[0].quantity).toBe(5);
    });

    it('removes item when quantity is 0', () => {
      useCartStore.getState().addItem(createItem());
      useCartStore.getState().updateQuantity('item-1', 0);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('removes item when quantity is negative', () => {
      useCartStore.getState().addItem(createItem());
      useCartStore.getState().updateQuantity('item-1', -1);
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('updateInstructions', () => {
    it('updates special instructions', () => {
      useCartStore.getState().addItem(createItem());
      useCartStore.getState().updateInstructions('item-1', 'No onions please');
      expect(useCartStore.getState().items[0].specialInstructions).toBe('No onions please');
    });
  });

  describe('clearCart', () => {
    it('removes all items', () => {
      useCartStore.getState().addItem(createItem({ id: '1' }));
      useCartStore.getState().addItem(createItem({ id: '2' }));
      useCartStore.getState().clearCart();
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('getTotal', () => {
    it('returns 0 for empty cart', () => {
      expect(useCartStore.getState().getTotal()).toBe(0);
    });

    it('calculates total for single item', () => {
      useCartStore.getState().addItem(createItem({ price: 10, quantity: 2 }));
      expect(useCartStore.getState().getTotal()).toBe(20);
    });

    it('includes modifier total in calculation', () => {
      useCartStore.getState().addItem(createItem({
        price: 10,
        quantity: 1,
        modifierTotal: 3,
      }));
      expect(useCartStore.getState().getTotal()).toBe(13);
    });

    it('sums multiple items', () => {
      useCartStore.getState().addItem(createItem({ id: '1', price: 10, quantity: 2 }));
      useCartStore.getState().addItem(createItem({ id: '2', price: 5, quantity: 1 }));
      // First item: 10 * 2 = 20, Second: 5 * 1 = 5
      expect(useCartStore.getState().getTotal()).toBe(25);
    });
  });

  describe('getCount', () => {
    it('returns 0 for empty cart', () => {
      expect(useCartStore.getState().getCount()).toBe(0);
    });

    it('sums quantities across items', () => {
      useCartStore.getState().addItem(createItem({ id: '1', quantity: 2 }));
      useCartStore.getState().addItem(createItem({ id: '2', quantity: 3 }));
      expect(useCartStore.getState().getCount()).toBe(5);
    });
  });

  describe('restaurant cart', () => {
    it('addToRestaurant adds with restaurant metadata', () => {
      useCartStore.getState().addToRestaurant({
        id: 'r1',
        name: 'Pasta',
        price: 15,
      });
      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].moduleId).toBe('restaurant');
      expect(items[0].moduleName).toBe('Restaurant');
      expect(items[0].type).toBe('restaurant');
    });

    it('clearRestaurantCart only removes restaurant items', () => {
      useCartStore.getState().addToRestaurant({ id: 'r1', name: 'Pasta', price: 15 });
      useCartStore.getState().addToSnack({ id: 's1', name: 'Chips', price: 5 });
      useCartStore.getState().clearRestaurantCart();

      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].moduleId).toBe('snack-bar');
    });

    it('getRestaurantTotal only sums restaurant items', () => {
      useCartStore.getState().addToRestaurant({ id: 'r1', name: 'Pasta', price: 15 });
      useCartStore.getState().addToSnack({ id: 's1', name: 'Chips', price: 5 });
      expect(useCartStore.getState().getRestaurantTotal()).toBe(15);
    });

    it('getRestaurantCount only counts restaurant items', () => {
      useCartStore.getState().addToRestaurant({ id: 'r1', name: 'Pasta', price: 15 });
      useCartStore.getState().addToSnack({ id: 's1', name: 'Chips', price: 5 });
      expect(useCartStore.getState().getRestaurantCount()).toBe(1);
    });
  });

  describe('snack cart', () => {
    it('addToSnack adds with snack metadata', () => {
      useCartStore.getState().addToSnack({
        id: 's1',
        name: 'Chips',
        price: 5,
      });
      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].moduleId).toBe('snack-bar');
      expect(items[0].moduleName).toBe('Snack Bar');
      expect(items[0].type).toBe('snack');
    });

    it('clearSnackCart only removes snack items', () => {
      useCartStore.getState().addToRestaurant({ id: 'r1', name: 'Pasta', price: 15 });
      useCartStore.getState().addToSnack({ id: 's1', name: 'Chips', price: 5 });
      useCartStore.getState().clearSnackCart();

      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].moduleId).toBe('restaurant');
    });

    it('getSnackTotal only sums snack items', () => {
      useCartStore.getState().addToRestaurant({ id: 'r1', name: 'Pasta', price: 15 });
      useCartStore.getState().addToSnack({ id: 's1', name: 'Chips', price: 5 });
      expect(useCartStore.getState().getSnackTotal()).toBe(5);
    });

    it('getSnackCount only counts snack items', () => {
      useCartStore.getState().addToRestaurant({ id: 'r1', name: 'Pasta', price: 15 });
      useCartStore.getState().addToSnack({ id: 's1', name: 'Chips', price: 5 });
      expect(useCartStore.getState().getSnackCount()).toBe(1);
    });
  });
});
