import { createSupabaseNotificationRepository } from '../repositories/notification.repository.supabase.js';
import { createNotificationService } from '../services/notification.service.js';

export interface Container {
  notificationService: () => ReturnType<typeof createNotificationService>;
  [key: string]: unknown;
}

let defaultContainer: Container | null = null;

export function createContainer(overrides?: Partial<Container>): Container {
  const notificationRepo = createSupabaseNotificationRepository();
  const defaults: Container = {
    notificationService: () => createNotificationService({ notificationRepository: notificationRepo }),
  };
  return { ...defaults, ...overrides } as Container;
}

export function getContainer(): Container {
  if (!defaultContainer) {
    defaultContainer = createContainer();
  }
  return defaultContainer;
}

export function resetContainer(): void {
  defaultContainer = null;
}
