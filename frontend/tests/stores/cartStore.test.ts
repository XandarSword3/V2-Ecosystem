import { describe, expect, it, beforeEach } from 'vitest';
import { useCartStore, calculateSubtotal, type CartItem } from '@/stores/cartStore';

describe('useCartStore — Phase F5 Canonical State, Module Partitioning & Discounts', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
    useCartStore.getState().clearOrderDetails();
  });

  it('calculates subtotal with modifiers and quantities accurately (harmless UI arithmetic)', () => {
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

  it('stores and isolates discount states (coupons, gift cards, loyalty points) per module', () => {
    const {
      setCouponForModule,
      getCouponForModule,
      addGiftCardForModule,
      removeGiftCardForModule,
      getGiftCardsForModule,
      setLoyaltyPointsForModule,
      getLoyaltyPointsForModule,
      clearDiscountsForModule,
    } = useCartStore.getState();

    // Set discounts for Module A
    setCouponForModule('mod-a', 'summer20');
    addGiftCardForModule('mod-a', 'gc-100');
    addGiftCardForModule('mod-a', 'gc-200');
    setLoyaltyPointsForModule('mod-a', 500);

    // Set discounts for Module B
    setCouponForModule('mod-b', 'vip50');
    addGiftCardForModule('mod-b', 'gc-999');
    setLoyaltyPointsForModule('mod-b', 100);

    // Assert Module A values
    expect(getCouponForModule('mod-a')).toBe('SUMMER20');
    expect(getGiftCardsForModule('mod-a')).toEqual(['GC-100', 'GC-200']);
    expect(getLoyaltyPointsForModule('mod-a')).toBe(500);

    // Assert Module B values
    expect(getCouponForModule('mod-b')).toBe('VIP50');
    expect(getGiftCardsForModule('mod-b')).toEqual(['GC-999']);
    expect(getLoyaltyPointsForModule('mod-b')).toBe(100);

    // Remove single gift card from Module A
    removeGiftCardForModule('mod-a', 'gc-100');
    expect(getGiftCardsForModule('mod-a')).toEqual(['GC-200']);

    // Clear discounts for Module A only
    clearDiscountsForModule('mod-a');
    expect(getCouponForModule('mod-a')).toBeUndefined();
    expect(getGiftCardsForModule('mod-a')).toEqual([]);
    expect(getLoyaltyPointsForModule('mod-a')).toBe(0);

    // Module B remains completely untouched
    expect(getCouponForModule('mod-b')).toBe('VIP50');
    expect(getGiftCardsForModule('mod-b')).toEqual(['GC-999']);
    expect(getLoyaltyPointsForModule('mod-b')).toBe(100);
  });

  it('clears items, fulfillment selection, and discounts only for the specified module on checkout completion', () => {
    const {
      addItem,
      setFulfillmentForModule,
      setCouponForModule,
      addGiftCardForModule,
      setLoyaltyPointsForModule,
      clearModuleCheckoutState,
      getFulfillmentForModule,
      getCouponForModule,
      getGiftCardsForModule,
      getLoyaltyPointsForModule,
    } = useCartStore.getState();

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

    setFulfillmentForModule('mod-restaurant', {
      mode: 'on_premise',
      destinationType: 'on_premise_location',
      destinationRef: 'loc-1',
    });
    setCouponForModule('mod-restaurant', 'FOOD10');
    addGiftCardForModule('mod-restaurant', 'GC-FOOD');
    setLoyaltyPointsForModule('mod-restaurant', 250);

    setFulfillmentForModule('mod-retail', {
      mode: 'local_delivery',
      destinationType: 'address',
      destinationRef: '456 Elm St',
    });
    setCouponForModule('mod-retail', 'CLOTHES20');

    expect(useCartStore.getState().items).toHaveLength(2);
    expect(getFulfillmentForModule('mod-restaurant')).toBeDefined();
    expect(getCouponForModule('mod-restaurant')).toBe('FOOD10');

    // Clear checkout state for restaurant
    clearModuleCheckoutState('mod-restaurant');

    const remaining = useCartStore.getState().items;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('tshirt-1');
    expect(remaining[0].moduleId).toBe('mod-retail');

    // Restaurant state is completely cleared
    expect(getFulfillmentForModule('mod-restaurant')).toBeUndefined();
    expect(getCouponForModule('mod-restaurant')).toBeUndefined();
    expect(getGiftCardsForModule('mod-restaurant')).toEqual([]);
    expect(getLoyaltyPointsForModule('mod-restaurant')).toBe(0);

    // Retail state remains intact!
    expect(getFulfillmentForModule('mod-retail')).toEqual({
      mode: 'local_delivery',
      destinationType: 'address',
      destinationRef: '456 Elm St',
    });
    expect(getCouponForModule('mod-retail')).toBe('CLOTHES20');
  });

  describe('Zustand Persistence Migration (Version 3)', () => {
    const persistOptions = (useCartStore as any).persist;
    const migrate = persistOptions?.getOptions()?.migrate;

    it('migrates legacy takeaway to canonical pickup (v1 -> v3)', () => {
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
      expect(migrated.couponByModule).toEqual({});
      expect(migrated.giftCardsByModule).toEqual({});
      expect(migrated.loyaltyPointsByModule).toEqual({});
      expect(migrated.orderType).toBeUndefined();
      expect(migrated.tableNumber).toBeUndefined();
    });

    it('migrates v2 state to v3 by adding empty discount maps', () => {
      const v2State = {
        items: [{ id: 'item-1', name: 'Pizza', price: 20, quantity: 1, moduleId: 'mod-pizza' }],
        fulfillmentByModule: {
          'mod-pizza': { mode: 'local_delivery', destinationType: 'address', destinationRef: '123 Main St' },
        },
        customerName: 'Bob',
      };

      const migrated = migrate(v2State, 2);

      expect(migrated.couponByModule).toEqual({});
      expect(migrated.giftCardsByModule).toEqual({});
      expect(migrated.loyaltyPointsByModule).toEqual({});
      expect(migrated.fulfillmentByModule['mod-pizza'].mode).toBe('local_delivery');
    });

    it('recovers safely from empty or corrupt state', () => {
      const emptyState = null;
      const recovered = migrate(emptyState, 0);

      expect(recovered).toEqual({
        items: [],
        fulfillmentByModule: {},
        couponByModule: {},
        giftCardsByModule: {},
        loyaltyPointsByModule: {},
        customerName: '',
        customerPhone: '',
        paymentMethod: 'cash',
        notes: '',
      });
    });
  });
});
