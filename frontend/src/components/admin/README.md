# Admin Dashboard Components

React components for the V2 Resort admin dashboard.

## Overview

The admin module provides comprehensive management interfaces for:

- **Dashboard** - Analytics and KPIs
- **User Management** - CRUD operations on users
- **Module Management** - System module configuration
- **Settings** - System-wide settings
- **Reports** - Business intelligence reports
- **Audit Logs** - Activity tracking

## Component Structure

```
admin/
├── Dashboard/
│   ├── DashboardStats.tsx      # KPI cards grid
│   ├── RevenueChart.tsx        # Revenue over time
│   ├── OrdersChart.tsx         # Order volume
│   ├── PopularItems.tsx        # Best sellers
│   └── LiveUsersPanel.tsx      # Real-time users
├── Users/
│   ├── UserTable.tsx           # User list with actions
│   ├── UserForm.tsx            # Create/edit user
│   ├── UserFilters.tsx         # Search and filter
│   └── RoleAssignment.tsx      # Role management
├── Modules/
│   ├── ModuleGrid.tsx          # Module cards
│   ├── ModuleForm.tsx          # Module configuration
│   └── ModuleBuilder/          # Visual UI builder
├── Settings/
│   ├── GeneralSettings.tsx     # Basic settings
│   ├── ThemeSettings.tsx       # Branding & theme
│   ├── PaymentSettings.tsx     # Stripe config
│   └── NotificationSettings.tsx
├── Reports/
│   ├── SalesReport.tsx         # Sales analytics
│   ├── BookingReport.tsx       # Booking stats
│   └── ExportOptions.tsx       # PDF/Excel export
└── AuditLog/
    ├── AuditTable.tsx          # Activity log
    └── AuditFilters.tsx        # Log filtering
```

## Key Components

### DashboardStats

Displays key performance indicators:

```tsx
<DashboardStats
  stats={{
    totalRevenue: 45000,
    ordersToday: 127,
    activeUsers: 45,
    pendingBookings: 12
  }}
  loading={isLoading}
/>
```

### LiveUsersPanel

Real-time connected user monitoring:

```tsx
<LiveUsersPanel
  users={liveUsers}
  onUserClick={(user) => navigate(`/admin/users/${user.id}`)}
/>
```

Uses Socket.io for live updates.

### UserTable

Full-featured user management table:

```tsx
<UserTable
  users={users}
  onEdit={(user) => openEditModal(user)}
  onDelete={(user) => confirmDelete(user)}
  onRoleChange={(user, roles) => updateRoles(user.id, roles)}
  pagination={{ page: 1, limit: 20, total: 150 }}
/>
```

### ModuleBuilder

Visual drag-and-drop UI builder:

```tsx
<ModuleBuilder
  moduleId={moduleId}
  initialLayout={module.settings?.layout}
  onSave={(layout) => saveModuleLayout(moduleId, layout)}
/>
```

Components:
- `ComponentPalette` - Draggable UI components
- `Canvas` - Drop zone for layout
- `PropertyPanel` - Component configuration
- `PreviewMode` - Live preview

## Data Fetching

Uses React Query for server state:

```tsx
// Fetch dashboard stats
const { data: stats, isLoading } = useQuery({
  queryKey: ['admin', 'dashboard-stats'],
  queryFn: () => adminApi.getDashboardStats()
});

// Fetch users with pagination
const { data: users } = useQuery({
  queryKey: ['admin', 'users', { page, search }],
  queryFn: () => adminApi.getUsers({ page, search })
});
```

## State Management

Local state with React hooks + Zustand for global:

```tsx
// Local component state
const [isEditing, setIsEditing] = useState(false);

// Global settings state
const { currency, theme } = useSettingsStore();
```

## Permissions

Components check user permissions:

```tsx
import { useAuth } from '@/hooks/useAuth';

function UserActions({ user }) {
  const { hasPermission } = useAuth();
  
  if (!hasPermission('admin.users.manage')) {
    return null;
  }
  
  return (
    <button onClick={() => deleteUser(user.id)}>
      Delete
    </button>
  );
}
```

## Styling

Tailwind CSS with dark mode support:

```tsx
<div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
  <h2 className="text-slate-900 dark:text-white font-bold">
    Dashboard
  </h2>
</div>
```

## Responsive Design

Mobile-first with breakpoint utilities:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {stats.map(stat => <StatCard key={stat.id} {...stat} />)}
</div>
```

## Accessibility

ARIA attributes for screen readers:

```tsx
<button
  aria-label="Edit user"
  aria-describedby={`user-${user.id}-name`}
  onClick={() => editUser(user)}
>
  <EditIcon aria-hidden="true" />
</button>
```

---

See individual component files for detailed props and usage examples.
