<!-- Last updated: 2026-05-10 -->

# Runtime Control Flow Analysis

## 🚀 Startup Sequence (`backend`)

1. **Entry Point**: `src/index.ts`
   - Imports `app`, `config`, `logger`
   - **Action**: `http.createServer(app)` called immediately (sync)
   - **Action**: `server.listen` starts accepting connections (non-blocking)
   - **Action**: `initializeDatabase()` (async, background)
   - **Action**: `initializeSocketServer(server)` (attaches to HTTP instance)
   - **Action**: `SchedulerService.init()` (starts CRON jobs)

**Observation**: Server starts listening *before* database connection is verified.
- **Pro**: Faster "up" time for orchestrators
- **Con**: First requests may fail if DB is lagging. Use `/health/ready` probe.

---

## 🔄 Request Lifecycle (HTTP)

1. **Inbound**: Client sends request to `PORT 3005` (backend) or `PORT 3000` (frontend)
2. **Global Middleware** (in `app.ts`):
   - `sentryRequestHandler`: Starts error tracking context
   - `helmet`: Applies security headers
   - `cors`: Checks origin allowlist
   - `express.json` + `urlencoded`: Parses body (limit 10mb)
   - `csrfProtection`: Validates CSRF token (except excluded routes)
3. **Dynamic Module Routing**:
   - Request routed via `dynamic-module.router.ts`
   - Module type determined from path or header
   - **Engine Resolution**: Template type mapped to engine (`instant_transaction`, `time_exclusive_reservation`, etc.)
4. **Engine Middleware**:
   - `authenticate`: Verifies JWT from header/cookie
   - `authorize`: Checks role permissions
   - `validate(Schema)`: Zod input validation
5. **Engine Execution**:
   - **State Machine**: `createStateMachine(engineType)` creates appropriate state machine
   - **Pricing Pipeline**: `calculatePricing()` computes line items, taxes, discounts
   - **Idempotency Guard**: Checks `X-Idempotency-Key` for duplicate prevention
   - **Persistence**: Transaction recorded in unified `transactions` table
6. **Response**: JSON response with `transaction_id`, `state`, `pricing` breakdown
7. **Error Handling**:
   - Errors caught by `sentryErrorHandler`
   - Formatted by global error handler → JSON `{ status: 'error', message: ... }`

---

## ⚡ Engine Transaction Flow

All transactions flow through the 4-engine framework:

### 1. Instant Transaction (`instant_transaction`)
**Pattern**: Point-of-sale orders (menu items, snack bar)

```
POST /api/v1/payments/intent
├── Engine: instant_transaction
├── State Machine: pending → confirmed → preparing → ready → delivered → completed
├── Side Effects:
│   ├── Inventory deduction (on 'confirm')
│   ├── Kitchen display update (Socket emit)
│   └── Receipt generation
└── Table: restaurant_orders (via transactions sync trigger)
```

### 2. Time-Exclusive Reservation (`time_exclusive_reservation`)
**Pattern**: Multi-day bookings (chalets, rooms)

```
POST /api/bookings
├── Engine: time_exclusive_reservation
├── State Machine: pending → confirmed → checked_in → checked_out
├── Side Effects:
│   ├── Calendar hold (on 'confirmed')
│   ├── Housekeeping schedule (on 'checked_out')
│   └── Payment schedule creation
└── Table: chalet_bookings (via transactions sync trigger)
```

### 3. Shared Capacity Access (`shared_capacity_access`)
**Pattern**: Session-based access (pool, gym)

```
POST /api/pool/tickets
├── Engine: shared_capacity_access
├── State Machine: valid → active → used
├── Side Effects:
│   ├── Capacity check (on 'active')
│   ├── Session timeout handling
│   └── Entry/exit logging
└── Table: pool_tickets (via transactions sync trigger)
```

### 4. Ongoing Entitlement (`ongoing_entitlement`)
**Pattern**: Subscriptions, memberships

```
POST /api/memberships
├── Engine: ongoing_entitlement
├── State Machine: pending → active → paused → expired
├── Side Effects:
│   ├── Recurring payment setup
│   ├── Tier benefit activation
│   └── Renewal notifications
└── Table: membership_subscriptions (via transactions sync trigger)
```

---

## 📡 Messaging Flow (WebSocket)

1. **Connection**: Client connects to `/`
2. **Handshake**: `socket.io` specific handshake
3. **Authentication**: Middleware verifies JWT in handshake auth object
4. **Room Joining**:
   - User joined to `userId` room
   - Role-based rooms: `role:staff`, `role:admin`, `role:kitchen`
5. **Event Lifecycle**:
   - **Emit**: Backend engine event → `io.to('role:kitchen').emit('order:new', data)`
   - **Receive**: Frontend `useSocket` hook receives → Updates React Query cache

**Engine Events:**
- `transaction:state_change` — State machine transitions
- `transaction:payment_update` — Payment status changes
- `transaction:pricing_update` — Discount/coupon applied

---

## ⚠️ Critical Paths

### 1. Engine Transaction Placement
```
Frontend POST /api/v1/payments/intent
├── Engine type resolved from template
├── State machine validates transition
├── Idempotency key check
├── Pricing calculation (taxes, discounts, loyalty)
├── Payment intent created (Stripe)
├── Transaction recorded (unified table)
├── Sync trigger updates source table
├── Socket event emitted
└── Response 201 with transaction_id
```
**Failure Modes**:
- Idempotency key prevents duplicate charges
- Socket failure: transaction still persisted (eventual consistency)
- State machine blocks invalid transitions

### 2. Cross-Engine Journey
```
User Action: Book chalet + order room service
├── Engine A (reservation): Creates booking
├── Engine B (instant): Creates food order linked to booking
├── Shared context: User ID, property ID, session ID
└── Unified transaction view via `transactions` table
```

### 3. User Auth
```
POST /api/auth/login
├── Credentials validation
├── JWT issuance (access + refresh tokens)
├── Cookie set (httpOnly, secure)
├── Session recorded in Redis
└── Response with user profile + permissions
```

---

## 🔍 Observability Points

| Stage | Metric | Source |
|-------|--------|--------|
| Request Entry | HTTP request count | Express middleware |
| Engine Resolution | Engine type distribution | `dynamic-module.router.ts` |
| State Transition | State change latency | `state-machine.ts` |
| Pricing | Calculation duration | `calculatePricing()` |
| Payment | Payment intent creation time | Stripe SDK |
| Persistence | DB write latency | `transactions` table |
| Real-time | Socket event delivery | Socket.io metrics |
