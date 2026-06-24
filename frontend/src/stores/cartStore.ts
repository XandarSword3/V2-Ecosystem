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

  addItem: (item: CartItem) => void;
  removeItem: (itemId: string, uniqueKey?: string) => void;
  updateQuantity: (itemId: string, quantity: number, uniqueKey?: string) => void;
  updateInstructions: (itemId: string, instructions: string, uniqueKey?: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getCount: () => number;
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
    }),
    {
      name: 'v2-ecosystem-cart',
    }
  )
);
