# Admin Guide: User Management

> Module: ADM-USR | Features: 22 | Role: super_admin | Updated: 2026-02-08

## Overview

The User Management module provides complete control over all user accounts in the V2 Resort ecosystem. Administrators can create, modify, deactivate, and monitor user accounts across all roles. This module is the central authority for access control, authentication oversight, and user lifecycle management.

All user data is stored in Supabase PostgreSQL (`users`, `user_roles`, `user_sessions`, `activity_logs` tables). Authentication flows through Supabase Auth with JWT tokens. The Express.js backend (localhost:3005) handles role-based middleware enforcement, while the Next.js 14 frontend (localhost:3000) renders the admin UI.

## Prerequisites

| Requirement | Details |
|---|---|
| Admin Access | Login at `/admin/login` with `admin@v2resort.com` / `admin123` |
| Role Required | `super_admin` or `admin` (some features restricted to `super_admin`) |
| Browser | Chrome 90+, Firefox 88+, Edge 90+ |
| Backend Running | Express.js API on `localhost:3005` |
| Frontend Running | Next.js 14 dev server on `localhost:3000` |
| Database | Supabase PostgreSQL with `users` table populated |

## Features Covered

| # | Feature ID | Feature Name | Description | Status |
|---|---|---|---|---|
| 1 | USR-001 | User List View | Paginated list of all users with search and filters | ✅ Implemented |
| 2 | USR-002 | Create User | Create new user account with role assignment | ✅ Implemented |
| 3 | USR-003 | Edit User | Update user profile, contact details, and metadata | ✅ Implemented |
| 4 | USR-004 | Delete User | Soft-delete user account with cascade handling | ✅ Implemented |
| 5 | USR-005 | Role Assignment | Assign/change user role (customer/staff/manager/admin) | ✅ Implemented |
| 6 | USR-006 | Deactivate Account | Temporarily disable user access without deletion | ✅ Implemented |
| 7 | USR-007 | Reactivate Account | Restore access to previously deactivated accounts | ✅ Implemented |
| 8 | USR-008 | Activity Log | View timestamped log of user actions across the system | ✅ Implemented |
| 9 | USR-009 | Password Reset | Force password reset via email link | ✅ Implemented |
| 10 | USR-010 | Force Logout | Terminate all active sessions for a specific user | ✅ Implemented |
| 11 | USR-011 | Bulk Select | Select multiple users via checkboxes for batch ops | ✅ Implemented |
| 12 | USR-012 | Bulk Deactivate | Deactivate multiple selected users at once | ✅ Implemented |
| 13 | USR-013 | Bulk Role Change | Change role for multiple selected users | ✅ Implemented |
| 14 | USR-014 | Bulk Delete | Soft-delete multiple selected users | ✅ Implemented |
| 15 | USR-015 | CSV Export | Export filtered user list to CSV file | ✅ Implemented |
| 16 | USR-016 | User Statistics | Dashboard cards showing total, active, new, deactivated counts | ✅ Implemented |
| 17 | USR-017 | 2FA Admin Toggle | Enable/disable two-factor authentication for any user | ✅ Implemented |
| 18 | USR-018 | 2FA Reset | Reset 2FA secrets and recovery codes for locked-out users | ✅ Implemented |
| 19 | USR-019 | Impersonate User | Log in as another user for debugging (audit-logged) | ✅ Implemented |
| 20 | USR-020 | Login History | View login timestamps, IP addresses, and device info | ✅ Implemented |
| 21 | USR-021 | Search & Filter | Search by name/email, filter by role/status/date range | ✅ Implemented |
| 22 | USR-022 | Sort Columns | Sort user list by any column (name, email, role, created, last login) | ✅ Implemented |

## Dashboard Overview

**URL:** `http://localhost:3000/admin/users`

**API Base:** `http://localhost:3005/api/admin/users`

### Key Metrics (Top Cards)

| Metric | Description | API Endpoint |
|---|---|---|
| Total Users | Count of all registered accounts | `GET /api/admin/users/stats` |
| Active Users | Users with `status = 'active'` | `GET /api/admin/users/stats` |
| New This Month | Users created in current calendar month | `GET /api/admin/users/stats` |
| Deactivated | Users with `status = 'deactivated'` | `GET /api/admin/users/stats` |

### Quick Actions

- **+ Create User** button (top-right) → Opens create user modal
- **Export CSV** button → Downloads current filtered list
- **Bulk Actions** dropdown → Appears when 1+ users are selected via checkboxes

## CRUD Operations

### Create User

**URL:** Click **+ Create User** on `/admin/users` or navigate to `/admin/users/create`

**API:** `POST /api/admin/users`

**Steps:**
1. Click the **+ Create User** button in the top-right corner
2. Fill in the required fields in the modal/form:

| Field | Type | Validation | Required |
|---|---|---|---|
| `first_name` | Text input | 1–50 characters, letters/hyphens/spaces only | ✅ |
| `last_name` | Text input | 1–50 characters, letters/hyphens/spaces only | ✅ |
| `email` | Email input | Valid email format, must be unique in system | ✅ |
| `phone` | Tel input | E.164 format (e.g., +44 7700 900000) | ❌ |
| `role` | Select dropdown | One of: `customer`, `staff`, `manager`, `admin` | ✅ |
| `password` | Password input | Min 8 chars, 1 uppercase, 1 number, 1 special char | ✅ |
| `confirm_password` | Password input | Must match `password` field exactly | ✅ |
| `send_welcome_email` | Checkbox | Sends credentials and onboarding email | ❌ |

3. Click **Create User** to submit
4. On success: toast notification "User created successfully", redirects to user list
5. On error: inline validation messages appear under each invalid field

**Request Body Example:**
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "email": "john.smith@example.com",
  "phone": "+447700900123",
  "role": "staff",
  "password": "SecureP@ss1",
  "send_welcome_email": true
}
```

### Read / List Users

**URL:** `/admin/users`

**API:** `GET /api/admin/users?page=1&limit=25&search=&role=&status=&sort=created_at&order=desc`

**Steps:**
1. Navigate to `/admin/users` — the user table loads automatically
2. Use the **Search** bar to filter by name or email (debounced, 300ms)
3. Use **Role** dropdown filter: All / Customer / Staff / Manager / Admin
4. Use **Status** dropdown filter: All / Active / Deactivated
5. Use **Date Range** picker to filter by account creation date
6. Click any column header to sort (toggles asc/desc)
7. Pagination controls at bottom: Previous / Page numbers / Next

**Table Columns:**
| Column | Sortable | Description |
|---|---|---|
| Checkbox | — | Bulk selection |
| Avatar | — | User profile image or initials |
| Name | ✅ | `first_name` + `last_name` |
| Email | ✅ | Account email address |
| Role | ✅ | Badge showing role (color-coded) |
| Status | ✅ | Green "Active" or Red "Deactivated" |
| Last Login | ✅ | Relative time (e.g., "2 hours ago") |
| Created | ✅ | Account creation date |
| Actions | — | Edit / Deactivate / Delete / More menu |

### Update User

**URL:** `/admin/users/:id/edit`

**API:** `PUT /api/admin/users/:id`

**Steps:**
1. Click the **Edit** (pencil icon) button on any user row, or click the user's name to open their profile, then click **Edit**
2. Modify any fields — same validation rules as Create
3. **Role changes** require confirmation modal: "Are you sure you want to change {name}'s role from {old} to {new}?"
4. Click **Save Changes**
5. On success: toast "User updated successfully"
6. Changes to `email` trigger a verification email to the new address
7. Changes to `role` take effect immediately on next API request (JWT re-issued)

### Delete User

**URL:** Action button on user row or `/admin/users/:id`

**API:** `DELETE /api/admin/users/:id`

**Steps:**
1. Click the **Delete** button (trash icon) on a user row, or open user profile → **Delete User**
2. Confirmation modal appears: "Are you sure you want to delete {name}? This action will:"
   - Soft-delete the user record (`deleted_at` timestamp set)
   - Cancel all active bookings for this user
   - Revoke all active sessions
   - Retain data for 90 days before permanent deletion
3. Type the user's email to confirm
4. Click **Delete Permanently**
5. On success: toast "User deleted", user removed from list

**Cascade Effects:**
- Active bookings → status changed to `cancelled_admin`
- Loyalty points → frozen, not deleted
- Active sessions → terminated immediately
- Gift card balances → retained (linked to card, not user)

## Configuration Settings

| Setting | Location | Default | Description |
|---|---|---|---|
| `users.default_role` | `/admin/settings/users` | `customer` | Default role for new registrations |
| `users.require_email_verification` | `/admin/settings/users` | `true` | Require email verification on signup |
| `users.password_min_length` | `/admin/settings/users` | `8` | Minimum password length |
| `users.password_require_special` | `/admin/settings/users` | `true` | Require special character in passwords |
| `users.session_timeout_minutes` | `/admin/settings/users` | `480` | Auto-logout after inactivity (minutes) |
| `users.max_login_attempts` | `/admin/settings/users` | `5` | Account locks after N failed attempts |
| `users.lockout_duration_minutes` | `/admin/settings/users` | `30` | Lockout duration after max attempts |
| `users.allow_impersonation` | `/admin/settings/users` | `true` | Enable admin impersonation feature |
| `users.2fa_default_enabled` | `/admin/settings/users` | `false` | Require 2FA for all new accounts |
| `users.csv_export_limit` | `/admin/settings/users` | `10000` | Max rows per CSV export |

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| "Email already exists" on create | Duplicate email in `users` table | Search for existing user — may be soft-deleted. Restore or use different email |
| User cannot log in after role change | JWT token still has old role cached | Force logout the user via **Force Logout** button to invalidate cached tokens |
| CSV export downloads empty file | No users match current filters | Clear all filters and try again, or check browser console for API errors |
| Impersonate shows "Unauthorized" | `users.allow_impersonation` setting is `false` | Enable in Settings → Users → Allow Impersonation |
| Bulk actions not appearing | No users selected via checkboxes | Select at least one user using the row checkboxes |
| Activity log shows no entries | User is newly created | Activity logs populate after the user performs actions in the system |
| 2FA reset fails | User's TOTP secret is corrupted | Use **2FA Reset** which regenerates the secret and recovery codes |
| Password reset email not received | Email service misconfigured or spam folder | Check Supabase Auth email settings; verify SMTP configuration |
| "Cannot delete admin user" error | System prevents deleting the last admin | Ensure at least 2 admin accounts exist before deleting one |
| Login history shows wrong IP | Load balancer/proxy not forwarding headers | Verify `X-Forwarded-For` header is set in nginx/proxy config |

## Security & Permissions

| Action | super_admin | admin | manager | staff | customer |
|---|---|---|---|---|---|
| View user list | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create user | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit any user | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete user | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign admin role | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign staff/manager role | ✅ | ✅ | ❌ | ❌ | ❌ |
| Force logout | ✅ | ✅ | ❌ | ❌ | ❌ |
| Impersonate user | ✅ | ❌ | ❌ | ❌ | ❌ |
| View activity log | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export CSV | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage 2FA | ✅ | ✅ | ❌ | ❌ | ❌ |
| View login history | ✅ | ✅ | ❌ | ❌ | ❌ |
| Bulk operations | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change settings | ✅ | ❌ | ❌ | ❌ | ❌ |

**Audit Trail:** All admin actions on user accounts are logged to `admin_audit_log` with `actor_id`, `target_user_id`, `action`, `details`, `ip_address`, and `timestamp`. Logs are immutable — no delete endpoint exists.

## Related Modules

| Module | Relationship | Link |
|---|---|---|
| Loyalty Management | Users earn/redeem loyalty points; tier status linked to user | [loyalty-management.md](./loyalty-management.md) |
| Gift Cards | Users purchase and redeem gift cards; balance linked to card | [gift-cards.md](./gift-cards.md) |
| Restaurant Management | Staff users manage orders/tables; customers place orders | [restaurant-management.md](./restaurant-management.md) |
| Housekeeping | Staff users are assigned housekeeping tasks | [housekeeping.md](./housekeeping.md) |
| Bookings | Customer users create bookings; admin can manage all | System bookings module |
| Notifications | User preferences control notification delivery | System notifications module |

## Feature Coverage Summary

| Category | Total Features | Implemented | Partial | Not Started |
|---|---|---|---|---|
| CRUD Operations | 4 | 4 | 0 | 0 |
| Role Management | 1 | 1 | 0 | 0 |
| Account Status | 2 | 2 | 0 | 0 |
| Monitoring & Logs | 3 | 3 | 0 | 0 |
| Security Actions | 3 | 3 | 0 | 0 |
| Bulk Operations | 4 | 4 | 0 | 0 |
| Data Export | 1 | 1 | 0 | 0 |
| Search & Sort | 2 | 2 | 0 | 0 |
| Statistics | 1 | 1 | 0 | 0 |
| Impersonation | 1 | 1 | 0 | 0 |
| **Total** | **22** | **22** | **0** | **0** |
