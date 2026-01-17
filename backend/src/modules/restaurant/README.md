# Restaurant Module

Restaurant ordering and kitchen management system.

## Features

- **Menu Management** - Categories, items, pricing
- **Order Flow** - Cart → Checkout → Kitchen → Delivery
- **Kitchen Display** - Real-time order queue
- **Status Tracking** - Live order updates via WebSocket

## API Endpoints

### Menu

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/restaurant/menu` | Get full menu |
| `GET` | `/restaurant/menu/:moduleId` | Module-specific menu |
| `GET` | `/restaurant/categories` | List categories |
| `POST` | `/restaurant/categories` | Create category (admin) |
| `GET` | `/restaurant/items` | List items |
| `POST` | `/restaurant/items` | Create item (admin) |

### Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/restaurant/orders` | Create order |
| `GET` | `/restaurant/orders` | User's orders |
| `GET` | `/restaurant/orders/:id` | Order details |
| `PUT` | `/restaurant/orders/:id/status` | Update status (staff) |
| `GET` | `/restaurant/kitchen` | Kitchen queue (staff) |

## Order Status Flow

```
pending → confirmed → preparing → ready → delivered
                                       ↘ cancelled
```

## WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `new-order` | Server → Kitchen | `{ orderId, items, customerName }` |
| `order-status-updated` | Server → Client | `{ orderId, status }` |

## Data Models

### MenuCategory

```typescript
{
  id: UUID,
  moduleId: UUID,
  name: string,
  name_ar?: string,
  name_fr?: string,
  sortOrder: number,
  isActive: boolean
}
```

### MenuItem

```typescript
{
  id: UUID,
  categoryId: UUID,
  name: string,
  name_ar?: string,
  description?: string,
  price: number,
  imageUrl?: string,
  isAvailable: boolean,
  allergens?: string[]
}
```

### Order

```typescript
{
  id: UUID,
  userId: UUID,
  moduleId: UUID,
  status: OrderStatus,
  items: OrderItem[],
  totalAmount: number,
  deliveryType: 'pickup' | 'delivery' | 'dine-in',
  tableNumber?: string,
  notes?: string,
  createdAt: Date
}
```

## Kitchen Display

Real-time kitchen interface for staff:

1. Orders appear automatically via WebSocket
2. Staff accepts order (confirmed)
3. Staff starts preparing (preparing)
4. Order complete (ready)
5. Customer picks up/delivery (delivered)

---

See [frontend/src/components/modules/restaurant](../../frontend/src/components/modules/restaurant) for UI components.
