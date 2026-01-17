/**
 * Dependency Injection Container
 * 
 * Central container for all application dependencies.
 * Enables easy testing by allowing dependency substitution.
 * 
 * Usage in production:
 *   const container = createContainer();
 *   app.locals.container = container;
 * 
 * Usage in tests:
 *   const mockRepo = createInMemoryPoolRepository();
 *   const container = createContainer({ poolRepository: mockRepo });
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Container,
  PoolRepository,
  EmailService,
  QRCodeService,
  LoggerService,
  ActivityLoggerService,
  SocketEmitter,
  AppConfig,
  DatabaseClient,
} from './types.js';
import { SupabasePoolRepository } from '../repositories/pool.repository.js';
import { logger as winstonLogger } from '../../utils/logger.js';
import { config as appConfig } from '../../config/index.js';
import { getSupabase } from '../../database/connection.js';
import QRCode from 'qrcode';

import { createInMemoryNotificationRepository } from '../repositories/notification.repository.memory.js';
import { createNotificationService } from '../services/notification.service.js';

// ============================================
// SERVICE IMPLEMENTATIONS
// ============================================

/**
 * QR Code service implementation
 */
class QRCodeServiceImpl implements QRCodeService {
  async generate(data: string): Promise<string> {
    return QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
    });
  }

  async generateAsBuffer(data: string): Promise<Buffer> {
    return QRCode.toBuffer(data, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 300,
      margin: 2,
    });
  }
}

/**
 * Winston logger adapter implementing LoggerService interface
 */
class WinstonLoggerAdapter implements LoggerService {
  info(message: string, ...args: unknown[]): void {
    winstonLogger.info(message, ...args);
  }
  warn(message: string, ...args: unknown[]): void {
    winstonLogger.warn(message, ...args);
  }
  error(message: string, ...args: unknown[]): void {
    winstonLogger.error(message, ...args);
  }
  debug(message: string, ...args: unknown[]): void {
    winstonLogger.debug(message, ...args);
  }
}

/**
 * Activity logger that writes to database
 */
class ActivityLoggerImpl implements ActivityLoggerService {
  constructor(private readonly db: SupabaseClient) {}

  async log(action: string, details: Record<string, unknown>, userId?: string): Promise<void> {
    try {
      await this.db.from('activity_logs').insert({
        action,
        details,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      // Don't fail operations due to logging errors
      console.error('Activity log failed:', error);
    }
  }
}

/**
 * Socket emitter that integrates with Socket.io
 */
class SocketEmitterImpl implements SocketEmitter {
  private io: unknown = null;

  setIO(io: unknown): void {
    this.io = io;
  }

  emitToUnit(unit: string, event: string, data: unknown): void {
    if (this.io && typeof (this.io as { to: (room: string) => { emit: (event: string, data: unknown) => void } }).to === 'function') {
      (this.io as { to: (room: string) => { emit: (event: string, data: unknown) => void } }).to(unit).emit(event, data);
    }
  }

  emitToRoom(room: string, event: string, data: unknown): void {
    if (this.io && typeof (this.io as { to: (room: string) => { emit: (event: string, data: unknown) => void } }).to === 'function') {
      (this.io as { to: (room: string) => { emit: (event: string, data: unknown) => void } }).to(room).emit(event, data);
    }
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    // Emit to user-specific room
    this.emitToRoom(`user-${userId}`, event, data);
  }
}

// ============================================
// CONTAINER FACTORY
// ============================================

let defaultContainer: Container | null = null;
let socketEmitterSingleton: SocketEmitterImpl | null = null;

/**
 * Create a dependency injection container
 * 
 * @param overrides - Partial container to override default implementations
 * @returns Complete container with all dependencies
 */
export function createContainer(overrides?: Partial<Container>): Container {
  // Get or create socket emitter singleton (needs to persist across container recreations)
  if (!socketEmitterSingleton) {
    socketEmitterSingleton = new SocketEmitterImpl();
  }

  // Default implementations
  const supabase = getSupabase();
  
  // Core defaults - other repositories/services are injected by the consuming code
  const notificationRepo = createInMemoryNotificationRepository();
  
  const defaults: Partial<Container> = {
    // Database client (Supabase adapter)
    database: supabase as unknown as DatabaseClient,

    // Repositories
    poolRepository: new SupabasePoolRepository(supabase),
    notificationRepository: notificationRepo,

    // Services
    emailService: null as unknown as EmailService, // Lazy loaded below
    qrCodeService: new QRCodeServiceImpl(),
    notificationService: () => createNotificationService({ notificationRepository: notificationRepo }),
    logger: new WinstonLoggerAdapter(),
    activityLogger: new ActivityLoggerImpl(supabase),
    socketEmitter: socketEmitterSingleton,

    // Config
    config: appConfig as unknown as AppConfig,
  };

  // Merge overrides - cast as Container since caller is responsible for full config
  const container = { ...defaults, ...overrides } as Container;

  // Lazy load email service if not overridden
  if (!overrides?.emailService) {
    // Import dynamically to avoid circular dependencies
    import('../../services/email.service.js').then(({ emailService }) => {
      if (!overrides?.emailService) {
        (container as { emailService: EmailService }).emailService = emailService;
      }
    });
  }

  return container;
}

/**
 * Get the default application container
 * Creates one if it doesn't exist
 */
export function getContainer(): Container {
  if (!defaultContainer) {
    defaultContainer = createContainer();
  }
  return defaultContainer;
}

/**
 * Reset the default container (for testing)
 */
export function resetContainer(): void {
  defaultContainer = null;
}

/**
 * Set the Socket.io instance for the socket emitter
 */
export function setSocketIO(io: unknown): void {
  if (socketEmitterSingleton) {
    socketEmitterSingleton.setIO(io);
  }
}

// Export types
export type { Container } from './types.js';
