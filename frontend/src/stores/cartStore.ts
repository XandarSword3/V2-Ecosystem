import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FulfillmentMode, DestinationType } from '@/lib/engine-a/types';

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

export interface CartItem {
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

export interface CanonicalFulfillmentSelection {
  mode: FulfillmentMode;
  destinationType: DestinationType;
  destinationRef: string | null;
}

export interface CartState {
  items: CartItem[];
  fulfillmentByModule: Record<string, CanonicalFulfillmentSelection>;
  customerName: string;
  customerPhone: string;
  paymentMethod: 'cash' | 'card';
  notes: string;

  // Cart operations
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string, uniqueKey?: string) => void;
  updateQuantity: (itemId: string, quantity: number, uniqueKey?: string) => void;
  updateInstructions: (itemId: string, instructions: string, uniqueKey?: string) => void;
  clearCart: () => void;
  clearModuleItems: (moduleId: string) => void;
  clearModuleCheckoutState: (moduleId: string) => void;
  getTotal: () => number;
  getCount: () => number;

  // Fulfillment operations per module
  getFulfillmentForModule: (moduleIdOrSlug: string) => CanonicalFulfillmentSelection | undefined;
  setFulfillmentForModule: (moduleIdOrSlug: string, selection: CanonicalFulfillmentSelection) => void;
  clearFulfillmentForModule: (moduleIdOrSlug: string) => void;

  // Customer details
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setPaymentMethod: (paymentMethod: 'cash' | 'card') => void;
  setNotes: (notes: string) => void;
  clearOrderDetails: () => void;
}

// Single source of truth for "sum of items" math on the client. Any screen that
// needs a subtotal — full cart, a per-module slice of the cart, etc. — should call
// this instead of writing its own reduce, so a fix here fixes every screen at once.
export function calculateSubtotal(items: CartItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.price + (item.modifierTotal || 0)) * item.quantity,
    0
  );
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
      fulfillmentByModule: {},
      customerName: '',
      customerPhone: '',
      paymentMethod: 'cash',
      notes: '',

      addItem: (item) => set((state) => {
        const uniqueKey = item.uniqueKey || generateUniqueKey(item.id, item.selectedModifiers);
        const existing = state.items.find((i) =>
          i.uniqueKey === uniqueKey && (i.moduleId === item.moduleId || i.moduleSlug === item.moduleSlug)
        );

        if (existing) {
          return {
            items: state.items.map((i) =>
              (i.uniqueKey === uniqueKey && (i.moduleId === item.moduleId || i.moduleSlug === item.moduleSlug))
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

      clearCart: () => set({ items: [], fulfillmentByModule: {} }),

      clearModuleCheckoutState: (moduleIdOrSlug) => set((state) => {
        const nextFulfillment = { ...state.fulfillmentByModule };
        delete nextFulfillment[moduleIdOrSlug];
        return {
          items: state.items.filter((i) => i.moduleId !== moduleIdOrSlug && i.moduleSlug !== moduleIdOrSlug),
          fulfillmentByModule: nextFulfillment,
        };
      }),

      clearModuleItems: (moduleIdOrSlug) => {
        get().clearModuleCheckoutState(moduleIdOrSlug);
      },

      getTotal: () => calculateSubtotal(get().items),

      getCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getFulfillmentForModule: (moduleIdOrSlug) => {
        return get().fulfillmentByModule[moduleIdOrSlug];
      },

      setFulfillmentForModule: (moduleIdOrSlug, selection) => set((state) => ({
        fulfillmentByModule: {
          ...state.fulfillmentByModule,
          [moduleIdOrSlug]: selection,
        },
      })),

      clearFulfillmentForModule: (moduleIdOrSlug) => set((state) => {
        const next = { ...state.fulfillmentByModule };
        delete next[moduleIdOrSlug];
        return { fulfillmentByModule: next };
      }),

      setCustomerName: (name) => set({ customerName: name }),
      setCustomerPhone: (phone) => set({ customerPhone: phone }),
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      setNotes: (notes) => set({ notes }),
      clearOrderDetails: () => set({
        customerName: '',
        customerPhone: '',
        paymentMethod: 'cash',
        notes: '',
      }),
    }),
    {
      name: 'v2-ecosystem-cart',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return {
            items: [],
            fulfillmentByModule: {},
            customerName: '',
            customerPhone: '',
            paymentMethod: 'cash',
            notes: '',
          };
        }

        if (version < 2) {
          const legacy = persistedState;
          const legacyOrderType = legacy.orderType;
          const fulfillmentByModule: Record<string, CanonicalFulfillmentSelection> = {};

          let mappedSelection: CanonicalFulfillmentSelection | undefined = undefined;

          if (legacyOrderType === 'takeaway') {
            mappedSelection = {
              mode: 'pickup',
              destinationType: 'pickup_location',
              destinationRef: null,
            };
          } else if (legacyOrderType === 'delivery') {
            mappedSelection = {
              mode: 'local_delivery',
              destinationType: 'address',
              destinationRef: null,
            };
          } else if (legacyOrderType === 'dine_in') {
            // Only preserve destinationRef if tableNumber is a canonical UUID.
            // Text strings like "Table 4" are display labels, not canonical IDs — leave null so UI forces explicit selection.
            const isUUID = typeof legacy.tableNumber === 'string' &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(legacy.tableNumber);

            mappedSelection = {
              mode: 'on_premise',
              destinationType: 'on_premise_location',
              destinationRef: isUUID ? legacy.tableNumber : null,
            };
          }
          // Any unknown or corrupt legacy value leaves mappedSelection undefined (unresolved)

          if (mappedSelection && Array.isArray(legacy.items)) {
            legacy.items.forEach((item: any) => {
              const modKey = item.moduleId || item.moduleSlug;
              if (modKey && !fulfillmentByModule[modKey]) {
                fulfillmentByModule[modKey] = mappedSelection!;
              }
            });
          }

          return {
            items: legacy.items || [],
            fulfillmentByModule,
            customerName: legacy.customerName || '',
            customerPhone: legacy.customerPhone || '',
            paymentMethod: legacy.paymentMethod || 'cash',
            notes: legacy.notes || '',
          };
        }

        return persistedState;
      },
    }
  )
);
