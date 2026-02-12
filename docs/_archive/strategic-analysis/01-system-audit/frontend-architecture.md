# Frontend Architecture Documentation
## V2 Hospitality Platform - Complete Frontend Reference

**Framework:** Next.js 14.2.35  
**Language:** TypeScript  
**Styling:** Tailwind CSS + shadcn/ui  
**State Management:** React Context + React Query  
**Total Pages:** 105+  
**Last Analyzed:** February 2026

---

# ARCHITECTURE OVERVIEW

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Components | shadcn/ui + Radix UI | Latest |
| State | React Context + React Query | v5 |
| Forms | React Hook Form + Zod | Latest |
| Charts | Recharts | 2.x |
| Maps | Leaflet / Google Maps | Latest |
| HTTP Client | Axios | 1.x |
| Auth | Supabase Auth | Latest |
| Icons | Lucide Icons | Latest |

## Project Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   │
│   ├── (public)/                 # Public route group
│   │   ├── page.tsx              # Landing page
│   │   ├── chalets/
│   │   ├── pool/
│   │   ├── restaurant/
│   │   └── about/
│   │
│   ├── (customer)/               # Customer portal
│   │   ├── dashboard/
│   │   ├── bookings/
│   │   ├── orders/
│   │   ├── loyalty/
│   │   ├── profile/
│   │   └── settings/
│   │
│   ├── (staff)/                  # Staff portal
│   │   ├── dashboard/
│   │   ├── pos/
│   │   ├── orders/
│   │   ├── tables/
│   │   ├── kitchen/
│   │   ├── shifts/
│   │   └── tasks/
│   │
│   ├── (admin)/                  # Admin portal
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── roles/
│   │   ├── chalets/
│   │   ├── pool/
│   │   ├── restaurant/
│   │   ├── inventory/
│   │   ├── reports/
│   │   ├── settings/
│   │   └── white-label/
│   │
│   ├── api/                      # API routes (BFF)
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── forms/                    # Form components
│   ├── layout/                   # Layout components
│   ├── modules/                  # Feature modules
│   └── shared/                   # Shared components
│
├── contexts/                     # React contexts
├── hooks/                        # Custom hooks
├── lib/                          # Utilities & config
├── services/                     # API services
├── store/                        # State management
├── types/                        # TypeScript types
└── public/                       # Static assets
```

---

# PAGE INVENTORY

## Authentication Pages (6)

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Email/password + social login |
| Register | `/register` | Customer registration |
| Forgot Password | `/forgot-password` | Password reset request |
| Reset Password | `/reset-password` | Password reset form |
| Verify Email | `/verify-email` | Email verification |
| 2FA Setup | `/2fa-setup` | Two-factor auth configuration |

## Public Pages (12)

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Homepage with hero, features |
| Chalets List | `/chalets` | Accommodation browsing |
| Chalet Detail | `/chalets/[id]` | Individual chalet page |
| Booking Form | `/chalets/[id]/book` | Booking flow |
| Pool Sessions | `/pool` | Pool session listing |
| Pool Booking | `/pool/book` | Pool ticket purchase |
| Restaurant Menu | `/restaurant` | Digital menu |
| Restaurant Order | `/restaurant/order` | Online ordering |
| Table Reservation | `/restaurant/reserve` | Table booking |
| About Us | `/about` | Company information |
| Contact | `/contact` | Contact form |
| Privacy Policy | `/privacy` | Legal pages |

## Customer Portal (15)

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard` | Customer overview |
| My Bookings | `/bookings` | Booking history |
| Booking Detail | `/bookings/[id]` | Individual booking |
| My Orders | `/orders` | Order history |
| Order Detail | `/orders/[id]` | Order details |
| My Tickets | `/tickets` | Pool tickets |
| Loyalty Program | `/loyalty` | Points & rewards |
| Rewards Catalog | `/loyalty/rewards` | Redeemable rewards |
| Gift Cards | `/gift-cards` | Purchase gift cards |
| My Gift Cards | `/gift-cards/my` | Gift card wallet |
| Profile | `/profile` | Account settings |
| Security | `/profile/security` | Password, 2FA |
| Payment Methods | `/profile/payments` | Saved cards |
| Preferences | `/profile/preferences` | Notifications, etc. |
| Reviews | `/reviews/my` | My submitted reviews |

## Staff Portal (25)

### POS & Sales

| Page | Route | Description |
|------|-------|-------------|
| Staff Dashboard | `/staff/dashboard` | Daily overview |
| POS Terminal | `/staff/pos` | Point of sale interface |
| Quick Order | `/staff/pos/quick` | Fast order entry |
| Table Management | `/staff/tables` | Floor plan & status |
| Table Detail | `/staff/tables/[id]` | Table orders/tabs |
| Order List | `/staff/orders` | Active orders |
| Order Detail | `/staff/orders/[id]` | Order management |
| Kitchen Display | `/staff/kitchen` | KDS interface |
| Tabs | `/staff/tabs` | Open tabs management |
| Waitlist | `/staff/waitlist` | Queue management |

### Operations

| Page | Route | Description |
|------|-------|-------------|
| Reservations | `/staff/reservations` | Table bookings |
| Chalet Calendar | `/staff/chalets` | Booking calendar |
| Check-In | `/staff/check-in` | Guest check-in |
| Pool Validation | `/staff/pool/validate` | Ticket scanning |
| Pool Dashboard | `/staff/pool` | Session overview |
| Inventory Check | `/staff/inventory` | Stock levels |
| Stock Count | `/staff/inventory/count` | Physical count |
| Tasks | `/staff/tasks` | Assigned tasks |
| Task Detail | `/staff/tasks/[id]` | Task completion |
| My Shifts | `/staff/shifts` | Personal schedule |
| Clock In/Out | `/staff/clock` | Time tracking |
| Reports | `/staff/reports` | Shift reports |
| Cash Drawer | `/staff/drawer` | Cash management |
| End of Day | `/staff/eod` | Daily closeout |
| Help | `/staff/help` | Training resources |

## Admin Portal (47)

### Dashboard & Analytics

| Page | Route | Description |
|------|-------|-------------|
| Admin Dashboard | `/admin/dashboard` | KPI overview |
| Revenue Analytics | `/admin/analytics/revenue` | Financial reports |
| Occupancy Analytics | `/admin/analytics/occupancy` | Accommodation stats |
| Restaurant Analytics | `/admin/analytics/restaurant` | F&B reports |
| Pool Analytics | `/admin/analytics/pool` | Facility usage |
| Customer Analytics | `/admin/analytics/customers` | Guest insights |
| Staff Analytics | `/admin/analytics/staff` | Performance data |

### User Management

| Page | Route | Description |
|------|-------|-------------|
| Users List | `/admin/users` | All users |
| User Detail | `/admin/users/[id]` | User profile |
| Create User | `/admin/users/new` | Add user |
| Roles | `/admin/roles` | Role management |
| Role Detail | `/admin/roles/[id]` | Permissions |
| Permissions | `/admin/permissions` | Permission list |
| Audit Log | `/admin/audit-log` | Activity history |

### Accommodation Management

| Page | Route | Description |
|------|-------|-------------|
| Chalets List | `/admin/chalets` | Manage units |
| Chalet Detail | `/admin/chalets/[id]` | Edit chalet |
| Create Chalet | `/admin/chalets/new` | Add chalet |
| Booking Calendar | `/admin/chalets/calendar` | Visual calendar |
| All Bookings | `/admin/chalets/bookings` | Reservation list |
| Cancellation Policies | `/admin/chalets/policies` | Configure policies |
| Seasonal Pricing | `/admin/chalets/pricing` | Dynamic pricing |

### Pool Management

| Page | Route | Description |
|------|-------|-------------|
| Pool Sessions | `/admin/pool/sessions` | Session config |
| Session Detail | `/admin/pool/sessions/[id]` | Edit session |
| Memberships | `/admin/pool/memberships` | Membership plans |
| All Tickets | `/admin/pool/tickets` | Ticket history |
| Pool Settings | `/admin/pool/settings` | Module config |

### Restaurant Management

| Page | Route | Description |
|------|-------|-------------|
| Menu Categories | `/admin/restaurant/categories` | Category list |
| Menu Items | `/admin/restaurant/menu` | All menu items |
| Menu Item Detail | `/admin/restaurant/menu/[id]` | Edit item |
| Modifier Groups | `/admin/restaurant/modifiers` | Customizations |
| Tables Config | `/admin/restaurant/tables` | Table setup |
| Floor Plan Editor | `/admin/restaurant/floor-plan` | Visual editor |
| All Orders | `/admin/restaurant/orders` | Order history |
| All Reservations | `/admin/restaurant/reservations` | Booking list |

### Inventory Management

| Page | Route | Description |
|------|-------|-------------|
| Inventory Items | `/admin/inventory` | Stock items |
| Item Detail | `/admin/inventory/[id]` | Edit item |
| Categories | `/admin/inventory/categories` | Organization |
| Suppliers | `/admin/inventory/suppliers` | Vendor list |
| Purchase Orders | `/admin/inventory/purchase-orders` | PO management |
| PO Detail | `/admin/inventory/purchase-orders/[id]` | Edit PO |
| Recipes | `/admin/inventory/recipes` | Recipe costing |
| Low Stock Alerts | `/admin/inventory/alerts` | Reorder list |

### Promotions & Loyalty

| Page | Route | Description |
|------|-------|-------------|
| Coupons | `/admin/promotions/coupons` | Coupon codes |
| Gift Cards | `/admin/promotions/gift-cards` | Gift card inventory |
| Loyalty Tiers | `/admin/loyalty/tiers` | Tier configuration |
| Loyalty Members | `/admin/loyalty/members` | Member profiles |
| Rewards Catalog | `/admin/loyalty/rewards` | Redeemable items |

### Staff Management

| Page | Route | Description |
|------|-------|-------------|
| Staff List | `/admin/staff` | Employee list |
| Shift Schedule | `/admin/staff/schedule` | Visual scheduler |
| Shift Templates | `/admin/staff/templates` | Recurring patterns |
| Time Tracking | `/admin/staff/timesheet` | Hours worked |
| Swap Requests | `/admin/staff/swaps` | Pending swaps |

### Housekeeping

| Page | Route | Description |
|------|-------|-------------|
| All Tasks | `/admin/housekeeping` | Task overview |
| Task Types | `/admin/housekeeping/types` | Task configuration |
| SLA Settings | `/admin/housekeeping/sla` | Response times |
| Assignments | `/admin/housekeeping/assignments` | Staff assignment |

### Reviews & Content

| Page | Route | Description |
|------|-------|-------------|
| Reviews | `/admin/reviews` | Moderate reviews |
| Review Detail | `/admin/reviews/[id]` | Respond to review |

### Settings & Configuration

| Page | Route | Description |
|------|-------|-------------|
| General Settings | `/admin/settings` | System config |
| Branding | `/admin/settings/branding` | Theme, logo |
| White Label | `/admin/settings/white-label` | Full customization |
| Modules | `/admin/settings/modules` | Feature toggles |
| Integrations | `/admin/settings/integrations` | Third-party |
| Email Templates | `/admin/settings/emails` | Notifications |
| Payment Config | `/admin/settings/payments` | Stripe setup |
| Tax Settings | `/admin/settings/tax` | Tax configuration |
| Webhooks | `/admin/settings/webhooks` | API callbacks |

---

# COMPONENT LIBRARY

## UI Components (shadcn/ui)

```
components/ui/
├── accordion.tsx
├── alert.tsx
├── alert-dialog.tsx
├── avatar.tsx
├── badge.tsx
├── breadcrumb.tsx
├── button.tsx
├── calendar.tsx
├── card.tsx
├── carousel.tsx
├── checkbox.tsx
├── collapsible.tsx
├── command.tsx
├── context-menu.tsx
├── data-table.tsx
├── date-picker.tsx
├── dialog.tsx
├── dropdown-menu.tsx
├── form.tsx
├── hover-card.tsx
├── input.tsx
├── label.tsx
├── menubar.tsx
├── navigation-menu.tsx
├── pagination.tsx
├── popover.tsx
├── progress.tsx
├── radio-group.tsx
├── scroll-area.tsx
├── select.tsx
├── separator.tsx
├── sheet.tsx
├── skeleton.tsx
├── slider.tsx
├── sonner.tsx (toasts)
├── switch.tsx
├── table.tsx
├── tabs.tsx
├── textarea.tsx
├── toast.tsx
├── toggle.tsx
├── toggle-group.tsx
└── tooltip.tsx
```

## Custom Components

### Layout Components

```typescript
// components/layout/
├── Header.tsx           // Main navigation header
├── Footer.tsx           // Site footer
├── Sidebar.tsx          // Admin/staff sidebar
├── MobileNav.tsx        // Mobile navigation drawer
├── Breadcrumbs.tsx      // Navigation breadcrumbs
├── PageHeader.tsx       // Page title + actions
└── ThemeProvider.tsx    // Theme context
```

### Form Components

```typescript
// components/forms/
├── FormField.tsx        // Labeled form field wrapper
├── ImageUpload.tsx      // Image upload with preview
├── RichTextEditor.tsx   // WYSIWYG editor
├── DateRangePicker.tsx  // Date range selection
├── TimeSlotPicker.tsx   // Time slot grid
├── ColorPicker.tsx      // Color selection
├── CurrencyInput.tsx    // Formatted currency input
├── PhoneInput.tsx       // International phone input
└── SearchSelect.tsx     // Searchable dropdown
```

### Module Components

```typescript
// components/modules/

// Bookings
├── BookingCard.tsx
├── BookingCalendar.tsx
├── BookingForm.tsx
├── BookingTimeline.tsx
├── AvailabilityGrid.tsx

// Restaurant
├── MenuItemCard.tsx
├── OrderSummary.tsx
├── TableCard.tsx
├── FloorPlanEditor.tsx
├── KitchenTicket.tsx
├── ReceiptPrint.tsx

// Pool
├── SessionCard.tsx
├── TicketQRCode.tsx
├── CapacityIndicator.tsx

// Inventory
├── StockLevel.tsx
├── LowStockAlert.tsx
├── POLineItem.tsx

// Loyalty
├── TierBadge.tsx
├── PointsBalance.tsx
├── RewardCard.tsx

// Analytics
├── RevenueChart.tsx
├── OccupancyChart.tsx
├── TopItemsChart.tsx
├── KPICard.tsx
├── StatCard.tsx
```

### Shared Components

```typescript
// components/shared/
├── LoadingSpinner.tsx
├── ErrorBoundary.tsx
├── EmptyState.tsx
├── ConfirmDialog.tsx
├── StatusBadge.tsx
├── UserAvatar.tsx
├── PriceDisplay.tsx
├── DataTable.tsx       // Advanced table with sorting/filtering
├── Pagination.tsx
├── SearchBar.tsx
├── FilterPanel.tsx
├── ExportButton.tsx
├── PrintButton.tsx
└── NotificationBell.tsx
```

---

# STATE MANAGEMENT

## Context Architecture

```typescript
// contexts/
├── AuthContext.tsx      // User authentication state
├── ThemeContext.tsx     // Theme/branding state
├── CartContext.tsx      // Shopping cart state
├── NotificationContext.tsx // In-app notifications
└── ModuleContext.tsx    // Enabled modules
```

### AuthContext

```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  roles: string[];
  permissions: string[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}
```

### ThemeContext

```typescript
interface ThemeContextType {
  theme: Theme;
  branding: BrandingConfig;
  isDark: boolean;
  toggleDark: () => void;
  updateBranding: (config: Partial<BrandingConfig>) => void;
}

interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logo: string;
  favicon: string;
  companyName: string;
  fontFamily: string;
}
```

## React Query Integration

```typescript
// hooks/queries/
├── useUser.ts
├── useChalets.ts
├── useBookings.ts
├── useMenuItems.ts
├── useOrders.ts
├── useInventory.ts
├── useLoyalty.ts
├── useAnalytics.ts
└── useNotifications.ts
```

### Query Configuration

```typescript
// lib/react-query.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000,   // 30 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});
```

---

# API INTEGRATION

## Service Layer

```typescript
// services/
├── api.ts              // Axios instance
├── auth.service.ts     // Authentication
├── user.service.ts     // User management
├── chalet.service.ts   // Accommodations
├── booking.service.ts  // Reservations
├── pool.service.ts     // Pool facilities
├── restaurant.service.ts // Restaurant ops
├── inventory.service.ts // Stock management
├── loyalty.service.ts  // Loyalty program
├── payment.service.ts  // Payments
├── notification.service.ts // Notifications
└── analytics.service.ts // Reporting
```

### API Client Configuration

```typescript
// services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try token refresh
      await refreshToken();
      return api(error.config);
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

# ROUTING & NAVIGATION

## Protected Routes

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token');

  // Protected routes
  const protectedRoutes = ['/dashboard', '/admin', '/staff'];
  const isProtected = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based access
  if (pathname.startsWith('/admin')) {
    // Verify admin role
  }

  if (pathname.startsWith('/staff')) {
    // Verify staff role
  }

  return NextResponse.next();
}
```

## Navigation Configuration

```typescript
// Navigation structure for admin sidebar
const adminNavigation = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
    children: [
      { title: 'All Users', href: '/admin/users' },
      { title: 'Roles', href: '/admin/roles' },
    ],
  },
  {
    title: 'Accommodations',
    href: '/admin/chalets',
    icon: Home,
    children: [
      { title: 'Chalets', href: '/admin/chalets' },
      { title: 'Bookings', href: '/admin/chalets/bookings' },
      { title: 'Pricing', href: '/admin/chalets/pricing' },
    ],
  },
  // ... more navigation items
];
```

---

# RESPONSIVE DESIGN

## Breakpoints

```css
/* Tailwind default breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Wide screens */
```

## Mobile-First Patterns

```tsx
// Example responsive component
export function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 w-full bg-white shadow-sm z-50">
        <MobileHeader />
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:flex lg:w-64 lg:flex-col">
        <Sidebar />
      </aside>

      {/* Main content */}
      <main className="pt-16 lg:pt-0 lg:pl-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
```

---

# WHITE-LABEL ARCHITECTURE

## Theme Customization System

```typescript
// lib/theme.ts
export interface WhiteLabelConfig {
  // Brand Colors
  colors: {
    primary: string;
    primaryHover: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    border: string;
  };

  // Typography
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };

  // Assets
  assets: {
    logo: string;
    logoDark: string;
    favicon: string;
    ogImage: string;
  };

  // Content
  content: {
    companyName: string;
    tagline: string;
    supportEmail: string;
    supportPhone: string;
  };

  // Features
  features: {
    showPoweredBy: boolean;
    customCSS: string;
    customJS: string;
  };
}
```

## Dynamic CSS Variables

```css
/* globals.css */
:root {
  --primary: var(--theme-primary, 222.2 47.4% 11.2%);
  --primary-foreground: var(--theme-primary-foreground, 210 40% 98%);
  --secondary: var(--theme-secondary, 210 40% 96.1%);
  --accent: var(--theme-accent, 210 40% 96.1%);
  --background: var(--theme-background, 0 0% 100%);
  --foreground: var(--theme-foreground, 222.2 47.4% 11.2%);
}

.dark {
  --primary: var(--theme-primary-dark, 210 40% 98%);
  --background: var(--theme-background-dark, 222.2 84% 4.9%);
  --foreground: var(--theme-foreground-dark, 210 40% 98%);
}
```

---

# PERFORMANCE OPTIMIZATION

## Image Optimization

```tsx
// Using Next.js Image component
import Image from 'next/image';

<Image
  src={chalet.image}
  alt={chalet.name}
  width={800}
  height={600}
  placeholder="blur"
  blurDataURL={chalet.blurHash}
  priority={isAboveFold}
/>
```

## Code Splitting

```tsx
// Dynamic imports for large components
const FloorPlanEditor = dynamic(
  () => import('@/components/modules/FloorPlanEditor'),
  { loading: () => <Skeleton className="h-[500px]" /> }
);

const RevenueChart = dynamic(
  () => import('@/components/modules/RevenueChart'),
  { ssr: false } // Client-side only
);
```

## Prefetching

```tsx
// Prefetch on hover
<Link href={`/chalets/${chalet.id}`} prefetch={true}>
  View Details
</Link>

// Programmatic prefetch
router.prefetch('/admin/dashboard');
```

---

# TESTING STRATEGY

## Test Files

```
frontend/
├── __tests__/
│   ├── components/
│   ├── hooks/
│   ├── pages/
│   └── utils/
├── e2e/
│   ├── auth.spec.ts
│   ├── booking.spec.ts
│   └── pos.spec.ts
└── playwright.config.ts
```

## Component Testing

```typescript
// __tests__/components/BookingCard.test.tsx
import { render, screen } from '@testing-library/react';
import { BookingCard } from '@/components/modules/BookingCard';

describe('BookingCard', () => {
  it('renders booking details', () => {
    render(<BookingCard booking={mockBooking} />);
    expect(screen.getByText('Chalet Azure')).toBeInTheDocument();
    expect(screen.getByText('$450.00')).toBeInTheDocument();
  });
});
```

---

# PAGE COUNT SUMMARY

| Section | Pages | Status |
|---------|-------|--------|
| Authentication | 6 | ✅ Active |
| Public | 12 | ✅ Active |
| Customer Portal | 15 | ✅ Active |
| Staff Portal | 25 | ✅ Active |
| Admin Portal | 47 | ✅ Active |
| **TOTAL** | **105** | |

---

*Last Updated: February 2026*
