/**
 * Marketing Automation Controller
 * Phase 3.4: HTTP endpoints for marketing features
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { marketingAutomationService } from './marketing.service';

// =============================================
// SEGMENTS
// =============================================

export const createSegment = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { name, rules, description, segmentType } = req.body;

    const segment = await marketingAutomationService.createSegment(
      propertyId,
      name,
      rules || [],
      description,
      segmentType
    );

    res.status(201).json({
      success: true,
      data: segment,
      message: 'Segment created successfully'
    });
});
export const getSegments = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;

    const segments = await marketingAutomationService.getSegments(propertyId);

    res.json({
      success: true,
      data: segments,
      count: segments.length
    });
});
export const getSegmentMembers = asyncHandler(async (req: Request, res: Response) => {
    const { segmentId } = req.params;
    const { limit, offset } = req.query;

    const members = await marketingAutomationService.getSegmentMembers(
      segmentId,
      limit ? parseInt(limit as string) : 100,
      offset ? parseInt(offset as string) : 0
    );

    res.json({
      success: true,
      data: members,
      count: members.length
    });
});
export const calculateSegmentMembers = asyncHandler(async (req: Request, res: Response) => {
    const { segmentId } = req.params;

    const count = await marketingAutomationService.calculateSegmentMembers(segmentId);

    res.json({
      success: true,
      data: { memberCount: count }
    });
});
export const addToSegment = asyncHandler(async (req: Request, res: Response) => {
    const { segmentId } = req.params;
    const { guestIds } = req.body;

    const added = await marketingAutomationService.addToSegment(segmentId, guestIds, 'manual');

    res.json({
      success: true,
      data: { added },
      message: `Added ${added} guests to segment`
    });
});
export const removeFromSegment = asyncHandler(async (req: Request, res: Response) => {
    const { segmentId } = req.params;
    const { guestIds } = req.body;

    const removed = await marketingAutomationService.removeFromSegment(segmentId, guestIds);

    res.json({
      success: true,
      data: { removed },
      message: `Removed ${removed} guests from segment`
    });
});
// =============================================
// EMAIL TEMPLATES
// =============================================

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;

    const template = await marketingAutomationService.createTemplate(propertyId, req.body);

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully'
    });
});
export const getTemplates = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { category } = req.query;

    const templates = await marketingAutomationService.getTemplates(
      propertyId,
      category as string | undefined
    );

    res.json({
      success: true,
      data: templates
    });
});
export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { templateId } = req.params;

    await marketingAutomationService.updateTemplate(templateId, req.body);

    res.json({
      success: true,
      message: 'Template updated successfully'
    });
});
export const duplicateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { templateId } = req.params;
    const { newName } = req.body;

    const template = await marketingAutomationService.duplicateTemplate(templateId, newName);

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template duplicated successfully'
    });
});
// =============================================
// EMAIL JOURNEYS
// =============================================

export const createJourney = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { name, journeyType, triggerType, triggerConfig, steps, ...options } = req.body;

    const journey = await marketingAutomationService.createJourney(
      propertyId,
      name,
      journeyType,
      triggerType,
      triggerConfig,
      steps || [],
      options
    );

    res.status(201).json({
      success: true,
      data: journey,
      message: 'Journey created successfully'
    });
});
export const getJourneys = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { status } = req.query;

    const journeys = await marketingAutomationService.getJourneys(
      propertyId,
      status as string | undefined
    );

    res.json({
      success: true,
      data: journeys
    });
});
export const getJourneyWithSteps = asyncHandler(async (req: Request, res: Response) => {
    const { journeyId } = req.params;

    const journey = await marketingAutomationService.getJourneyWithSteps(journeyId);

    if (!journey) {
      return res.status(404).json({
        success: false,
        error: 'Journey not found'
      });
    }

    res.json({
      success: true,
      data: journey
    });
});
export const activateJourney = asyncHandler(async (req: Request, res: Response) => {
    const { journeyId } = req.params;

    await marketingAutomationService.activateJourney(journeyId);

    res.json({
      success: true,
      message: 'Journey activated'
    });
});
export const pauseJourney = asyncHandler(async (req: Request, res: Response) => {
    const { journeyId } = req.params;

    await marketingAutomationService.pauseJourney(journeyId);

    res.json({
      success: true,
      message: 'Journey paused'
    });
});
export const enrollInJourney = asyncHandler(async (req: Request, res: Response) => {
    const { journeyId } = req.params;
    const { guestId, bookingId, metadata } = req.body;

    const enrollment = await marketingAutomationService.enrollInJourney(
      journeyId,
      guestId,
      bookingId,
      metadata
    );

    res.status(201).json({
      success: true,
      data: enrollment,
      message: 'Guest enrolled in journey'
    });
});
export const getJourneyAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { journeyId } = req.params;

    const analytics = await marketingAutomationService.getJourneyAnalytics(journeyId);

    res.json({
      success: true,
      data: analytics
    });
});
// =============================================
// CAMPAIGNS
// =============================================

export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const userId = req.user?.id;
    if (!userId) throw new Error('Authentication required');

    const campaign = await marketingAutomationService.createCampaign(
      propertyId,
      req.body,
      userId
    );

    res.status(201).json({
      success: true,
      data: campaign,
      message: 'Campaign created successfully'
    });
});
export const getCampaigns = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { status } = req.query;

    const campaigns = await marketingAutomationService.getCampaigns(
      propertyId,
      status as string | undefined
    );

    res.json({
      success: true,
      data: campaigns
    });
});
export const sendCampaign = asyncHandler(async (req: Request, res: Response) => {
    const { campaignId } = req.params;

    const result = await marketingAutomationService.sendCampaign(campaignId);

    res.json({
      success: true,
      data: result,
      message: `Queued ${result.queued} emails`
    });
});
export const scheduleCampaign = asyncHandler(async (req: Request, res: Response) => {
    const { campaignId } = req.params;
    const { scheduledAt } = req.body;

    await marketingAutomationService.scheduleCampaign(
      campaignId,
      new Date(scheduledAt)
    );

    res.json({
      success: true,
      message: 'Campaign scheduled'
    });
});
export const cancelCampaign = asyncHandler(async (req: Request, res: Response) => {
    const { campaignId } = req.params;

    await marketingAutomationService.cancelCampaign(campaignId);

    res.json({
      success: true,
      message: 'Campaign cancelled'
    });
});
export const getCampaignAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { campaignId } = req.params;

    const analytics = await marketingAutomationService.getCampaignAnalytics(campaignId);

    res.json({
      success: true,
      data: analytics
    });
});
// =============================================
// TRIGGERED AUTOMATIONS
// =============================================

export const createAutomation = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { name, triggerEvent, templateId, ...options } = req.body;

    const automation = await marketingAutomationService.createAutomation(
      propertyId,
      name,
      triggerEvent,
      templateId,
      options
    );

    res.status(201).json({
      success: true,
      data: automation,
      message: 'Automation created successfully'
    });
});
export const getAutomations = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;

    const automations = await marketingAutomationService.getAutomations(propertyId);

    res.json({
      success: true,
      data: automations
    });
});
export const triggerAutomation = asyncHandler(async (req: Request, res: Response) => {
    const { automationId } = req.params;
    const { guestId, bookingId, triggerData } = req.body;

    await marketingAutomationService.triggerAutomation(
      automationId,
      guestId,
      bookingId,
      triggerData
    );

    res.json({
      success: true,
      message: 'Automation triggered'
    });
});
// =============================================
// EMAIL TRACKING
// =============================================

export async function trackEmailOpen(req: Request, res: Response, next: NextFunction) {
  try {
    const { sendId } = req.params;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    await marketingAutomationService.trackOpen(sendId, ipAddress, userAgent);

    // Return tracking pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.set('Content-Type', 'image/gif');
    res.send(pixel);
  } catch (error) {
    // Don't fail on tracking errors, still return pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.set('Content-Type', 'image/gif');
    res.send(pixel);
  }
}

export async function trackEmailClick(req: Request, res: Response, next: NextFunction) {
  try {
    const { sendId } = req.params;
    const { url } = req.query;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    if (url) {
      const targetUrl = url as string;

      // FIX: Iteration 17 - Validate URL to prevent open redirect (phishing vector)
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
      } catch {
        return res.status(400).json({ error: 'Invalid URL' });
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Invalid URL protocol' });
      }

      await marketingAutomationService.trackClick(sendId, targetUrl, ipAddress, userAgent);
      res.redirect(targetUrl);
    } else {
      res.status(400).json({ error: 'Missing URL' });
    }
  } catch (error) {
    // Redirect anyway to not break user experience — but validate first
    if (req.query.url) {
      const targetUrl = req.query.url as string;
      try {
        const parsedUrl = new URL(targetUrl);
        if (['http:', 'https:'].includes(parsedUrl.protocol)) {
          return res.redirect(targetUrl);
        }
      } catch { /* invalid URL, fall through */ }
    }
    res.status(400).json({ error: 'Invalid or missing URL' });
  }
}

export const handleUnsubscribe = asyncHandler(async (req: Request, res: Response) => {
    const { guestId, propertyId } = req.params;
    const { email, reason, campaignId } = req.body;

    await marketingAutomationService.trackUnsubscribe(
      guestId,
      propertyId,
      email,
      reason,
      campaignId
    );

    res.json({
      success: true,
      message: 'You have been unsubscribed'
    });
});
// =============================================
// PROMO CODES
// =============================================

export const createPromoCode = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { code, discountType, discountValue, ...options } = req.body;

    const promo = await marketingAutomationService.createPromoCode(
      propertyId,
      code,
      discountType,
      discountValue,
      options
    );

    res.status(201).json({
      success: true,
      data: promo,
      message: 'Promo code created'
    });
});
export const validatePromoCode = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { code, guestId, nights, amount } = req.body;

    const result = await marketingAutomationService.validatePromoCode(
      propertyId,
      code,
      guestId,
      nights,
      amount
    );

    res.json({
      success: true,
      data: result
    });
});