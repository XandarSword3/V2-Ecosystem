/**
 * Marketing Automation Routes
 * Phase 3.4: Route definitions for marketing features
 */

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import * as marketingController from './marketing.controller';

const router = Router();

// Tracking endpoints (no auth required)
router.get('/track/open/:sendId', marketingController.trackEmailOpen);
router.get('/track/click/:sendId', marketingController.trackEmailClick);
router.post('/unsubscribe/:propertyId/:guestId', marketingController.handleUnsubscribe);

// All other routes require authentication
router.use(authenticate);

// =============================================
// SEGMENTS
// =============================================

router.post(
  '/properties/:propertyId/segments',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.createSegment
);

router.get(
  '/properties/:propertyId/segments',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.getSegments
);

router.get(
  '/segments/:segmentId/members',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.getSegmentMembers
);

router.post(
  '/segments/:segmentId/calculate',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.calculateSegmentMembers
);

router.post(
  '/segments/:segmentId/add',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.addToSegment
);

router.post(
  '/segments/:segmentId/remove',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.removeFromSegment
);

// =============================================
// EMAIL TEMPLATES
// =============================================

router.post(
  '/properties/:propertyId/templates',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.createTemplate
);

router.get(
  '/properties/:propertyId/templates',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.getTemplates
);

router.patch(
  '/templates/:templateId',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.updateTemplate
);

router.post(
  '/templates/:templateId/duplicate',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.duplicateTemplate
);

// =============================================
// EMAIL JOURNEYS
// =============================================

router.post(
  '/properties/:propertyId/journeys',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.createJourney
);

router.get(
  '/properties/:propertyId/journeys',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.getJourneys
);

router.get(
  '/journeys/:journeyId',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.getJourneyWithSteps
);

router.post(
  '/journeys/:journeyId/activate',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.activateJourney
);

router.post(
  '/journeys/:journeyId/pause',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.pauseJourney
);

router.post(
  '/journeys/:journeyId/enroll',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.enrollInJourney
);

router.get(
  '/journeys/:journeyId/analytics',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.getJourneyAnalytics
);

// =============================================
// CAMPAIGNS
// =============================================

router.post(
  '/properties/:propertyId/campaigns',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.createCampaign
);

router.get(
  '/properties/:propertyId/campaigns',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.getCampaigns
);

router.post(
  '/campaigns/:campaignId/send',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.sendCampaign
);

router.post(
  '/campaigns/:campaignId/schedule',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.scheduleCampaign
);

router.post(
  '/campaigns/:campaignId/cancel',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.cancelCampaign
);

router.get(
  '/campaigns/:campaignId/analytics',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.getCampaignAnalytics
);

// =============================================
// TRIGGERED AUTOMATIONS
// =============================================

router.post(
  '/properties/:propertyId/automations',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.createAutomation
);

router.get(
  '/properties/:propertyId/automations',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.getAutomations
);

router.post(
  '/automations/:automationId/trigger',
  authorize(['admin', 'manager', 'marketing', 'system']),
  marketingController.triggerAutomation
);

// =============================================
// PROMO CODES
// =============================================

router.post(
  '/properties/:propertyId/promo-codes',
  authorize(['admin', 'manager', 'marketing']),
  marketingController.createPromoCode
);

router.post(
  '/properties/:propertyId/promo-codes/validate',
  authorize(['admin', 'manager', 'front_desk', 'system']),
  marketingController.validatePromoCode
);

export default router;
