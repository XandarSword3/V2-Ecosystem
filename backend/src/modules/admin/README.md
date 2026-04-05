# Admin Module — Detailed Service Specification

## Overview
The Admin module handles multi-tenant, Role-Based Access Control (RBAC) platform supervision, dynamic module activation, and analytics retrieval.

## Dynamic Modules Architecture (`modules.controller.ts`)

The V2 Resort is composed of togglable "Modules" defined in the `modules` database table. The Admin API regulates them.

### `GET /api/v1/admin/modules`
- **Features**: Supports filtering via `?activeOnly=true` and `?showInMain=true`.
- **Sort**: Ascending via `sort_order`. Returns all system features (Restaurants, Chalets, etc).

### `POST /api/v1/admin/modules`
- **Request**: `{ template_type, name, slug, description, settings }`
- **Business Logic**: 
  - Creates the module and enforces a `settings_version: 1` structure.
  - **Dynamic Permission Injection**: Automatically generates CRUD action permissions (`module:{slug}:read`, `module:{slug}:manage`) and upserts them into `app_permissions`.
  - Links permissions to `super_admin` in `app_role_permissions`.
  - **Navbar Integration**: Scans `site_settings` and auto-embeds standard icons (`UtensilsCrossed`, `Waves`, or `Home`) to the CMS navigation array.
  - **Staff Generation**: Auto-provisions generic staff roles (`{slug}_admin` and `{slug}_staff`) and creates a dummy Staff user accounts (`staff.{slug}@v2resort.com`).

### `PUT /api/v1/admin/modules/:id`
- **Request**: `{ ...updates, settings_version (optional) }`
- **Optimistic Concurrency Control**: Checks `settings_version`. If a version collision occurs (another admin saved first), returns a HTTP 409 Conflict.
- **Cache**: Calls `clearModuleCache(slug)` to ensure changes are propagated instantly. Raises `modules.updated` websocket event via Socket.IO.
- **RBAC Check**: Bypasses check if `super_admin`. Otherwise requires `module:{slug}:manage` permission.

### `DELETE /api/v1/admin/modules/:id`
- **Request**: `?force=true` (hard delete) or omitted (soft delete `is_active = false`).
- **Cascade Deletion logic (Force)**: Safely iterates through `menu_items`, `snack_items`, `pool_tickets`, `chalets`, and cleans orphaned `app_permissions` and `role` entries. Also removes the module out of the website's `site_settings` navbar.

## Status in Browser (Local Simulation)
- Tested Flow: *Pending verification via subagent*
