# Shared Types

TypeScript type definitions shared between frontend and backend.

## Overview

This package provides type-safe contracts between the frontend and backend applications, ensuring consistency across the full stack.

## Installation

This package is linked locally in both `frontend` and `backend`:

```json
{
  "dependencies": {
    "@v2-resort/shared": "file:../shared"
  }
}
```

## Type Categories

### Base Types

```typescript
type UUID = string;

interface BaseEntity {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
```

### Users & Authentication

```typescript
interface User extends BaseEntity {
  email: string;
  phone?: string;
  fullName: string;
  profileImageUrl?: string;
  preferredLanguage: 'en' | 'ar' | 'fr';
  emailVerified: boolean;
  isActive: boolean;
}

interface Role extends BaseEntity {
  name: string;
  displayName: string;
  description?: string;
  businessUnit?: BusinessUnit;
}

type BusinessUnit = 'restaurant' | 'snack_bar' | 'chalets' | 'pool' | 'admin';

interface Permission {
  id: UUID;
  name: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
```

### Restaurant Types

```typescript
interface MenuCategory extends BaseEntity {
  name: string;
  nameAr?: string;
  nameFr?: string;
  sortOrder: number;
  isActive: boolean;
}

interface MenuItem extends BaseEntity {
  categoryId: UUID;
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  allergens?: string[];
}

interface Order extends BaseEntity {
  userId: UUID;
  moduleId: UUID;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  notes?: string;
}

type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'delivered' 
  | 'cancelled';
```

### Pool Types

```typescript
interface PoolSession extends BaseEntity {
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  adultPrice: number;
  childPrice: number;
  gender: 'mixed' | 'male' | 'female';
}

interface PoolBooking extends BaseEntity {
  userId: UUID;
  sessionId: UUID;
  date: string;
  adultCount: number;
  childCount: number;
  totalAmount: number;
  status: BookingStatus;
}
```

### Chalet Types

```typescript
interface Chalet extends BaseEntity {
  name: string;
  description?: string;
  capacity: number;
  pricePerNight: number;
  amenities: string[];
  images: string[];
  isActive: boolean;
}

interface ChaletBooking extends BaseEntity {
  userId: UUID;
  chaletId: UUID;
  checkIn: Date;
  checkOut: Date;
  totalAmount: number;
  status: BookingStatus;
}

type BookingStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'checked_in' 
  | 'checked_out' 
  | 'cancelled';
```

### Payment Types

```typescript
interface Payment extends BaseEntity {
  userId: UUID;
  orderId?: UUID;
  bookingId?: UUID;
  amount: number;
  currency: string;
  stripePaymentIntentId: string;
  status: PaymentStatus;
}

type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'succeeded' 
  | 'failed' 
  | 'refunded';
```

### API Response Types

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

## Usage

### In Backend

```typescript
import { User, Order, OrderStatus } from '@v2-resort/shared';

function updateOrderStatus(order: Order, status: OrderStatus): Order {
  return { ...order, status, updatedAt: new Date() };
}
```

### In Frontend

```typescript
import { User, ApiResponse } from '@v2-resort/shared';

async function fetchUser(id: string): Promise<ApiResponse<User>> {
  const response = await api.get(`/users/${id}`);
  return response.data;
}
```

## Adding New Types

1. Add type definition to `types/index.ts`
2. Export from package root
3. Run `npm run build` in shared package
4. Types are immediately available in both apps

---

Keep types synchronized between frontend and backend to maintain type safety across the stack.
