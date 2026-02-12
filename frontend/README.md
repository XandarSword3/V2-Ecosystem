# V2 Resort Frontend

A Next.js 14 application providing the user interface for the V2 Resort Management System. Built with the App Router, React 18, TypeScript, and Tailwind CSS.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Getting Started](#getting-started)
4. [Configuration](#configuration)
5. [Routing & Pages](#routing--pages)
6. [State Management](#state-management)
7. [Authentication](#authentication)
8. [Internationalization](#internationalization)
9. [Theming System](#theming-system)
10. [Component Library](#component-library)
11. [API Integration](#api-integration)
12. [Real-time Features](#real-time-features)
13. [PWA Support](#pwa-support)
14. [Testing](#testing)
15. [Deployment](#deployment)

---

## Architecture Overview

The frontend follows Next.js 14 App Router conventions with a feature-based organization pattern.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Next.js Application                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Provider Stack                               │ │
│  │  NextIntl → QueryClient → Theme → Auth → Settings              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    App Router                                   │ │
│  │  /app/page.tsx  │  /app/admin/  │  /app/restaurant/  │  ...   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    React Components                             │ │
│  │  UI │ Layout │ Admin │ Customer │ Module-Specific              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Data Layer                                   │ │
│  │  TanStack Query │ Zustand │ Socket.io │ API Client             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **App Router**: Leverages Next.js 14 server components for initial render, with client components for interactivity.

2. **TanStack Query**: Server state management with caching, background refetching, and optimistic updates.

3. **Zustand**: Client state management for UI state (cart, preferences, modals).

4. **Tailwind CSS**: Utility-first styling with custom theme tokens.

5. **next-intl**: Full internationalization with RTL support for Arabic.

6. **Radix UI**: Accessible, unstyled primitives for complex UI components.

---

## Directory Structure

```
frontend/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Homepage
│   │   ├── providers.tsx         # Provider composition
│   │   ├── admin/                # Admin dashboard pages
│   │   │   ├── layout.tsx        # Admin layout with sidebar
│   │   │   ├── page.tsx          # Admin dashboard
│   │   │   ├── orders/           # Order management
│   │   │   ├── restaurant/       # Restaurant management
│   │   │   ├── chalets/          # Chalet management
│   │   │   ├── pool/             # Pool management
│   │   │   ├── users/            # User management
│   │   │   ├── settings/         # System settings
│   │   │   ├── reports/          # Analytics/reports
│   │   │   └── ...
│   │   ├── restaurant/           # Customer restaurant pages
│   │   ├── chalets/              # Customer chalet pages
│   │   ├── pool/                 # Customer pool pages
│   │   ├── login/                # Authentication
│   │   ├── register/
│   │   ├── profile/              # User profile
│   │   ├── cart/                 # Shopping cart
│   │   └── ...
│   │
│   ├── components/               # React components
│   │   ├── ui/                   # Base UI components (Button, Input, etc.)
│   │   ├── layout/               # Layout components (Header, Sidebar)
│   │   ├── admin/                # Admin-specific components
│   │   ├── customer/             # Customer-facing components
│   │   ├── common/               # Shared components
│   │   ├── effects/              # Visual effects (animations, transitions)
│   │   ├── modules/              # Module-specific components
│   │   ├── payments/             # Payment components
│   │   ├── pos/                  # Point-of-sale components
│   │   └── pwa/                  # PWA components
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useSocket.ts          # WebSocket connection
│   │   ├── useTerminology.ts     # White-label terminology
│   │   ├── useThemeSettings.ts   # Theme customization
│   │   └── useIdleTimer.ts       # Session timeout
│   │
│   ├── lib/                      # Core utilities
│   │   ├── api.ts                # Axios API client
│   │   ├── auth-context.tsx      # Authentication context
│   │   ├── settings-context.tsx  # Site settings context
│   │   ├── socket.ts             # Socket.io client
│   │   ├── theme-config.ts       # Theme definitions
│   │   └── utils.ts              # Helper functions
│   │
│   ├── store/                    # Zustand stores
│   │   └── module-builder-store.ts
│   │
│   ├── stores/                   # Additional stores
│   │
│   ├── i18n/                     # Internationalization
│   │   └── index.ts              # Locale configuration
│   │
│   ├── types/                    # TypeScript definitions
│   │
│   ├── styles/                   # Global styles
│   │   └── globals.css           # Tailwind & custom CSS
│   │
│   └── services/                 # Service integrations
│       └── beta-testing.service.ts
│
├── messages/                     # Translation files
│   ├── en.json                   # English
│   ├── ar.json                   # Arabic (RTL)
│   ├── fr.json                   # French
│   ├── de.json                   # German
│   └── it.json                   # Italian
│
├── public/                       # Static assets
│   ├── icons/                    # PWA icons
│   ├── manifest.json             # PWA manifest
│   └── ...
│
├── tests/                        # Test files
├── package.json
├── next.config.mjs
├── tailwind.config.js
├── tsconfig.json
└── vitest.config.ts
```

---

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm or yarn
- Backend API running (see backend README)

### Installation

```bash
# Navigate to frontend directory
cd v2-resort/frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Configure API URL in .env.local
# NEXT_PUBLIC_API_URL=http://localhost:3005

# Run development server
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run lint` | Check code style |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run check:translations` | Check translation completeness |

---

## Configuration

### Environment Variables

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3005

# Sentry Error Tracking (optional)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx

# Stripe Payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### Next.js Configuration

[next.config.mjs](next.config.mjs):

```javascript
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'your-storage.supabase.co' }
    ]
  },
  experimental: {
    serverComponentsExternalPackages: ['@sentry/nextjs']
  }
};
```

---

## Routing & Pages

### Page Structure

The app uses Next.js App Router with the following structure:

```
/                           # Homepage
├── /login                  # Login page
├── /register               # Registration
├── /forgot-password        # Password reset
├── /profile                # User profile
│
├── /restaurant             # Restaurant section
│   ├── /menu               # Menu browsing
│   └── /order/:id          # Order tracking
│
├── /chalets                # Chalets section
│   ├── /:id                # Chalet details
│   └── /booking            # Booking flow
│
├── /pool                   # Pool section
│   └── /tickets            # Ticket purchase
│
├── /cart                   # Shopping cart
├── /checkout               # Payment checkout
│
└── /admin                  # Admin dashboard
    ├── /orders             # Order management
    ├── /restaurant         # Menu management
    ├── /chalets            # Chalet management
    ├── /pool               # Pool management
    ├── /users              # User management
    ├── /settings           # System settings
    ├── /reports            # Analytics
    └── /...
```

### Layout Hierarchy

```tsx
// Root layout (src/app/layout.tsx)
<html>
  <body>
    <Providers>        {/* All context providers */}
      <Header />       {/* Navigation header */}
      {children}       {/* Page content */}
      <Footer />       {/* Site footer */}
    </Providers>
  </body>
</html>

// Admin layout (src/app/admin/layout.tsx)
<AdminGuard>           {/* Role-based access control */}
  <div className="flex">
    <AdminSidebar />   {/* Admin navigation */}
    <main>{children}</main>
  </div>
</AdminGuard>
```

### Route Protection

```tsx
// Protected route example
'use client';
import { useAuth } from '@/lib/auth-context';
import { redirect } from 'next/navigation';

export default function ProtectedPage() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  if (!user) redirect('/login');
  
  return <div>Protected content</div>;
}
```

---

## State Management

### Provider Stack

Providers are composed in [src/app/providers.tsx](src/app/providers.tsx):

```tsx
<NextIntlClientProvider>      {/* Internationalization */}
  <QueryClientProvider>        {/* Server state (TanStack Query) */}
    <ThemeProvider>            {/* Theme context */}
      <AuthProvider>           {/* Authentication state */}
        <SettingsProvider>     {/* Site settings */}
          {children}
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
</NextIntlClientProvider>
```

### TanStack Query (Server State)

Used for all API data fetching:

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Fetch data
const { data, isLoading, error } = useQuery({
  queryKey: ['menu', categoryId],
  queryFn: () => api.get(`/restaurant/menu?category=${categoryId}`),
  staleTime: 60 * 1000  // Cache for 1 minute
});

// Mutate data
const createOrder = useMutation({
  mutationFn: (orderData) => api.post('/restaurant/orders', orderData),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  }
});
```

### Zustand (Client State)

Used for UI state that doesn't need server sync:

```tsx
// src/store/cart-store.ts
import { create } from 'zustand';

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ 
    items: [...state.items, item] 
  })),
  removeItem: (id) => set((state) => ({ 
    items: state.items.filter((i) => i.id !== id) 
  })),
  clearCart: () => set({ items: [] })
}));
```

### Context (Shared State)

Used for app-wide state requiring React context:

```tsx
// Using authentication context
import { useAuth } from '@/lib/auth-context';

function UserMenu() {
  const { user, logout, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <LoginButton />;
  }
  
  return (
    <Dropdown>
      <span>{user.fullName}</span>
      <button onClick={logout}>Logout</button>
    </Dropdown>
  );
}
```

---

## Authentication

### Authentication Flow

```
1. User submits credentials
   → POST /api/v1/auth/login
   
2. Check if 2FA required
   → If yes: Show 2FA input
   → POST /api/v1/auth/2fa/verify
   
3. Store tokens in localStorage
   → accessToken (short-lived)
   → refreshToken (long-lived)
   
4. Validate session on app mount
   → GET /api/v1/auth/me
   → Refresh token if expired
```

### Using Auth Context

```tsx
import { useAuth } from '@/lib/auth-context';

function LoginForm() {
  const { login, isLoading } = useAuth();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    
    if ('requiresTwoFactor' in result) {
      // Show 2FA input
      setShow2FA(true);
    } else {
      // Login successful
      router.push('/');
    }
  };
}
```

### Token Management

The API client automatically handles token refresh:

```tsx
// src/lib/api.ts
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !isRefreshing) {
      // Try to refresh the access token
      const refreshToken = localStorage.getItem('refreshToken');
      const { data } = await api.post('/auth/refresh', { refreshToken });
      localStorage.setItem('accessToken', data.accessToken);
      // Retry original request
      return api(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## Internationalization

### Supported Languages

| Code | Language | Direction |
|------|----------|-----------|
| `en` | English | LTR |
| `ar` | Arabic | RTL |
| `fr` | French | LTR |
| `de` | German | LTR |
| `it` | Italian | LTR |

### Using Translations

```tsx
'use client';
import { useTranslations } from 'next-intl';

function WelcomeMessage() {
  const t = useTranslations('home');
  
  return (
    <div>
      <h1>{t('welcome')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

### Translation Files

Located in [messages/](messages/):

```json
// messages/en.json
{
  "home": {
    "welcome": "Welcome to V2 Resort",
    "description": "Experience luxury at its finest"
  },
  "navigation": {
    "home": "Home",
    "restaurant": "Restaurant",
    "chalets": "Chalets",
    "pool": "Pool"
  }
}
```

### RTL Support

RTL is automatically handled based on locale:

```tsx
// DirectionSync component
'use client';
import { useLocale } from 'next-intl';

export function DirectionSync() {
  const locale = useLocale();
  const isRTL = locale === 'ar';
  
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [isRTL]);
  
  return null;
}
```

---

## Theming System

### Available Themes

```typescript
// src/lib/theme-config.ts
export type ResortTheme = 
  | 'default'     // Classic resort theme
  | 'modern'      // Clean, minimal
  | 'luxury'      // Gold accents, rich colors
  | 'tropical'    // Bright, beach-inspired
  | 'alpine'      // Mountain resort
  | 'dark';       // Dark mode
```

### Theme Customization

Themes are customizable via admin settings:

```typescript
interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  // Dark mode variants
  backgroundDark?: string;
  surfaceDark?: string;
}
```

### Using Theme

```tsx
import { useThemeSettings } from '@/hooks/useThemeSettings';

function ThemedComponent() {
  const { theme, colors, isDark } = useThemeSettings();
  
  return (
    <div style={{ backgroundColor: colors.surface }}>
      <h1 style={{ color: colors.text }}>Content</h1>
    </div>
  );
}
```

### CSS Variables

Theme colors are injected as CSS variables:

```css
/* Available via ThemeInjector */
:root {
  --color-primary: #2563eb;
  --color-secondary: #64748b;
  --color-accent: #f59e0b;
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
}
```

---

## Component Library

### UI Components

Base components in [src/components/ui/](src/components/ui/):

| Component | Description | Based On |
|-----------|-------------|----------|
| `Button` | Action buttons | Custom |
| `Input` | Text input | Custom |
| `Select` | Dropdown select | Radix UI |
| `Dialog` | Modal dialogs | Radix UI |
| `Tabs` | Tab navigation | Radix UI |
| `Card` | Content cards | Custom |
| `Table` | Data tables | Custom |
| `Form` | Form components | react-hook-form |
| `Calendar` | Date picker | react-day-picker |
| `Tooltip` | Tooltips | Radix UI |

### Usage Example

```tsx
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';

function OrderCard({ order }) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Order #{order.id}</Card.Title>
      </Card.Header>
      <Card.Content>
        <p>{order.items.length} items</p>
        <p>${order.total}</p>
      </Card.Content>
      <Card.Footer>
        <Dialog>
          <DialogTrigger asChild>
            <Button>View Details</Button>
          </DialogTrigger>
          <DialogContent>
            {/* Order details */}
          </DialogContent>
        </Dialog>
      </Card.Footer>
    </Card>
  );
}
```

### Layout Components

```tsx
// Header with responsive navigation
import Header from '@/components/layout/Header';

// Admin sidebar with collapsible navigation
import AdminSidebar from '@/components/layout/AdminSidebar';

// Footer with configurable sections
import Footer from '@/components/Footer';
```

---

## API Integration

### API Client

Configured in [src/lib/api.ts](src/lib/api.ts):

```typescript
import { api } from '@/lib/api';

// GET request
const response = await api.get('/restaurant/menu');

// POST request
const response = await api.post('/restaurant/orders', {
  items: [...],
  customerName: 'John'
});

// With error handling
try {
  const { data } = await api.get('/orders');
  if (data.success) {
    setOrders(data.data);
  }
} catch (error) {
  if (error.response?.status === 401) {
    // Handle unauthorized
  }
}
```

### Features

- **Automatic Token Injection**: Access token added to all requests
- **Token Refresh**: Automatic refresh on 401 responses
- **CSRF Protection**: Tokens sent with credentials
- **Retry Logic**: Automatic retry for network errors
- **Timeout**: 30-second default timeout

### Response Format

```typescript
// Success response
{
  success: true,
  data: { ... }
}

// Error response
{
  success: false,
  error: "Error message"
}
```

---

## Real-time Features

### Socket.io Integration

```tsx
import { useSocket } from '@/hooks/useSocket';

function KitchenDisplay() {
  const socket = useSocket();
  const [orders, setOrders] = useState([]);
  
  useEffect(() => {
    if (!socket) return;
    
    socket.emit('join:kitchen');
    
    socket.on('order:new', (order) => {
      setOrders((prev) => [...prev, order]);
    });
    
    socket.on('order:update', ({ orderId, status }) => {
      setOrders((prev) => 
        prev.map((o) => o.id === orderId ? { ...o, status } : o)
      );
    });
    
    return () => {
      socket.emit('leave:kitchen');
    };
  }, [socket]);
}
```

### Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `order:new` | Server → Client | New order placed |
| `order:update` | Server → Client | Order status changed |
| `order:ready` | Server → Client | Order ready for pickup |
| `track:order` | Client → Server | Subscribe to order updates |
| `join:kitchen` | Client → Server | Join kitchen display room |

---

## PWA Support

### Features

- **Installable**: Add to home screen on mobile devices
- **Offline Support**: Service worker caches assets
- **Push Notifications**: Order updates (when enabled)

### Configuration

```json
// public/manifest.json
{
  "name": "V2 Resort",
  "short_name": "V2 Resort",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512" }
  ]
}
```

### PWA Prompt

```tsx
import { PWAPrompt } from '@/components/pwa';

// Shows install prompt on supported devices
<PWAPrompt />
```

---

## Testing

### Test Structure

```
tests/
├── components/           # Component tests
│   ├── Button.test.tsx
│   └── ...
├── hooks/               # Hook tests
│   └── useAuth.test.ts
└── pages/               # Page tests
    └── home.test.tsx
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Writing Tests

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });
  
  it('handles click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

---

## Deployment

### Build Process

```bash
# Build for production
npm run build

# Output is in .next/
# Static assets in .next/static/
```

### Docker Deployment

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY package*.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment-Specific Builds

```bash
# Production build
NODE_ENV=production npm run build

# Staging build
NODE_ENV=staging npm run build
```

### Vercel Deployment

Project is configured for Vercel with [vercel.json](vercel.json):

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next"
}
```

---

## Further Reading

- [Component README](src/components/README.md) - Component documentation
- [API Integration](src/lib/README.md) - API client details
- [i18n Guide](src/i18n/README.md) - Translation guide
- [Store Documentation](src/store/README.md) - State management
