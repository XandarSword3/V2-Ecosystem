import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
  category?: string;
  imageUrl?: string;
  moduleId?: string;
}

interface CartState {
  // Restaurant cart
  restaurantItems: CartItem[];
  // Snack bar cart  
  snackItems: CartItem[];
  
  // Restaurant cart actions
  addToRestaurant: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromRestaurant: (itemId: string) => void;
  updateRestaurantQuantity: (itemId: string, quantity: number) => void;
  updateRestaurantInstructions: (itemId: string, instructions: string) => void;
  clearRestaurantCart: () => void;
  
  // Snack bar cart actions
  addToSnack: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromSnack: (itemId: string) => void;
  updateSnackQuantity: (itemId: string, quantity: number) => void;
  clearSnackCart: () => void;
  
  // Computed
  getRestaurantTotal: () => number;
  getRestaurantCount: () => number;
  getSnackTotal: () => number;
  getSnackCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantItems: [], 
      snackItems: [], 

      addItem: (item) => set((state) => {
        const existing = state.items.find((i) => 
            i.id === item.id && i.moduleId === item.moduleId && i.specialInstructions === item.specialInstructions
        );
        
        if (existing) {
          return {
            items: state.items.map((i) =>
              (i.id === item.id && i.moduleId === item.moduleId && i.specialInstructions === item.specialInstructions) 
              ? { ...i, quantity: i.quantity + (item.quantity || 1) } 
              : i
            ),
          };
        }
        return {
          items: [...state.items, { ...item, quantity: item.quantity || 1 }],
        };
      }),

      removeItem: (itemId) => set((state) => ({
        items: state.items.filter((i) => i.id !== itemId),
      })),

      updateQuantity: (itemId, quantity) => set((state) => {
        if (quantity <= 0) {
          return {
            items: state.items.filter((i) => i.id !== itemId),
          };
        }
        return {
          items: state.items.map((i) =>
            i.id === itemId ? { ...i, quantity } : i
          ),
        };
      }),

      updateInstructions: (itemId, instructions) => set((state) => ({
        items: state.items.map((i) =>
          i.id === itemId ? { ...i, specialInstructions: instructions } : i
        ),
      })),

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        return get().items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
      },

      getCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      // Legacy Compatibility 
      addToRestaurant: (item) => get().addItem({ ...item, quantity: 1, type: 'restaurant', moduleId: 'restaurant', moduleName: 'Restaurant' }),
      removeFromRestaurant: (itemId) => get().removeItem(itemId),
      
      addToSnack: (item) => get().addItem({ ...item, quantity: 1, type: 'snack', moduleId: 'snack-bar', moduleName: 'Snack Bar' }),
      removeFromSnack: (itemId) => get().removeItem(itemId),

      getRestaurantCount: () => get().items.filter(i => i.moduleId === 'restaurant').reduce((sum, i) => sum + i.quantity, 0),
      getSnackCount: () => get().items.filter(i => i.moduleId === 'snack-bar').reduce((sum, i) => sum + i.quantity, 0),
      
      getRestaurantTotal: () => get().items.filter(i => i.moduleId === 'restaurant').reduce((sum, i) => sum + i.price * i.quantity, 0),
      getSnackTotal: () => get().items.filter(i => i.moduleId === 'snack-bar').reduce((sum, i) => sum + i.price * i.quantity, 0),
      
      updateRestaurantQuantity: (id, q) => get().updateQuantity(id, q),
      updateRestaurantInstructions: (id, i) => get().updateInstructions(id, i),
      clearRestaurantCart: () => set((state) => ({ items: state.items.filter(i => i.moduleId !== 'restaurant') })),
      
      updateSnackQuantity: (id, q) => get().updateQuantity(id, q),
      clearSnackCart: () => set((state) => ({ items: state.items.filter(i => i.moduleId !== 'snack-bar') })),
    }),
    {
      name: 'v2-resort-cart',
    }
  )
);
