import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SelectedModifier {
  optionId: string;
  optionName: string;
  groupId: string;
  groupName: string;
  modifierType: 'add' | 'remove' | 'swap';
  priceAdjustment: number;
  quantity: number;
  inventoryItemId?: string;
  inventoryQuantity?: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
  category?: string;
  imageUrl?: string;
  moduleId?: string;
  moduleSlug?: string;
  type?: string;
  moduleName?: string;
  selectedModifiers?: SelectedModifier[];
  modifierTotal?: number;
  uniqueKey?: string;
}

interface CartState {
  items: CartItem[];
  restaurantItems: CartItem[];
  snackItems: CartItem[];

  addItem: (item: CartItem) => void;
  removeItem: (itemId: string, uniqueKey?: string) => void;
  updateQuantity: (itemId: string, quantity: number, uniqueKey?: string) => void;
  updateInstructions: (itemId: string, instructions: string, uniqueKey?: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getCount: () => number;

  addToRestaurant: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromRestaurant: (itemId: string, uniqueKey?: string) => void;
  updateRestaurantQuantity: (itemId: string, quantity: number, uniqueKey?: string) => void;
  updateRestaurantInstructions: (itemId: string, instructions: string, uniqueKey?: string) => void;
  clearRestaurantCart: () => void;

  addToSnack: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromSnack: (itemId: string, uniqueKey?: string) => void;
  updateSnackQuantity: (itemId: string, quantity: number, uniqueKey?: string) => void;
  clearSnackCart: () => void;

  getRestaurantTotal: () => number;
  getRestaurantCount: () => number;
  getSnackTotal: () => number;
  getSnackCount: () => number;
}

function generateUniqueKey(itemId: string, modifiers?: SelectedModifier[]): string {
  if (!modifiers || modifiers.length === 0) return itemId;
  const modifierKey = modifiers
    .map(m => `${m.optionId}:${m.quantity}`)
    .sort()
    .join('|');
  return `${itemId}__${modifierKey}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantItems: [],
      snackItems: [],

      addItem: (item) => set((state) => {
        const uniqueKey = item.uniqueKey || generateUniqueKey(item.id, item.selectedModifiers);
        const existing = state.items.find((i) =>
          i.uniqueKey === uniqueKey && i.moduleId === item.moduleId
        );

        if (existing) {
          return {
            items: state.items.map((i) =>
              (i.uniqueKey === uniqueKey && i.moduleId === item.moduleId)
                ? { ...i, quantity: i.quantity + (item.quantity || 1) }
                : i
            ),
          };
        }
        return {
          items: [...state.items, { ...item, uniqueKey, quantity: item.quantity || 1 }],
        };
      }),

      removeItem: (itemId, uniqueKey) => set((state) => ({
        items: state.items.filter((i) => uniqueKey ? i.uniqueKey !== uniqueKey : i.id !== itemId),
      })),

      updateQuantity: (itemId, quantity, uniqueKey) => set((state) => {
        if (quantity <= 0) {
          return {
            items: state.items.filter((i) => uniqueKey ? i.uniqueKey !== uniqueKey : i.id !== itemId),
          };
        }
        return {
          items: state.items.map((i) =>
            (uniqueKey ? i.uniqueKey === uniqueKey : i.id === itemId) ? { ...i, quantity } : i
          ),
        };
      }),

      updateInstructions: (itemId, instructions, uniqueKey) => set((state) => ({
        items: state.items.map((i) =>
          (uniqueKey ? i.uniqueKey === uniqueKey : i.id === itemId)
            ? { ...i, specialInstructions: instructions }
            : i
        ),
      })),

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        return get().items.reduce(
          (sum, item) => sum + (item.price + (item.modifierTotal || 0)) * item.quantity,
          0
        );
      },

      getCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      // Restaurant cart actions
      addToRestaurant: (item) => get().addItem({
        ...item,
        quantity: 1,
        type: 'restaurant',
        moduleId: 'restaurant',
        moduleName: 'Restaurant'
      }),

      removeFromRestaurant: (itemId, uniqueKey) => get().removeItem(itemId, uniqueKey),

      updateRestaurantQuantity: (id, q, uniqueKey) => get().updateQuantity(id, q, uniqueKey),

      updateRestaurantInstructions: (id, i, uniqueKey) => get().updateInstructions(id, i, uniqueKey),

      clearRestaurantCart: () => set((state) => ({
        items: state.items.filter(i => i.moduleId !== 'restaurant')
      })),

      // Snack bar cart actions  
      addToSnack: (item) => get().addItem({
        ...item,
        quantity: 1,
        type: 'snack',
        moduleId: 'snack-bar',
        moduleName: 'Snack Bar'
      }),

      removeFromSnack: (itemId, uniqueKey) => get().removeItem(itemId, uniqueKey),

      updateSnackQuantity: (id, q, uniqueKey) => get().updateQuantity(id, q, uniqueKey),

      clearSnackCart: () => set((state) => ({
        items: state.items.filter(i => i.moduleId !== 'snack-bar')
      })),

      // Computed getters
      getRestaurantCount: () => get().items
        .filter(i => i.moduleId === 'restaurant')
        .reduce((sum, i) => sum + i.quantity, 0),

      getSnackCount: () => get().items
        .filter(i => i.moduleId === 'snack-bar')
        .reduce((sum, i) => sum + i.quantity, 0),

      getRestaurantTotal: () => get().items
        .filter(i => i.moduleId === 'restaurant')
        .reduce((sum, i) => sum + (i.price + (i.modifierTotal || 0)) * i.quantity, 0),

      getSnackTotal: () => get().items
        .filter(i => i.moduleId === 'snack-bar')
        .reduce((sum, i) => sum + (i.price + (i.modifierTotal || 0)) * i.quantity, 0),
    }),
    {
      name: 'v2-resort-cart',
    }
  )
);
