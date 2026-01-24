# Verification Checklist: Security & Module Hardening

## 1. Dynamic Permissions System (`app_permissions`)

- [ ] **Schema Verification**
  - [ ] Table `app_permissions` exists with columns: `slug` (PK), `description`, `module_slug`, `created_at`.
  - [ ] Table `app_role_permissions` exists with columns: `role_name`, `permission_slug`.
  - [ ] Foreign Key `app_role_permissions.permission_slug` references `app_permissions.slug` (ON DELETE CASCADE).
  - [ ] Index `idx_app_role_permissions_role` exists.

- [ ] **Runtime Behavior**
  - [ ] `getAllPermissions` (Admin API) returns data from `app_permissions`.
  - [ ] `getRolePermissions` returns slugs for a given role ID (resolving role name).
  - [ ] `updateRolePermissions` correctly clears and re-inserts `app_role_permissions`.
  - [ ] Middleware `requirePermission('slug')` correctly denies access if permission is missing.
  - [ ] Middleware `requirePermission('slug')` grants access if user has role with permission.

## 2. Module Builder Hardening

- [ ] **Module Creation**
  - [ ] Creates module record with `settings_version: 1`.
  - [ ] Validates `settings` JSON against Zod schema (future TODO, currently just object check).
  - [ ] Auto-generates permissions in `app_permissions` (e.g., `module:xyz:manage`).
  - [ ] Auto-assigns new permissions to `super_admin` in `app_role_permissions`.
  - [ ] Auto-creates standard roles (`xyz_admin`, `xyz_staff`).
  - [ ] Auto-links `xyz_admin` role to `module:xyz:manage` in `app_role_permissions`.

- [ ] **Module Updates (RBAC & Concurrency)**
  - [ ] **RBAC**: Attempting to update a module without `super_admin` or `module:xyz:manage` permission returns 403.
  - [ ] **Optimistic Locking**: Sending `settings_version` in payload checks against DB.
    - [ ] If match: Update succeeds, version increments.
    - [ ] If mismatch: Returns 409 Conflict.
  - [ ] **Cache Invalid**: Module cache is cleared after update.

- [ ] **Module Deletion**
  - [ ] Deleting a module cascades deletes to `app_permissions` (and thus `app_role_permissions`).

## 3. Deployment & Migration

- [ ] **Legacy Cleanup (TODO)**
  - The following files still reference legacy `permissions` table and need refactoring:
    - `backend/src/modules/admin/services/role.service.ts`
    - `backend/src/modules/admin/controllers/roles.controller.ts`
    - `backend/src/modules/admin/admin.controller.ts`
  - [ ] Legacy `permissions`, `role_permissions` tables can be dropped once all above are refactored.

## 4. Static Analysis Results

**Remaining Legacy References found via grep:**
- `role.service.ts`: Uses `from('permissions')` and `from('role_permissions')`.
- `roles.controller.ts`: Uses `from('role_permissions')`.
- `admin.controller.ts`: Uses `from('role_permissions')`.

**Action Item:**
- Prioritize refactoring `role.service.ts` as it likely handles role management logic used by the frontend.
