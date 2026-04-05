# Restaurant Module — Detailed Service Specification

## Overview
The Restaurant module is the largest operational component. It handles dynamic, multi-lingual menus, order lifecycles (with modifiers & discounts), waitlists, and kitchen operations.

## Menu Management (`menu.controller.ts`)

### `POST /api/v1/restaurant/menu/items` & `POST /api/v1/restaurant/categories`
- **Request Payload**: Accepts both `camelCase` and `snake_case` input for flexibility (e.g. `categoryId` or `category_id`). Captures dietary flags (`is_vegetarian`, `is_vegan`, `is_gluten_free`, `is_halal`, `is_dairy_free`, `is_spicy`).
- **Auto-Translation**: When `name` or `description` are provided without explicit Arabic/French counterparts (`name_ar` / `name_fr`), the controller **automagically invokes the `translateText` service** to generate Arabic and French translations on the fly before persisting to the database.
- **Cache Management**: Instantly triggers `invalidateMenuCache()` on mutation.

### `GET /api/v1/restaurant/menu/full`
- **Performance**: High-traffic endpoint used by guests and POS. Attempts to serve from Redis Cache (`getCachedMenuItems`) via the `moduleId` key. If a cache miss occurs, fetches all items, groups them by category in-memory, saves to Redis, and returns the nested structure.

## Order Flow (`order.controller.ts`)

### `POST /api/v1/restaurant/orders`
- **Request Payload**: Items array containing `menuItemId, quantity, notes, selectedModifiers, modifierTotal`. Discount fields like `couponCode` and `loyaltyPointsToRedeem` are also integrated.
- **Business Logic**: 
  - Passes complete modifier data to calculate exact totals.
  - Generates comprehensive `logActivity` event under `order_created`.
- **Security Check**: Accepts authenticated `userId` or defaults to `'Guest'` for unauthorized kiosk/table orders.

### `GET /api/v1/restaurant/orders/:id`
- **Access Control Strategy**: 
  1. The explicit owner (`userId === customer_id`) sees the full order.
  2. Any user with Admin or Staff-like roles (`admin, staff, restaurant_staff, snack_bar_staff, etc`) sees the full order.
  3. **Guest Orders**: Orders lacking a `customer_id` (created anonymously) can be viewed by anyone holding the `order_id` (used for guest receipt screens).
  4. **Unauthorized Fallback**: If a logged-in user requests another user's order, they only receive a stripped status payload: `{ status, created_at, estimated_ready_time }`.

### `PUT /api/v1/restaurant/orders/:id/status`
- Modifies order pipeline state and logs the mutation to the activity stream (`order_status_changed`).

## Status in Browser (Local Simulation)
- Tested Flow: *Pending verification via subagent*
