/**
 * Cart Store (Zustand)
 * 
 * Manages shopping cart state for restaurant, pool bar, and chalet orders.
 * Features:
 * - Multi-module cart support (restaurant, snack bar, pool)
 * - Quantity management with special instructions
 * - Price calculations with taxes and fees
 * - Loyalty points redemption
 * - Gift card application
 * - Persistence via AsyncStorage
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Types
// ============================================================================

export type CartModuleType = 'restaurant' | 'snack-bar' | 'pool' | 'chalet';

export interface CartItemAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItemVariant {
  id: string;
  name: string;
  priceModifier: number;
}

export interface CartItem {
  /** Unique cart item ID (UUID) */
  cartItemId: string;
  /** Product ID from backend */
  id: string;
  /** Product name */
  name: string;
  /** Base price per unit */
  price: number;
  /** Quantity in cart */
  quantity: number;
  /** Special instructions from customer */
  specialInstructions?: string;
  /** Product category */
  category?: string;
  /** Product image URL */
  imageUrl?: string;
  /** Module identifier (restaurant, snack-bar, pool) */
  moduleId: CartModuleType;
  /** Human-readable module name */
  moduleName?: string;
  /** Selected variant */
  variant?: CartItemVariant;
  /** Selected add-ons */
  addons?: CartItemAddon[];
}

export interface AppliedGiftCard {
  code: string;
  balance: number;
  amountApplied: number;
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  serviceFee: number;
  loyaltyDiscount: number;
  giftCardDiscount: number;
  total: number;
}

export interface CartState {
  // Cart items
  items: CartItem[];
  
  // Discounts
  loyaltyPointsToRedeem: number;
  appliedGiftCard: AppliedGiftCard | null;
  
  // Tax and fee rates
  taxRate: number;
  serviceFeeRate: number;
  
  // Item actions
  addItem: (item: Omit<CartItem, 'cartItemId' | 'quantity'> & { quantity?: number }) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateInstructions: (cartItemId: string, instructions: string) => void;
  clearCart: () => void;
  clearModuleCart: (moduleId: CartModuleType) => void;
  
  // Discount actions
  setLoyaltyPointsToRedeem: (points: number) => void;
  applyGiftCard: (code: string, balance: number, amount: number) => void;
  removeGiftCard: () => void;
  
  // Computed getters
  getItemCount: () => number;
  getModuleItemCount: (moduleId: CartModuleType) => number;
  getSubtotal: () => number;
  getModuleSubtotal: (moduleId: CartModuleType) => number;
  getTotals: () => CartTotals;
  getItemsByModule: (moduleId: CartModuleType) => CartItem[];
  
  // Legacy compatibility methods
  addToRestaurant: (item: Omit<CartItem, 'cartItemId' | 'quantity' | 'moduleId' | 'moduleName'>) => void;
  addToSnack: (item: Omit<CartItem, 'cartItemId' | 'quantity' | 'moduleId' | 'moduleName'>) => void;
  getRestaurantTotal: () => number;
  getRestaurantCount: () => number;
  getSnackTotal: () => number;
  getSnackCount: () => number;
  clearRestaurantCart: () => void;
  clearSnackCart: () => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique cart item ID
 */
const generateCartItemId = (): string => {
  return `cart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Calculate item total including variant and addons
 */
const calculateItemTotal = (item: CartItem): number => {
  let unitPrice = item.price;
  
  // Add variant price modifier
  if (item.variant) {
    unitPrice += item.variant.priceModifier;
  }
  
  // Add addon prices
  if (item.addons && item.addons.length > 0) {
    unitPrice += item.addons.reduce((sum, addon) => sum + addon.price, 0);
  }
  
  return unitPrice * item.quantity;
};

/**
 * Convert loyalty points to currency (100 points = $1)
 */
const pointsToCurrency = (points: number): number => {
  return points / 100;
};

// ============================================================================
// Store
// ============================================================================

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      loyaltyPointsToRedeem: 0,
      appliedGiftCard: null,
      taxRate: 0.11, // 11% VAT
      serviceFeeRate: 0.05, // 5% service fee

      // ========================================
      // Item Actions
      // ========================================

      addItem: (item) => {
        set((state) => {
          // Check for existing item with same id, moduleId, variant, and addons
          const existingIndex = state.items.findIndex((i) => {
            if (i.id !== item.id || i.moduleId !== item.moduleId) return false;
            
            // Check variant match
            const variantMatch = 
              (!i.variant && !item.variant) ||
              (i.variant?.id === item.variant?.id);
            
            // Check addons match
            const itemAddonIds = (item.addons || []).map(a => a.id).sort().join(',');
            const existingAddonIds = (i.addons || []).map(a => a.id).sort().join(',');
            const addonsMatch = itemAddonIds === existingAddonIds;
            
            // Check instructions match
            const instructionsMatch = i.specialInstructions === item.specialInstructions;
            
            return variantMatch && addonsMatch && instructionsMatch;
          });

          if (existingIndex >= 0) {
            // Update quantity of existing item
            const updatedItems = [...state.items];
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              quantity: updatedItems[existingIndex].quantity + (item.quantity || 1),
            };
            return { items: updatedItems };
          }

          // Add new item
          const newItem: CartItem = {
            ...item,
            cartItemId: generateCartItemId(),
            quantity: item.quantity || 1,
          };
          
          return { items: [...state.items, newItem] };
        });
      },

      removeItem: (cartItemId) => {
        set((state) => ({
          items: state.items.filter((i) => i.cartItemId !== cartItemId),
        }));
      },

      updateQuantity: (cartItemId, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((i) => i.cartItemId !== cartItemId) };
          }
          return {
            items: state.items.map((i) =>
              i.cartItemId === cartItemId ? { ...i, quantity } : i
            ),
          };
        });
      },

      updateInstructions: (cartItemId, instructions) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.cartItemId === cartItemId ? { ...i, specialInstructions: instructions } : i
          ),
        }));
      },

      clearCart: () => {
        set({ items: [], loyaltyPointsToRedeem: 0, appliedGiftCard: null });
      },

      clearModuleCart: (moduleId) => {
        set((state) => ({
          items: state.items.filter((i) => i.moduleId !== moduleId),
        }));
      },

      // ========================================
      // Discount Actions
      // ========================================

      setLoyaltyPointsToRedeem: (points) => {
        set({ loyaltyPointsToRedeem: Math.max(0, points) });
      },

      applyGiftCard: (code, balance, amount) => {
        set({
          appliedGiftCard: {
            code,
            balance,
            amountApplied: Math.min(amount, balance),
          },
        });
      },

      removeGiftCard: () => {
        set({ appliedGiftCard: null });
      },

      // ========================================
      // Computed Getters
      // ========================================

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getModuleItemCount: (moduleId) => {
        return get().items
          .filter((i) => i.moduleId === moduleId)
          .reduce((sum, item) => sum + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
      },

      getModuleSubtotal: (moduleId) => {
        return get().items
          .filter((i) => i.moduleId === moduleId)
          .reduce((sum, item) => sum + calculateItemTotal(item), 0);
      },

      getTotals: () => {
        const state = get();
        const subtotal = state.getSubtotal();
        const tax = subtotal * state.taxRate;
        const serviceFee = subtotal * state.serviceFeeRate;
        const loyaltyDiscount = pointsToCurrency(state.loyaltyPointsToRedeem);
        const giftCardDiscount = state.appliedGiftCard?.amountApplied || 0;
        
        const total = Math.max(
          0,
          subtotal + tax + serviceFee - loyaltyDiscount - giftCardDiscount
        );

        return {
          subtotal,
          tax,
          serviceFee,
          loyaltyDiscount,
          giftCardDiscount,
          total,
        };
      },

      getItemsByModule: (moduleId) => {
        return get().items.filter((i) => i.moduleId === moduleId);
      },

      // ========================================
      // Legacy Compatibility
      // ========================================

      addToRestaurant: (item) => {
        get().addItem({
          ...item,
          moduleId: 'restaurant',
          moduleName: 'Restaurant',
        });
      },

      addToSnack: (item) => {
        get().addItem({
          ...item,
          moduleId: 'snack-bar',
          moduleName: 'Snack Bar',
        });
      },

      getRestaurantTotal: () => get().getModuleSubtotal('restaurant'),
      getRestaurantCount: () => get().getModuleItemCount('restaurant'),
      getSnackTotal: () => get().getModuleSubtotal('snack-bar'),
      getSnackCount: () => get().getModuleItemCount('snack-bar'),
      clearRestaurantCart: () => get().clearModuleCart('restaurant'),
      clearSnackCart: () => get().clearModuleCart('snack-bar'),
    }),
    {
      name: 'v2-resort-cart',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist cart items and discounts
      partialize: (state) => ({
        items: state.items,
        loyaltyPointsToRedeem: state.loyaltyPointsToRedeem,
        appliedGiftCard: state.appliedGiftCard,
      }),
    }
  )
);

// Export types for external use
export type { CartItem as CartItemType };
