# Frontend Types

TypeScript type definitions specific to the frontend application.

## Directory Structure

```
types/
├── index.ts            # Re-exports
├── module-builder.ts   # Module builder types
├── api.ts              # API response types
└── README.md           # This file
```

## Module Builder Types (`module-builder.ts`)

Types for the visual UI builder:

```typescript
// Block component types
export type UIComponentType = 
  | 'hero'
  | 'container'
  | 'grid'
  | 'text_block'
  | 'image'
  | 'menu_list'
  | 'session_list'
  | 'booking_calendar';

// Individual UI block
export interface UIBlock {
  id: string;
  type: UIComponentType;
  label: string;
  props: Record<string, unknown>;
  style?: React.CSSProperties;
  children?: UIBlock[];
}

// Block property definitions
export interface BlockProperty {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'color' | 'image';
  options?: { value: string; label: string }[];
  default?: unknown;
}
```

## API Types (`api.ts`)

Frontend-specific API response handling:

```typescript
// Generic API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

// Error structure
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

// Pagination metadata
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Query parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
```

## Form Types

Types for form handling:

```typescript
// Login form
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Registration form
export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone?: string;
  preferredLanguage?: 'en' | 'ar' | 'fr';
}

// Order form
export interface OrderFormData {
  items: CartItem[];
  deliveryType: 'pickup' | 'delivery' | 'dine-in';
  notes?: string;
  tableNumber?: string;
}
```

## Component Props

Common component prop types:

```typescript
// Button variants
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

// Modal props
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Table column definition
export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}
```

## Store Types

Zustand store type definitions:

```typescript
// Cart item
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
  type: 'restaurant' | 'snack';
  imageUrl?: string;
}

// User preferences
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  language: 'en' | 'ar' | 'fr';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}
```

## Socket Event Types

Types for real-time events:

```typescript
// Order status update
export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  previousStatus?: OrderStatus;
  updatedAt: string;
  updatedBy?: string;
}

// New order notification
export interface NewOrderNotification {
  orderId: string;
  moduleId: string;
  customerName?: string;
  totalAmount: number;
  items: number;
  createdAt: string;
}

// Live user data
export interface LiveUser {
  id: string;
  socketId: string;
  email?: string;
  fullName?: string;
  roles: string[];
  currentPath: string;
  connectedAt: string;
}
```

## Usage

Import types as needed:

```typescript
import { UIBlock, UIComponentType } from '@/types/module-builder';
import { ApiResponse, PaginationMeta } from '@/types/api';
import { CartItem } from '@/types';

// Use in function signatures
function renderBlock(block: UIBlock): React.ReactNode { ... }

// Use in API calls
async function fetchOrders(): Promise<ApiResponse<Order[]>> { ... }
```

## Shared Types

For types shared with backend, import from `@v2-resort/shared`:

```typescript
import { User, Order, MenuItem } from '@v2-resort/shared';
```

---

Keep frontend-specific types here. Shared types belong in the `shared/types` package.
