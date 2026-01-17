# Frontend Libraries

Core utilities, API clients, and helper functions.

## Directory Structure

```
lib/
├── api.ts              # Axios API client
├── socket.ts           # Socket.io client hooks
├── settings-context.tsx # Settings provider
├── translate.ts        # Content translation helpers
├── utils.ts            # Common utilities
├── logger.ts           # Client-side logging
└── stores/             # Zustand store instances
    ├── settingsStore.ts
    └── cartStore.ts
```

## API Client (`api.ts`)

Axios instance with authentication and error handling:

```typescript
import { api, restaurantApi, poolApi, adminApi } from '@/lib/api';

// Generic request
const { data } = await api.get('/users/profile');

// Module-specific APIs
const menu = await restaurantApi.getMenu(moduleId);
const sessions = await poolApi.getSessions(date);
const stats = await adminApi.getDashboardStats();
```

### Features

- **Auto Token Refresh** - Refreshes expired access tokens
- **Request Interceptors** - Adds auth headers
- **Error Handling** - Converts errors to consistent format
- **Base URL** - Configured from environment

### Configuration

```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  withCredentials: true
});

// Add auth token
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await refreshToken();
      return api.request(error.config);
    }
    throw error;
  }
);
```

## Socket Client (`socket.ts`)

React hooks for Socket.io real-time features:

```typescript
import { useSocket, useOrderUpdates, useRestaurantOrders } from '@/lib/socket';

// Base hook
const { socket, isConnected, joinRoom, leaveRoom } = useSocket();

// Order tracking
useOrderUpdates(orderId, (update) => {
  setStatus(update.status);
});

// Kitchen display
useRestaurantOrders(
  (newOrder) => addOrder(newOrder),
  (statusUpdate) => updateOrder(statusUpdate)
);
```

### Features

- **Singleton Connection** - Single socket shared across components
- **Auto Reconnection** - Handles network drops
- **Heartbeat** - Keeps connection alive
- **Room Management** - Join/leave broadcast rooms

## Settings Context (`settings-context.tsx`)

Application settings provider:

```typescript
import { SettingsProvider, useSettings } from '@/lib/settings-context';

// Wrap app
<SettingsProvider>
  <App />
</SettingsProvider>

// Use in components
const { modules, settings, isLoading } = useSettings();

// Access module list
modules.map(module => (
  <ModuleCard key={module.id} module={module} />
));
```

## Translation Helpers (`translate.ts`)

Content translation for multilingual data:

```typescript
import { useContentTranslation } from '@/lib/translate';

function MenuItem({ item }) {
  const { translateContent, locale } = useContentTranslation();
  
  return (
    <div>
      <h3>{translateContent(item, 'name')}</h3>
      <p>{translateContent(item, 'description')}</p>
    </div>
  );
}
```

### How It Works

1. Database stores translations: `name`, `name_ar`, `name_fr`
2. `translateContent(item, 'name')` returns correct language
3. Falls back to English if translation missing

## Utilities (`utils.ts`)

Common helper functions:

```typescript
import { cn, formatCurrency, formatDate, debounce } from '@/lib/utils';

// Class name merging (tailwind-merge + clsx)
<div className={cn(
  'base-class',
  isActive && 'active-class',
  className
)} />

// Currency formatting
formatCurrency(25.99, 'USD'); // "$25.99"
formatCurrency(100, 'SAR');   // "100.00 ر.س"

// Date formatting
formatDate(new Date(), 'PPP'); // "January 14, 2026"

// Debounce
const debouncedSearch = debounce(search, 300);
```

## Logger (`logger.ts`)

Client-side logging with levels:

```typescript
import { logger, socketLogger } from '@/lib/logger';

logger.info('User logged in', { userId });
logger.warn('Session expiring soon');
logger.error('Payment failed', error);

// Socket-specific logging
socketLogger.info('Connected', socketId);
socketLogger.debug('Joined room', roomName);
```

### Configuration

```typescript
const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  debug: (...args) => !isProduction && console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};
```

## Usage Patterns

### API + React Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { restaurantApi } from '@/lib/api';

// Fetch data
const { data: menu, isLoading } = useQuery({
  queryKey: ['menu', moduleId],
  queryFn: () => restaurantApi.getMenu(moduleId)
});

// Mutate data
const orderMutation = useMutation({
  mutationFn: (items) => restaurantApi.createOrder(items),
  onSuccess: () => {
    queryClient.invalidateQueries(['orders']);
  }
});
```

### Socket + State

```typescript
function OrderTracker({ orderId }) {
  const [status, setStatus] = useState('pending');
  
  useOrderUpdates(orderId, (update) => {
    setStatus(update.status);
    
    if (update.status === 'ready') {
      toast.success('Your order is ready!');
    }
  });
  
  return <OrderStatus status={status} />;
}
```

---

These libraries provide the foundation for all frontend data fetching, real-time features, and utilities.
