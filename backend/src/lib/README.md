# V2 Resort Backend - Testable Architecture Guide

## Overview

This document describes the new dependency injection-based architecture that enables professional-grade testing. The architecture follows industry best practices:

- **Repository Pattern** - Data access abstracted behind interfaces
- **Service Layer** - Business logic in injectable service classes
- **Thin Controllers** - HTTP handling only, delegates to services
- **Dependency Injection** - All dependencies passed via constructor

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Routes (Express)                         │
│   Middleware: auth, validation, rate limiting                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                         Controller                               │
│   - Parse request params/body/query                             │
│   - Validate input (Zod schemas)                                │
│   - Call service method                                          │
│   - Format HTTP response                                        │
│   - Handle errors                                                │
│   Lines of code: 10-30 per handler                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ calls
┌─────────────────────────────▼───────────────────────────────────┐
│                          Service                                 │
│   - Business logic and validation                               │
│   - Price calculations                                          │
│   - Entity state transitions                                    │
│   - Orchestrate multiple repositories                           │
│   - Emit events (socket, email)                                 │
│   - Log activities                                               │
│   Receives all dependencies via constructor                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │ uses
┌─────────────────────────────▼───────────────────────────────────┐
│                        Repository                                │
│   - CRUD operations                                             │
│   - Database queries                                            │
│   - Data transformation                                         │
│   Implements interface (Supabase or InMemory)                   │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
backend/src/lib/
├── container/
│   ├── index.ts          # DI container factory
│   └── types.ts          # All interface definitions
├── repositories/
│   ├── index.ts          # Repository exports
│   ├── pool.repository.ts       # Supabase implementation
│   └── pool.repository.memory.ts # In-memory for tests
├── services/
│   ├── index.ts          # Service exports
│   └── pool.service.ts   # Pool business logic
├── controllers/
│   ├── index.ts          # Controller exports
│   └── pool.controller.ts # Thin HTTP handlers
└── index.ts              # Main library exports
```

## Key Concepts

### 1. Repository Pattern

Repositories abstract database access behind interfaces. This allows:
- Swapping Supabase for in-memory storage in tests
- No need to mock Supabase query chains
- Clear separation of data access from business logic

```typescript
// Interface (in types.ts)
export interface PoolRepository {
  getSessions(moduleId?: string): Promise<PoolSession[]>;
  getSessionById(id: string): Promise<PoolSession | null>;
  createTicket(ticket: Omit<PoolTicket, 'id'>): Promise<PoolTicket>;
  // ... more methods
}

// Supabase implementation (production)
export class SupabasePoolRepository implements PoolRepository {
  constructor(private readonly supabase: SupabaseClient) {}
  
  async getSessions(moduleId?: string): Promise<PoolSession[]> {
    let query = this.supabase.from('pool_sessions').select('*');
    if (moduleId) query = query.eq('module_id', moduleId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}

// In-memory implementation (tests)
export class InMemoryPoolRepository implements PoolRepository {
  private sessions = new Map<string, PoolSession>();
  
  async getSessions(): Promise<PoolSession[]> {
    return Array.from(this.sessions.values());
  }
  
  // Test helper to add data
  addSession(session: PoolSession) {
    this.sessions.set(session.id, session);
  }
}
```

### 2. Service Layer with Dependency Injection

Services contain all business logic. Dependencies are passed via constructor:

```typescript
export interface PoolServiceDeps {
  poolRepository: PoolRepository;
  emailService: EmailService;
  qrCodeService: QRCodeService;
  logger: LoggerService;
  activityLogger: ActivityLoggerService;
  socketEmitter: SocketEmitter;
  config: AppConfig;
}

export class PoolService {
  constructor(private readonly deps: PoolServiceDeps) {}

  async purchaseTicket(input: PurchaseTicketInput): Promise<PurchaseTicketResult> {
    // 1. Validate session exists
    const session = await this.deps.poolRepository.getSessionById(input.sessionId);
    if (!session) {
      throw new PoolServiceError('Session not found', 'SESSION_NOT_FOUND', 404);
    }

    // 2. Check availability
    const availability = await this.deps.poolRepository.getAvailability(input.date);
    // ... business logic

    // 3. Generate QR code
    const qrCode = await this.deps.qrCodeService.generate(ticketData);

    // 4. Create ticket
    const ticket = await this.deps.poolRepository.createTicket(/* ... */);

    // 5. Log activity
    await this.deps.activityLogger.log('pool_ticket_purchased', { ticketId: ticket.id });

    // 6. Send email
    if (input.guestEmail) {
      this.deps.emailService.sendPoolTicketConfirmation(ticket, session);
    }

    // 7. Emit real-time update
    this.deps.socketEmitter.emitToUnit('pool', 'ticket_purchased', { /* ... */ });

    return { ticket, qrCode };
  }
}
```

### 3. Thin Controllers

Controllers only handle HTTP concerns:

```typescript
export function createPoolController(deps: { poolService: PoolService }) {
  return {
    async getSessions(req: Request, res: Response, next: NextFunction) {
      try {
        const { moduleId } = req.query;
        const sessions = await deps.poolService.getSessions(moduleId as string);
        res.json({ success: true, data: sessions });
      } catch (error) {
        next(error);
      }
    },

    async purchaseTicket(req: Request, res: Response, next: NextFunction) {
      try {
        const validated = purchaseSchema.parse(req.body);
        const result = await deps.poolService.purchaseTicket(validated);
        res.status(201).json({ success: true, data: result.ticket });
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({ error: 'Validation failed' });
        }
        next(error);
      }
    },
  };
}
```

## Writing Tests

### Unit Tests (No Database)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PoolService } from '../../src/lib/services/pool.service';
import { InMemoryPoolRepository } from '../../src/lib/repositories/pool.repository.memory';

describe('PoolService', () => {
  let poolRepository: InMemoryPoolRepository;
  let poolService: PoolService;

  beforeEach(() => {
    poolRepository = new InMemoryPoolRepository();
    
    poolService = new PoolService({
      poolRepository,
      emailService: { sendPoolTicketConfirmation: vi.fn() },
      qrCodeService: { generate: vi.fn().mockResolvedValue('qr-data') },
      logger: { info: vi.fn(), error: vi.fn() },
      activityLogger: { log: vi.fn() },
      socketEmitter: { emitToUnit: vi.fn() },
      config: { /* test config */ },
    });
  });

  it('should calculate availability correctly', async () => {
    // Arrange
    const session = poolRepository.addSession({ name: 'Morning', capacity: 100 });
    poolRepository.addTicket({ session_id: session.id, adults: 10, children: 5 });

    // Act
    const availability = await poolService.getAvailability('2024-06-15');

    // Assert
    expect(availability[0].booked).toBe(15);
    expect(availability[0].available).toBe(85);
  });

  it('should reject purchase when capacity exceeded', async () => {
    const session = poolRepository.addSession({ name: 'Small', capacity: 5 });
    poolRepository.addTicket({ session_id: session.id, adults: 5 });

    await expect(poolService.purchaseTicket({
      sessionId: session.id,
      adults: 2,
      // ...
    })).rejects.toMatchObject({
      code: 'INSUFFICIENT_CAPACITY',
    });
  });
});
```

### Using Test Helpers

```typescript
import { createTestContainer, buildPoolSession, expectActivityLogged } from '../utils/test-helpers';

describe('PoolService', () => {
  it('should log activity after purchase', async () => {
    const container = createTestContainer();
    container.poolRepository.addSession(buildPoolSession());
    
    const service = new PoolService(container);
    await service.purchaseTicket({ /* ... */ });
    
    expectActivityLogged(container.activityLogger, 'pool_ticket_purchased');
  });
});
```

## Migration Guide

### Converting Existing Controllers

1. **Create repository interface** in `lib/container/types.ts`
2. **Implement Supabase repository** in `lib/repositories/`
3. **Implement InMemory repository** for testing
4. **Create service class** with all business logic
5. **Create controller factory** that uses service
6. **Write tests** for service using InMemory repository
7. **Update routes** to use new controller

### Example: Converting Pool Module

Before (900+ line controller):
```typescript
// pool.controller.ts
export async function purchaseTicket(req, res, next) {
  const supabase = getSupabase();
  // validation, DB queries, QR gen, email, socket... all mixed
}
```

After (clean separation):
```typescript
// lib/services/pool.service.ts
class PoolService {
  async purchaseTicket(input) { /* business logic */ }
}

// lib/controllers/pool.controller.ts
createPoolController({ poolService }).purchaseTicket // thin handler
```

## Benefits

1. **Testability** - 27 unit tests in 15ms, no database needed
2. **Maintainability** - Clear separation of concerns
3. **Reliability** - Business logic tested in isolation
4. **Speed** - Unit tests run in milliseconds
5. **Confidence** - Can refactor without fear

## Next Steps

The following modules should be migrated:

| Module | Priority | Complexity |
|--------|----------|------------|
| Auth | High | Medium |
| Restaurant | High | High |
| Chalets | High | High |
| Payments | Critical | Medium |
| Snack | Medium | Low |
| Admin | Medium | High |
| Reviews | Low | Low |

For each module:
1. Create `{Module}Repository` interface
2. Implement `Supabase{Module}Repository`
3. Implement `InMemory{Module}Repository`
4. Create `{Module}Service` class
5. Create `create{Module}Controller` factory
6. Write comprehensive tests
