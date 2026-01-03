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
      restaurantItems: [],
      snackItems: [],
      
      // Restaurant actions
      addToRestaurant: (item) => set((state) => {
        const existing = state.restaurantItems.find((i) => i.id === item.id);
        if (existing) {
          return {
            restaurantItems: state.restaurantItems.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          };
        }
        return {
          restaurantItems: [...state.restaurantItems, { ...item, quantity: 1 }],
        };
      }),
      
      removeFromRestaurant: (itemId) => set((state) => {
        const existing = state.restaurantItems.find((i) => i.id === itemId);
        if (existing && existing.quantity > 1) {
          return {
            restaurantItems: state.restaurantItems.map((i) =>
              i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
            ),
          };
        }
        return {
          restaurantItems: state.restaurantItems.filter((i) => i.id !== itemId),
        };
      }),
      
      updateRestaurantQuantity: (itemId, quantity) => set((state) => {
        if (quantity <= 0) {
          return {
            restaurantItems: state.restaurantItems.filter((i) => i.id !== itemId),
          };
        }
        return {
          restaurantItems: state.restaurantItems.map((i) =>
            i.id === itemId ? { ...i, quantity } : i
          ),
        };
      }),
      
      updateRestaurantInstructions: (itemId, instructions) => set((state) => ({
        restaurantItems: state.restaurantItems.map((i) =>
          i.id === itemId ? { ...i, specialInstructions: instructions } : i
        ),
      })),
      
      clearRestaurantCart: () => set({ restaurantItems: [] }),
      
      // Snack actions
      addToSnack: (item) => set((state) => {
        const existing = state.snackItems.find((i) => i.id === item.id);
        if (existing) {
          return {
            snackItems: state.snackItems.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          };
        }
        return {
          snackItems: [...state.snackItems, { ...item, quantity: 1 }],
        };
      }),
      
      removeFromSnack: (itemId) => set((state) => {
        const existing = state.snackItems.find((i) => i.id === itemId);
        if (existing && existing.quantity > 1) {
          return {
            snackItems: state.snackItems.map((i) =>
              i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
            ),
          };
        }
        return {
          snackItems: state.snackItems.filter((i) => i.id !== itemId),
        };
      }),
      
      updateSnackQuantity: (itemId, quantity) => set((state) => {
        if (quantity <= 0) {
          return {
            snackItems: state.snackItems.filter((i) => i.id !== itemId),
          };
        }
        return {
          snackItems: state.snackItems.map((i) =>
            i.id === itemId ? { ...i, quantity } : i
          ),
        };
      }),
      
      clearSnackCart: () => set({ snackItems: [] }),
      
      // Computed
      getRestaurantTotal: () => {
        return get().restaurantItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
      },
      
      getRestaurantCount: () => {
        return get().restaurantItems.reduce((sum, item) => sum + item.quantity, 0);
      },
      
      getSnackTotal: () => {
        return get().snackItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
      },
      
      getSnackCount: () => {
        return get().snackItems.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: 'v2-resort-cart',
    }
  )
);
