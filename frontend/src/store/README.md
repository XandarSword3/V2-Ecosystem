# Frontend State Management

Zustand stores for managing application state.

## Overview

The V2 Resort frontend uses Zustand for global state management, complemented by React Query for server state.

## Store Structure

```
store/
├── authStore.ts           # Authentication state
├── cartStore.ts           # Shopping cart
├── settingsStore.ts       # User preferences
├── module-builder-store.ts # Builder state (admin)
└── README.md              # This file
```

## Stores

### Auth Store (`authStore.ts`)

Manages authentication state and tokens:

```typescript
interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

// Usage
const { user, isAuthenticated, login, logout } = useAuthStore();

// Login
await login({ email, password });

// Logout
logout();
```

### Cart Store (`cartStore.ts`)

Shopping cart for restaurant orders:

```typescript
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  moduleId: string;
  moduleName: string;
  type: 'restaurant' | 'snack';
  imageUrl?: string;
}

interface CartStore {
  items: CartItem[];
  totalAmount: number;
  itemCount: number;
  
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  clearModuleCart: (moduleId: string) => void;
}

// Usage
const { items, addItem, totalAmount } = useCartStore();

// Add item
addItem({
  id: 'item-1',
  name: 'Grilled Salmon',
  price: 25.99,
  quantity: 1,
  moduleId: 'restaurant-1',
  moduleName: 'Main Restaurant',
  type: 'restaurant'
});
```

### Settings Store (`settingsStore.ts`)

User preferences and UI settings:

```typescript
interface SettingsStore {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  language: 'en' | 'ar' | 'fr';
  sidebarCollapsed: boolean;
  
  setTheme: (theme: Theme) => void;
  setCurrency: (currency: string) => void;
  setLanguage: (language: Language) => void;
  toggleSidebar: () => void;
}

// Usage
const { theme, setTheme, currency } = useSettingsStore();

// Change theme
setTheme('dark');
```

### Module Builder Store (`module-builder-store.ts`)

Visual builder state for admin:

```typescript
interface ModuleBuilderStore {
  activeModuleId: string | null;
  layout: UIBlock[];
  selectedBlockId: string | null;
  isPreview: boolean;
  zoom: number;
  history: UIBlock[][];
  _futureStates: UIBlock[][];
  
  setLayout: (layout: UIBlock[], skipHistory?: boolean) => void;
  selectBlock: (id: string | null) => void;
  addBlock: (type: UIComponentType) => void;
  updateBlock: (id: string, updates: Partial<UIBlock>) => void;
  removeBlock: (id: string) => void;
  moveBlock: (activeId: string, overId: string) => void;
  duplicateBlock: (id: string) => void;
  undo: () => void;
  redo: () => void;
}
```

## Persistence

Stores can persist to localStorage:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // ... store implementation
    }),
    {
      name: 'cart-storage',
      // Optional: customize what gets persisted
      partialize: (state) => ({ items: state.items }),
    }
  )
);
```

## Best Practices

### 1. Selector Functions

Use selectors for performance:

```typescript
// ❌ Bad - re-renders on any state change
const { items, totalAmount, addItem } = useCartStore();

// ✅ Good - only re-renders when specific values change
const items = useCartStore((s) => s.items);
const addItem = useCartStore((s) => s.addItem);
```

### 2. Actions Outside Components

Keep logic in the store, not components:

```typescript
// ❌ Bad
function Component() {
  const { items, setItems } = useStore();
  const addItem = (item) => setItems([...items, item]);
}

// ✅ Good
// In store
addItem: (item) => set((state) => ({
  items: [...state.items, item],
  totalAmount: state.totalAmount + item.price
})),

// In component
const addItem = useStore((s) => s.addItem);
addItem(newItem);
```

### 3. Computed Values

Derive values in selectors or getters:

```typescript
const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  
  // Computed getter
  get totalAmount() {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },
  
  get itemCount() {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  }
}));
```

### 4. Middleware Composition

Combine middleware for complex stores:

```typescript
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';

export const useStore = create<Store>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // ... store
      })),
      { name: 'store' }
    ),
    { name: 'MyStore' }
  )
);
```

## Server State (React Query)

For server data, use React Query instead:

```typescript
// ❌ Don't put API data in Zustand
const { users, setUsers } = useUsersStore();
useEffect(() => {
  api.getUsers().then(setUsers);
}, []);

// ✅ Use React Query for server state
const { data: users, isLoading } = useQuery({
  queryKey: ['users'],
  queryFn: () => api.getUsers()
});
```

## Debugging

Enable devtools in development:

```typescript
import { devtools } from 'zustand/middleware';

const useStore = create<Store>()(
  devtools(
    (set) => ({ /* ... */ }),
    { name: 'CartStore', enabled: process.env.NODE_ENV === 'development' }
  )
);
```

Use Redux DevTools browser extension to inspect state.

---

Keep stores focused and single-purpose. For complex cross-store logic, create custom hooks that compose multiple stores.
