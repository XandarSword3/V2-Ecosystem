# Backend Core Subsystem (`@v2-resort/backend`)

## 🎯 Purpose
The **Backend Core** serves as the central orchestration layer for the entire V2Resort ecosystem. It routes HTTP traffic, manages database connections, handles global error states, and orchestrates the startup lifecycle of all business modules.

## 🔑 Responsibilities
*   **Process Lifecycle**: Graceful startup and shutdown.
*   **Request Routing**: Disparching URLs to specific module routers.
*   **Security Perimeter**: Enforcing Headers, CORS, and CSRF protection globally.
*   **Observability**: Centralized Logging (`winston`) and Error Tracking (`Sentry`).
*   **Connection Management**: Holding the specific instances of HTTP Server, Database Pool, and Redis Client.

## 🏗️ Internal Architecture

### Entry Point (`src/index.ts`)
The `main()` function is the root of the process.
*   **Sync**: Creates HTTP server instance immediately.
*   **Async**: Initiates Database and Redis connections in the background.
*   **Benefit**: Allows the server to accept connections (and fail `/health`) before DB is ready, preventing boot loops in orchestrators.

### Application Factory (`src/app.ts`)
Defines the Express Application pipeline:
1.  **Sentry Handler**: Must be first to capture context.
2.  **Helmet/CORS**: Security headers.
3.  **Parsers**: JSON/URL-Encoded (Limit: 10mb).
4.  **CSRF**: Applied globally to state-changing methods.
5.  **Routes**: Imports `*.routes.js` from all modules.
6.  **Error Handling**: Global trap for unhandled exceptions.

### Global Middleware Stack
*   `requestId`: Tags every request with a UUID for log tracing.
*   `rateLimit`: Protects public endpoints (Auth/Register).
*   `authenticate`: Verifies JWT on protected routes.

## 🔄 Control Flow
*   **Startup**: `index.ts` -> `app.ts` -> `modules/*/routes` -> `http.listen`.
*   **Shutdown**: Listens for `SIGTERM`/`SIGINT`. closes HTTP server first, then waits for DB connections to drain.

## ⚠️ Known Debt / Constraints
*   **Monolithic Startup**: `app.ts` statically imports all modules. A failure in one module (e.g., config error) prevents the entire server from starting.
*   **Socket Scaling**: Socket.io adapter is currently in-memory (per `index.ts`). For multi-instance scaling, the Redis Adapter (dependency present but not default) must be configured.
