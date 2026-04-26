/**
 * Guest Messaging Routes
 * Phase 4.3: Route definitions for messaging operations
 */

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import * as controller from './messaging.controller';

const router = Router();

// Public inquiry endpoint for module-builder form blocks.
router.post('/inquiries', controller.submitInquiry);

// =============================================
// CHANNEL CONFIGURATION (Admin Only)
// =============================================

// Configure messaging channel
router.post(
  '/channels/:propertyId',
  authenticate,
  authorize('admin', 'manager'),
  controller.configureChannel
);

// Get channel configuration
router.get(
  '/channels/:propertyId/:channelType',
  authenticate,
  authorize('admin', 'manager'),
  controller.getChannel
);

// Verify channel
router.post(
  '/channels/:channelId/verify',
  authenticate,
  authorize('admin', 'manager'),
  controller.verifyChannel
);

// =============================================
// GUEST PREFERENCES
// =============================================

// Update guest messaging preferences
router.put(
  '/preferences/:guestId/:propertyId',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.updateGuestPreferences
);

// Get guest preferences
router.get(
  '/preferences/:guestId/:propertyId',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.getGuestPreferences
);

// =============================================
// CONVERSATIONS
// =============================================

// Create new conversation
router.post(
  '/conversations/:propertyId',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.createConversation
);

// Get conversation by ID
router.get(
  '/conversations/:conversationId',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.getConversation
);

// Get property conversations (inbox)
router.get(
  '/conversations/property/:propertyId',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.getPropertyConversations
);

// Assign conversation
router.post(
  '/conversations/:conversationId/assign',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.assignConversation
);

// Update conversation priority
router.patch(
  '/conversations/:conversationId/priority',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.updateConversationPriority
);

// Resolve conversation
router.post(
  '/conversations/:conversationId/resolve',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.resolveConversation
);

// Reopen conversation
router.post(
  '/conversations/:conversationId/reopen',
  authenticate,
  authorize('admin', 'manager', 'front_desk'),
  controller.reopenConversation
);

// Mark conversation as read
router.post(
  '/conversations/:conversationId/read',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.markConversationRead
);

// =============================================
// MESSAGES
// =============================================

// Send message
router.post(
  '/conversations/:conversationId/messages',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.sendMessage
);

// Get conversation messages
router.get(
  '/conversations/:conversationId/messages',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.getConversationMessages
);

// =============================================
// TEMPLATES
// =============================================

// Create template
router.post(
  '/templates/:propertyId',
  authenticate,
  authorize('admin', 'manager'),
  controller.createTemplate
);

// Get template
router.get(
  '/templates/:templateId',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.getTemplate
);

// Get property templates
router.get(
  '/templates/property/:propertyId',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.getPropertyTemplates
);

// Render template with variables
router.post(
  '/templates/:templateId/render',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.renderTemplate
);

// =============================================
// CANNED RESPONSES
// =============================================

// Create canned response
router.post(
  '/canned-responses/:propertyId',
  authenticate,
  authorize('admin', 'manager'),
  controller.createCannedResponse
);

// Get canned responses
router.get(
  '/canned-responses/:propertyId',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.getCannedResponses
);

// Use canned response (increments counter)
router.post(
  '/canned-responses/:responseId/use',
  authenticate,
  authorize('admin', 'manager', 'front_desk', 'concierge'),
  controller.useCannedResponse
);

// =============================================
// WEBHOOKS (External - No Auth)
// =============================================

// Provider webhook endpoint
router.post(
  '/webhooks/:channelId',
  controller.handleWebhook
);

// =============================================
// ANALYTICS
// =============================================

router.get(
  '/analytics/:propertyId',
  authenticate,
  authorize('admin', 'manager'),
  controller.getMessagingAnalytics
);

export default router;
