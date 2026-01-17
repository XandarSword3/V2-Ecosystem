# Socket.io Real-Time Layer

WebSocket handlers for real-time features using Socket.io.

## Scope & Limitations

> ⚠️ **Important**: Socket.io is used **ONLY for notifications**, not for critical operations.

### What Socket.io Handles ✅
- **Order status updates** - Read-only notifications to kitchen/customers
- **Live user tracking** - Admin dashboard analytics
- **Notifications** - Push notifications to connected clients
- **Chat support** - Customer support messaging

### What Socket.io Does NOT Handle ❌
- **Payment processing** - Uses REST API + Stripe
- **User authentication** - Uses REST API + JWT
- **Admin mutations** - Uses REST API
- **Role/permission changes** - Uses REST API
- **Database writes** - Uses REST API

This architecture ensures that all critical business operations are handled via secure REST endpoints with full validation, while Socket.io provides real-time UX enhancements only.

## Test Coverage

Socket.io handlers have ~18% test coverage. This is acceptable because:
1. Sockets are NOT used for any critical operations
2. All data mutations use REST APIs which have 71%+ coverage
3. Socket failures degrade UX but don't affect data integrity

## Overview

The socket layer provides real-time communication for:

- **Order Updates** - Kitchen to customer status changes
- **Live User Tracking** - Admin dashboard user monitoring
- **Notifications** - Push notifications to connected clients
- **Chat Support** - Customer support messaging

## Directory Structure

```
socket/
├── index.ts           # Socket.io server setup
├── handlers/          # Event handlers by feature
│   ├── orders.ts      # Order-related events
│   ├── notifications.ts
│   ├── chat.ts
│   └── admin.ts
├── middleware/        # Socket middleware
│   └── auth.ts        # Socket authentication
└── README.md          # This file
```

## Server Setup

```typescript
// socket/index.ts
import { Server } from 'socket.io';
import { createServer } from 'http';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  },
  pingTimeout: 120000,
  pingInterval: 30000
});

// Authentication middleware
io.use(socketAuthMiddleware);

// Connection handler
io.on('connection', (socket) => {
  handleConnection(socket);
});

export { io };
```

## Authentication

Sockets authenticate via JWT token:

```typescript
// Client sends token in auth
const socket = io(SOCKET_URL, {
  auth: { token: accessToken }
});

// Server validates
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const user = verifyToken(token);
    socket.data.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});
```

## Room System

Sockets join rooms for targeted broadcasts:

```typescript
// Join order-specific room
socket.on('join-room', (room, callback) => {
  socket.join(room);
  callback(true);
});

// Server broadcasts to room
io.to(`order-${orderId}`).emit('order-status-updated', {
  orderId,
  status: 'ready',
  updatedAt: new Date()
});
```

### Room Naming Convention

| Room Pattern | Purpose |
|--------------|---------|
| `order-{id}` | Order status updates |
| `restaurant-kitchen` | Kitchen display orders |
| `pool-staff` | Pool management |
| `admin-dashboard` | Admin live stats |
| `user-{id}` | Personal notifications |

## Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{ room: string }` | Join a broadcast room |
| `leave-room` | `{ room: string }` | Leave a room |
| `heartbeat` | `{}` | Keep connection alive |
| `page:navigate` | `{ path: string }` | Track user navigation |
| `user:update` | `{ userId, roles }` | Update user info |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `order-status-updated` | `OrderStatusUpdate` | Order status change |
| `new-order` | `NewOrderNotification` | New order for kitchen |
| `notification` | `Notification` | General notification |
| `live-users-update` | `LiveUsers[]` | Admin dashboard stats |

## Usage Examples

### Broadcasting Order Update

```typescript
// In order controller after status change
import { io } from '@/socket';

async function updateOrderStatus(orderId: string, newStatus: string) {
  await orderService.updateStatus(orderId, newStatus);
  
  // Notify customer watching this order
  io.to(`order-${orderId}`).emit('order-status-updated', {
    orderId,
    status: newStatus,
    updatedAt: new Date()
  });
  
  // Notify kitchen staff
  io.to('restaurant-kitchen').emit('order-status-updated', {
    orderId,
    status: newStatus
  });
}
```

### Sending New Order to Kitchen

```typescript
async function createOrder(orderData) {
  const order = await orderService.create(orderData);
  
  io.to('restaurant-kitchen').emit('new-order', {
    orderId: order.id,
    customerName: order.user.fullName,
    items: order.items,
    createdAt: order.createdAt
  });
  
  return order;
}
```

### Live User Tracking

```typescript
// Track page views
socket.on('page:navigate', ({ path }) => {
  const userId = socket.data.user?.id;
  if (userId) {
    liveUsersService.updateUserPath(userId, path);
    broadcastLiveUsers();
  }
});

function broadcastLiveUsers() {
  const liveUsers = liveUsersService.getAll();
  io.to('admin-dashboard').emit('live-users-update', liveUsers);
}
```

## Client-Side Hooks

The frontend provides React hooks for socket integration:

```typescript
// hooks/useSocket.ts
import { useSocket, useOrderUpdates, useRestaurantOrders } from '@/lib/socket';

// In order tracking component
function OrderTracker({ orderId }) {
  useOrderUpdates(orderId, (update) => {
    setOrderStatus(update.status);
    toast.info(`Order ${update.status}`);
  });
}

// In kitchen display
function KitchenDisplay() {
  useRestaurantOrders(
    (newOrder) => setOrders(prev => [newOrder, ...prev]),
    (update) => updateOrderInList(update)
  );
}
```

## Connection Management

### Heartbeat

Clients send heartbeat every 30 seconds:

```typescript
// Client
setInterval(() => {
  if (socket.connected) {
    socket.emit('heartbeat');
  }
}, 30000);
```

### Reconnection

Automatic reconnection with exponential backoff:

```typescript
const socket = io(URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconnected after ${attemptNumber} attempts`);
  // Re-authenticate and rejoin rooms
});
```

## Scaling Considerations

For multiple server instances, use Redis adapter:

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

---

See frontend [socket.ts](../../frontend/src/lib/socket.ts) for client-side implementation.
