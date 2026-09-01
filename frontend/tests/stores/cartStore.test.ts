import { describe, expect, it, beforeEach } from 'vitest';
import { useCartStore, calculateSubtotal, type CartItem } from '@/stores/cartStore';

describe('useCartStore — Phase F4 Canonical State & Multi-Module Partitioning', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
    useCartStore.getState().clearOrderDetails();
  });

  it('calculates subtotal with modifiers and quantities accurately', () => {
    const items: CartItem[] = [
      {
        id: 'item-1',
        name: 'Burger',
        price: 10.0,
        quantity: 2,
        modifierTotal: 2.5,
        moduleId: 'mod-a',
      },
      {
        id: 'item-2',
        name: 'Fries',
        price: 4.0,
        quantity: 1,
        modifierTotal: 0,
        moduleId: 'mod-a',
      },
    ];

    // (10 + 2.5) * 2 + 4 * 1 = 25 + 4 = 29
    expect(calculateSubtotal(items)).toBe(29.0);
  });

  it('stores and retrieves fulfillment selections independently per module partition', () => {
    const { setFulfillmentForModule, getFulfillmentForModule } = useCartStore.getState();

    // Set fulfillment for Module A (on_premise with table UUID)
    setFulfillmentForModule('mod-restaurant', {
      mode: 'on_premise',
      destinationType: 'on_premise_location',
      destinationRef: 'c4b8b6f3-3a1b-4d5e-9e7f-1a2b3c4d5e6f',
    });

    // Set fulfillment for Module B (local_delivery with address)
    setFulfillmentForModule('mod-retail', {
      mode: 'local_delivery',
      destinationType: 'address',
      destinationRef: '123 Ocean View Villa',
    });

    const resFulfillment = getFulfillmentForModule('mod-restaurant');
    const retFulfillment = getFulfillmentForModule('mod-retail');

    expect(resFulfillment).toEqual({
      mode: 'on_premise',
      destinationType: 'on_premise_location',
      destinationRef: 'c4b8b6f3-3a1b-4d5e-9e7f-1a2b3c4d5e6f',
    });

    expect(retFulfillment).toEqual({
      mode: 'local_delivery',
      destinationType: 'address',
      destinationRef: '123 Ocean View Villa',
    });

    // Module C is unresolved (undefined)
    expect(getFulfillmentForModule('mod-spa')).toBeUndefined();
  });

  it('clears items only for the specified module, preserving items from other modules', () => {
    const { addItem, clearModuleItems } = useCartStore.getState();

    addItem({
      id: 'burger-1',
      name: 'Burger',
      price: 15,
      quantity: 1,
      moduleId: 'mod-restaurant',
      moduleSlug: 'restaurant',
    });

    addItem({
      id: 'tshirt-1',
      name: 'T-Shirt',
      price: 30,
      quantity: 1,
      moduleId: 'mod-retail',
      moduleSlug: 'retail',
    });

    expect(useCartStore.getState().items).toHaveLength(2);

    // Clear only restaurant items
    clearModuleItems('mod-restaurant');

    const remaining = useCartStore.getState().items;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('tshirt-1');
    expect(remaining[0].moduleId).toBe('mod-retail');
  });

  describe('Zustand Persistence Migration (Version 2)', () => {
    const persistOptions = (useCartStore as any).persist;
    const migrate = persistOptions?.getOptions()?.migrate;

    it('migrates legacy takeaway to canonical pickup', () => {
      const legacyState = {
        items: [{ id: 'item-1', name: 'Coffee', price: 5, quantity: 1, moduleId: 'mod-cafe' }],
        orderType: 'takeaway',
        customerName: 'Alice',
      };

      const migrated = migrate(legacyState, 1);

      expect(migrated.fulfillmentByModule['mod-cafe']).toEqual({
        mode: 'pickup',
        destinationType: 'pickup_location',
        destinationRef: null,
      });
      expect(migrated.orderType).toBeUndefined();
      expect(migrated.tableNumber).toBeUndefined();
    });

    it('migrates legacy delivery to canonical local_delivery', () => {
      const legacyState = {
        items: [{ id: 'item-1', name: 'Pizza', price: 20, quantity: 1, moduleId: 'mod-pizza' }],
        orderType: 'delivery',
        customerName: 'Bob',
      };

      const migrated = migrate(legacyState, 1);

      expect(migrated.fulfillmentByModule['mod-pizza']).toEqual({
        mode: 'local_delivery',
        destinationType: 'address',
        destinationRef: null,
      });
    });

    it('migrates legacy dine_in with canonical UUID tableNumber to on_premise', () => {
      const validUUID = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
      const legacyState = {
        items: [{ id: 'item-1', name: 'Steak', price: 45, quantity: 1, moduleId: 'mod-steak' }],
        orderType: 'dine_in',
        tableNumber: validUUID,
      };

      const migrated = migrate(legacyState, 1);

      expect(migrated.fulfillmentByModule['mod-steak']).toEqual({
        mode: 'on_premise',
        destinationType: 'on_premise_location',
        destinationRef: validUUID,
      });
    });

    it('migrates legacy dine_in with non-UUID human table label by setting destinationRef to null (requiring explicit UI selection)', () => {
      const legacyState = {
        items: [{ id: 'item-1', name: 'Steak', price: 45, quantity: 1, moduleId: 'mod-steak' }],
        orderType: 'dine_in',
        tableNumber: 'Table 4 Near Window',
      };

      const migrated = migrate(legacyState, 1);

      expect(migrated.fulfillmentByModule['mod-steak']).toEqual({
        mode: 'on_premise',
        destinationType: 'on_premise_location',
        destinationRef: null,
      });
    });

    it('leaves unknown legacy orderType unresolved (does NOT silently default to on_premise)', () => {
      const legacyState = {
        items: [{ id: 'item-1', name: 'Widget', price: 10, quantity: 1, moduleId: 'mod-general' }],
        orderType: 'unknown_alien_type',
      };

      const migrated = migrate(legacyState, 1);

      expect(migrated.fulfillmentByModule['mod-general']).toBeUndefined();
      expect(migrated.orderType).toBeUndefined();
    });

    it('recovers safely from empty or corrupt state', () => {
      const emptyState = null;
      const recovered = migrate(emptyState, 0);

      expect(recovered).toEqual({
        items: [],
        fulfillmentByModule: {},
        customerName: '',
        customerPhone: '',
        paymentMethod: 'cash',
        notes: '',
      });
    });
  });
});
