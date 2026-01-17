# Shared Package

Shared TypeScript types and utilities used by both frontend and backend applications.

## Structure

```
shared/
├── package.json
├── types/
│   ├── index.ts    # All type definitions
│   └── README.md   # Type documentation
└── README.md       # This file
```

## Purpose

This package provides:

1. **Type Safety** - Consistent types across frontend and backend
2. **API Contracts** - Request/response type definitions
3. **Business Logic Types** - Domain models (User, Order, Booking)
4. **Enum Values** - Shared constants and enums

## Installation

This package is a local dependency:

```json
// In frontend/package.json or backend/package.json
{
  "dependencies": {
    "@v2-resort/shared": "file:../shared"
  }
}
```

## Available Types

See [types/README.md](types/README.md) for complete type documentation.

### Quick Reference

| Category | Types |
|----------|-------|
| Base | `UUID`, `BaseEntity` |
| Auth | `User`, `Role`, `Permission`, `AuthTokens` |
| Restaurant | `MenuItem`, `MenuCategory`, `Order`, `OrderItem` |
| Pool | `PoolSession`, `PoolBooking` |
| Chalets | `Chalet`, `ChaletBooking` |
| Payments | `Payment`, `PaymentStatus` |
| API | `ApiResponse`, `ApiError`, `PaginationMeta` |

## Usage Examples

```typescript
// Import types
import { 
  User, 
  Order, 
  ApiResponse,
  OrderStatus 
} from '@v2-resort/shared';

// Use in function signatures
async function getOrders(userId: string): Promise<ApiResponse<Order[]>> {
  // ...
}

// Type guards
function isCompletedOrder(order: Order): boolean {
  const completedStatuses: OrderStatus[] = ['delivered', 'checked_out'];
  return completedStatuses.includes(order.status);
}
```

## Development

### Building

```bash
cd shared
npm run build
```

### Watching for Changes

```bash
npm run watch
```

## Best Practices

1. **Immutability** - Keep types readonly where possible
2. **Optionality** - Mark nullable fields with `?`
3. **Documentation** - Add JSDoc comments for complex types
4. **Naming** - Use PascalCase for types, camelCase for properties
5. **Export** - Export all types from `index.ts`

---

For detailed type definitions, see [types/README.md](types/README.md).
