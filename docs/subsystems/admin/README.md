# Admin Subsystem (`modules/admin`)

## 🎯 Purpose
The **Admin Subsystem** is the command and control center for the V2 Ecosystem. It provides a visual interface (`frontend/src/app/admin`) and secure API endpoints (`backend/src/modules/admin`) for configuring the platform, managing users, and overseeing business operations.

## 📦 Scope
### Explicitly Owns:
*   **User Management**: CRUD on users, Role assignments, Permission overrides.
*   **Module Configuration**: Enabling/Disabling business modules (Restaurant, Pool, etc.).
*   **System Settings**: Global branding, currency, timezones.
*   **Security Auditing**: Viewing `audit_logs` and activity history.
*   **Data Backups**: Triggering and restoring database backups.
*   **Reporting**: Aggregated revenue and occupancy analytics.

### Does NOT Own:
*   **Business Logic**: It delegates restaurant logic to `modules/restaurant`, pool logic to `modules/pool`. It only *displays* their data or *configures* their visibility.
*   **Authentication**: Handled by `modules/auth`.

## 🚪 Entry Points

### API Surface (`backend/src/modules/admin/admin.routes.ts`)
*   `GET /modules`: List available/active business modules.
*   `POST /users`: Create new staff/admin accounts.
*   `GET /audit-logs`: Security trail.
*   `POST /backups`: Disaster recovery triggers.
*   `GET /dashboard`: Aggregated stats (revenue, active users).

### Frontend Interface (`frontend/src/app/admin`)
*   `/admin`: Main Dashboard (Charts & Widgets).
*   `/admin/users`: User grid with Role editor.
*   `/admin/settings`: Branding & Configuration forms.
*   `/admin/[module]`: Dynamic routes for enabled modules (e.g., `/admin/restaurant`).

## 🏗️ Internal Architecture

### Backend
*   **Monolithic Controller Pattern**: Historically `admin.controller.ts` was huge. Use `controllers/*` (e.g., `users.controller.ts`, `audit.controller.ts`) for new logic.
*   **RBAC Middleware**: Heavy use of `authorize('super_admin')` vs `authorize('restaurant_manager')`.
*   **Strict Validation**: All inputs validated via Zod schemas in `admin.validation.ts`.

### Frontend
*   **Dynamic Navigation**: `AdminLayout` (`layout.tsx`) reads `useSiteSettings()` to generate the sidebar based on *active modules*. It does not hardcode links for disabled features.
*   **CMS-lite Capabilities**: Allows uploading branding assets (Logo, Colors) which are injected into the context.

## 🔄 Data Flow (Example: Promoting a User)
1.  **Admin Action**: UI triggers `PUT /api/admin/users/:id/roles`.
2.  **Security Check**: Backend `authorize('super_admin')` verifies requestor.
3.  **Logic**: `usersController.updateUserRoles` calls `UserService`.
4.  **Audit**: `ActivityLogger` records "ROLE_CHANGE" event.
5.  **State Update**: Target user's refresh token is actively revoked (force logout) to apply new permissions immediately.

## 🛡️ Security Considerations
*   **Super Admin Root**: This subsystem contains the keys to the kingdom. Access must be strictly `super_admin`.
*   **Sensitive Data**: Exposes PII (User emails, phone numbers).
*   **Destructive Actions**: Can delete modules, restore backups (data loss risk). protected by `rateLimits.expensive`.

## ⚠️ Known Debt / Weaknesses
*   **Controller Bloat**: Some core logic still resides in legacy `admin.controller.ts` instead of split files.
*   **Frontend Performance**: The `AdminLayout` fetches *all* settings and modules on mount, which can be slow on high-latency networks.
