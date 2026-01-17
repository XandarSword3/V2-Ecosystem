# Admin Module

Super admin dashboard and system management APIs.

## Features

- **Dashboard** - Analytics, KPIs, live monitoring
- **User Management** - CRUD, roles, permissions
- **Module Management** - Enable/disable, configure
- **Settings** - System-wide configuration
- **Audit Logs** - Activity tracking
- **Reports** - Business intelligence

## API Endpoints

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/dashboard` | Dashboard statistics |
| `GET` | `/admin/dashboard/revenue` | Revenue chart data |
| `GET` | `/admin/dashboard/orders` | Order volume data |
| `GET` | `/admin/dashboard/live-users` | Connected users |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/users` | List users |
| `GET` | `/admin/users/:id` | User details |
| `POST` | `/admin/users` | Create user |
| `PUT` | `/admin/users/:id` | Update user |
| `DELETE` | `/admin/users/:id` | Soft delete user |
| `PUT` | `/admin/users/:id/roles` | Update user roles |

### Modules

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/modules` | List all modules |
| `POST` | `/admin/modules` | Create module |
| `PUT` | `/admin/modules/:id` | Update module |
| `DELETE` | `/admin/modules/:id` | Delete module |
| `PUT` | `/admin/modules/:id/toggle` | Enable/disable |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/settings` | Get all settings |
| `PUT` | `/admin/settings` | Update settings |
| `GET` | `/admin/settings/:key` | Get specific setting |

### Audit

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/audit` | List audit entries |
| `GET` | `/admin/audit/:id` | Entry details |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/reports/sales` | Sales report |
| `GET` | `/admin/reports/bookings` | Booking report |
| `GET` | `/admin/reports/users` | User analytics |
| `GET` | `/admin/reports/export` | Export to PDF/Excel |

## Required Permissions

| Action | Permission |
|--------|------------|
| View dashboard | `admin.access` |
| View users | `admin.users.view` |
| Manage users | `admin.users.manage` |
| View modules | `admin.modules.view` |
| Manage modules | `admin.modules.manage` |
| View settings | `admin.settings.view` |
| Manage settings | `admin.settings.manage` |
| View audit | `admin.audit.view` |
| View reports | `admin.reports.view` |

## Dashboard Statistics

```typescript
interface DashboardStats {
  todayRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  ordersToday: number;
  bookingsToday: number;
  activeUsers: number;
  pendingOrders: number;
  revenueChange: number;      // % vs last period
}
```

## Audit Logging

All admin actions are logged:

```typescript
interface AuditEntry {
  id: UUID;
  userId: UUID;
  action: string;             // 'user.create', 'module.update'
  resource: string;           // 'users', 'modules'
  resourceId?: UUID;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}
```

## Settings Schema

```typescript
interface SystemSettings {
  general: {
    siteName: string;
    siteDescription: string;
    timezone: string;
    dateFormat: string;
  };
  branding: {
    logo: string;
    favicon: string;
    primaryColor: string;
    accentColor: string;
  };
  localization: {
    defaultLanguage: 'en' | 'ar' | 'fr';
    supportedLanguages: string[];
    defaultCurrency: string;
  };
  payments: {
    stripeEnabled: boolean;
    stripePublicKey: string;
    // Secret key in env only
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
  };
}
```

## Live Users Tracking

WebSocket-based user tracking:

```typescript
interface LiveUser {
  socketId: string;
  userId?: string;
  email?: string;
  fullName?: string;
  roles: string[];
  currentPath: string;
  connectedAt: Date;
  lastActivity: Date;
}
```

Events:
- `user:connect` - New connection
- `page:navigate` - Page change
- `user:disconnect` - Disconnection

---

See [frontend/src/components/admin](../../frontend/src/components/admin) for dashboard UI.
