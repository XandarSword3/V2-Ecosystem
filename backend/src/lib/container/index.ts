/**
 * Service Container
 * Provides dependency injection for services
 */

import { notificationService } from '../../services/notifications.service.js';

class Container {
  notificationService() {
    return notificationService;
  }
}

let containerInstance: Container | null = null;

export function getContainer(): Container {
  if (!containerInstance) {
    containerInstance = new Container();
  }
  return containerInstance;
}
