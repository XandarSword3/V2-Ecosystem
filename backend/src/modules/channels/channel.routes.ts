import { Router } from 'express';
import * as channelController from './channel.controller.js';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin', 'super_admin'));

// ==================== CONNECTIONS ====================

// Get all connections for a property
router.get('/properties/:propertyId/connections', channelController.getConnections);

// Create a new channel connection
router.post('/properties/:propertyId/connections', channelController.createConnection);

// Get single connection details
router.get('/connections/:connectionId', channelController.getConnection);

// Activate a connection
router.post('/connections/:connectionId/activate', channelController.activateConnection);

// Pause a connection
router.post('/connections/:connectionId/pause', channelController.pauseConnection);

// Delete a connection
router.delete('/connections/:connectionId', channelController.deleteConnection);

// ==================== ROOM MAPPINGS ====================

// Get room mappings for a connection
router.get('/connections/:connectionId/room-mappings', channelController.getRoomMappings);

// Create room mapping
router.post('/connections/:connectionId/room-mappings', channelController.createRoomMapping);

// Update room mapping
router.put('/room-mappings/:mappingId', channelController.updateRoomMapping);

// Delete room mapping
router.delete('/room-mappings/:mappingId', channelController.deleteRoomMapping);

// ==================== RATE MAPPINGS ====================

// Get rate mappings for a connection
router.get('/connections/:connectionId/rate-mappings', channelController.getRateMappings);

// Create rate mapping
router.post('/connections/:connectionId/rate-mappings', channelController.createRateMapping);

// ==================== SYNC ====================

// Trigger availability sync
router.post('/connections/:connectionId/sync/availability', channelController.triggerAvailabilitySync);

// Trigger rate sync
router.post('/connections/:connectionId/sync/rates', channelController.triggerRateSync);

// Get sync log
router.get('/connections/:connectionId/sync-log', channelController.getSyncLog);

// Trigger full sync for all connections (admin)
router.post('/sync/all', channelController.triggerFullSync);

// ==================== RESERVATIONS ====================

// Get reservations from a channel
router.get('/connections/:connectionId/reservations', channelController.getChannelReservations);

// ==================== WEBHOOKS (no auth - verified by signature) ====================
// These need to be registered separately without auth middleware

export const webhookRouter = Router();

// SiteMinder webhook
webhookRouter.post('/webhooks/siteminder/:property_id/:channel', channelController.handleSiteMinderWebhook);

// Generic OTA webhook
webhookRouter.post('/webhooks/ota/:property_id/:channel', channelController.handleOTAWebhook);

export default router;
