/**
 * Device Management Routes
 * 
 * Endpoints for managing device tokens and push notification preferences.
 * 
 * @module modules/devices/routes
 */

import { Router } from 'express';
import * as devicesController from './devices.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route POST /api/devices/register
 * @desc Register a device for push notifications
 * @access Private
 * @body {
 *   deviceToken: string (required),
 *   platform: 'ios' | 'android' | 'web' (required),
 *   deviceName?: string,
 *   appVersion?: string,
 *   deviceModel?: string,
 *   osVersion?: string,
 *   notificationsEnabled?: boolean
 * }
 */
router.post('/register', devicesController.registerDevice);

/**
 * @route DELETE /api/devices/unregister
 * @desc Unregister a device (soft delete)
 * @access Private
 * @body { deviceToken: string }
 */
router.delete('/unregister', devicesController.unregisterDevice);

/**
 * @route GET /api/devices
 * @desc Get all registered devices for current user
 * @access Private
 */
router.get('/', devicesController.getUserDevices);

/**
 * @route PATCH /api/devices/:deviceId/preferences
 * @desc Update device notification preferences
 * @access Private
 * @body { notificationsEnabled?: boolean, deviceName?: string }
 */
router.patch('/:deviceId/preferences', devicesController.updateDevicePreferences);

/**
 * @route DELETE /api/devices/:deviceId
 * @desc Remove a specific device (hard delete)
 * @access Private
 */
router.delete('/:deviceId', devicesController.removeDevice);

/**
 * @route POST /api/devices/logout-all
 * @desc Logout from all devices (invalidate all tokens)
 * @access Private
 * @body { exceptCurrent?: boolean, currentDeviceToken?: string }
 */
router.post('/logout-all', devicesController.logoutAllDevices);

export default router;
