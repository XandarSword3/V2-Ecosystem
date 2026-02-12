/**
 * Device Management Module
 * 
 * Provides device registration and push notification management
 * for mobile app and PWA support.
 */

export { default as devicesRoutes } from './devices.routes.js';
export * from './devices.controller.js';
export {
  type DeviceTokenPayload,
  type DeviceRecord,
  type DeviceSummary,
  type ServiceResult,
  findDeviceByToken,
  registerDeviceToken,
  updateDeviceToken,
  unregisterDeviceToken,
  getActiveDeviceTokens,
  getBulkActiveDeviceTokens,
  cleanupStaleDevices,
} from './devices.service.js';
