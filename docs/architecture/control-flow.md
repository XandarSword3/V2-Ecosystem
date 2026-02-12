# Runtime Control Flow Analysis

## 🚀 Startup Sequence (`backend`)

1.  **Entry Point**: `src/index.ts`
    *   Imports `app`, `config`, `logger`.
    *   **Action**: `http.createServer(app)` is called immediately (sync).
    *   **Action**: `server.listen` start accepting connections (non-blocking).
    *   **Action**: `initializeDatabase()` (Async, background).
    *   **Action**: `initializeSocketServer(server)` (Attaches to HTTP instance).
    *   **Action**: `SchedulerService.init()` (Starts CRON jobs).

**Observation**: The server starts listening *before* the database connection is verified.
*   **Pro**: Faster "up" time for orchestrators (Reader/K8s).
*   **Con**: First few requests might fail if DB is lagging. Use `/health/ready` probe.

## 🔄 Request Lifecycle (HTTP)

1.  **Inbound**: Client sends request to `PORT 3001`.
2.  **Global Middleware** (in `app.ts`):
    *   `sentryRequestHandler`: Starts error tracking context.
    *   `helmet`: Applies security headers.
    *   `cors`: Checks Origin allowlist.
    *   `express.json` + `urlencoded`: Parses body (Limit 10mb).
    *   `csrfProtection`: Validates CSRF token (except excluded routes).
3.  **Routing**:
    *   Request dispatched to specific module router (e.g., `/api/restaurant`).
4.  **Module Middleware**:
    *   `authenticate`: Verifies JWT from Header/Cookie.
    *   `authorize`: Checks Role permissions.
    *   `validate(Schema)`: Zod input validation.
5.  **Controller Execution**:
    *   Calls Service Layer (Business Logic).
    *   Service calls ORM/DB.
6.  **Response**:
    *   JSON response sent.
7.  **Error Handling**:
    *   If error throws: Caught by `sentryErrorHandler`.
    *   Formatted by global error handler => JSON `{ status: 'error', message: ... }`.

## 📡 Messaging Flow (WebSocket)

1.  **Connection**: Client connects to `/`.
2.  **Handshake**: `socket.io` specific handshake.
3.  **Authentication**: Middleware verifies JWT token in handshake auth object.
4.  **Room Joining**: User joined to `userId` room and `role` room (e.g., `role:staff`).
5.  **Event Lifecycle**:
    *   **Emit**: Backend logic (e.g., Order Created) -> `io.to('role:kitchen').emit('order:new', data)`.
    *   **Receive**: Frontend `useSocket` hook receives event -> Updates React Query cache.

## ⚠️ Critical Critical Paths

1.  **Order Placement**:
    *   Frontend POST `/api/restaurant/orders`
    *   Backend validates -> DB Transaction (Order + Items) -> Emit Socket Event -> Return 201.
    *   **Failure Mode**: If Socket fails, Order is still saved (Eventual consistency).

2.  **User Auth**:
    *   Login -> JWT Issuance -> Cookie Set.
    *   **Dependency**: Requires strong sync time with DB for user lookup.
