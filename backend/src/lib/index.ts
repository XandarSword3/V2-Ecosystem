/**
 * V2 Resort Backend - Testable Architecture Library
 * 
 * This library provides a dependency injection-based architecture
 * that enables easy unit testing without database mocking.
 * 
 * ## Architecture Overview
 * 
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                        Controller                           │
 * │   Thin layer: request parsing, validation, response format  │
 * └─────────────────────────┬───────────────────────────────────┘
 *                           │ delegates to
 * ┌─────────────────────────▼───────────────────────────────────┐
 * │                         Service                             │
 * │   Business logic: validation, calculations, orchestration   │
 * │   Receives dependencies via constructor injection           │
 * └─────────────────────────┬───────────────────────────────────┘
 *                           │ uses
 * ┌─────────────────────────▼───────────────────────────────────┐
 * │                       Repository                            │
 * │   Data access: CRUD operations, queries                     │
 * │   Implements interface (Supabase or InMemory for tests)     │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 * 
 * ## Usage in Production
 * 
 * ```typescript
 * import { createContainer, createPoolService, createPoolController } from './lib';
 * 
 * const container = createContainer();
 * const poolService = createPoolService(container);
 * const poolController = createPoolController({ poolService });
 * 
 * app.get('/api/pool/sessions', poolController.getSessions);
 * ```
 * 
 * ## Usage in Tests
 * 
 * ```typescript
 * import { createInMemoryPoolRepository, createPoolService } from './lib';
 * 
 * const mockRepo = createInMemoryPoolRepository();
 * mockRepo.addSession({ name: 'Test', capacity: 100 });
 * 
 * const service = createPoolService({
 *   poolRepository: mockRepo,
 *   emailService: mockEmailService,
 *   // ... other mocked deps
 * });
 * 
 * const sessions = await service.getSessions();
 * expect(sessions).toHaveLength(1);
 * ```
 * 
 * @module lib
 */

// Container
export { createContainer, getContainer, resetContainer, setSocketIO } from './container/index.js';
export type { Container } from './container/index.js';

// Types
export type {
  DatabaseClient,
  QueryBuilder,
  PoolSession,
  PoolTicket,
  PoolRepository,
  EmailService,
  EmailOptions,
  EmailAttachment,
  QRCodeService,
  LoggerService,
  ActivityLoggerService,
  SocketEmitter,
  AppConfig,
  ContainerFactory,
} from './container/types.js';

// Repositories
export {
  SupabasePoolRepository,
  createPoolRepository,
  InMemoryPoolRepository,
  createInMemoryPoolRepository,
} from './repositories/index.js';

// Services
export {
  PoolService,
  PoolServiceError,
  createPoolService,
} from './services/index.js';
export type {
  PoolServiceDeps,
  PurchaseTicketInput,
  PurchaseTicketResult,
} from './services/index.js';

// Controllers
export {
  createPoolController,
} from './controllers/index.js';
export type {
  PoolController,
  PoolControllerDeps,
} from './controllers/index.js';
