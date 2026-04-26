/**
 * Guest Messaging Controller
 * Phase 4.3: HTTP endpoints for messaging operations
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { messagingService } from './messaging.service';
import { getSupabase } from '../../database/connection.js';

// =============================================
// CHANNEL CONFIGURATION
// =============================================

export const configureChannel = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { channelType, ...config } = req.body;

    const channelId = await messagingService.configureChannel(propertyId, channelType, config);

    res.status(201).json({
      success: true,
      data: { channelId },
      message: 'Channel configured'
    });
});
export const getChannel = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId, channelType } = req.params;

    const channel = await messagingService.getChannel(propertyId, channelType);

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    // Remove sensitive data
    delete channel.api_key_encrypted;

    res.json({
      success: true,
      data: channel
    });
});
export const verifyChannel = asyncHandler(async (req: Request, res: Response) => {
    const { channelId } = req.params;

    await messagingService.verifyChannel(channelId);

    res.json({
      success: true,
      message: 'Channel verified'
    });
});
// =============================================
// GUEST PREFERENCES
// =============================================

export const updateGuestPreferences = asyncHandler(async (req: Request, res: Response) => {
    const { guestId, propertyId } = req.params;

    await messagingService.updateGuestPreferences(guestId, propertyId, req.body);

    res.json({
      success: true,
      message: 'Preferences updated'
    });
});
export const getGuestPreferences = asyncHandler(async (req: Request, res: Response) => {
    const { guestId, propertyId } = req.params;

    const preferences = await messagingService.getGuestPreferences(guestId, propertyId);

    res.json({
      success: true,
      data: preferences
    });
});
// =============================================
// CONVERSATIONS
// =============================================

export const createConversation = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { channelType, guestIdentifier, guestId, bookingId, subject } = req.body;

    const conversation = await messagingService.createConversation(
      propertyId,
      channelType,
      guestIdentifier,
      { guestId, bookingId, subject }
    );

    res.status(201).json({
      success: true,
      data: conversation,
      message: 'Conversation created'
    });
});
export const getConversation = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;

    const conversation = await messagingService.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: conversation
    });
});
export const getPropertyConversations = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { status, channelType, assignedTo, priority, unreadOnly, page, limit } = req.query;

    const result = await messagingService.getPropertyConversations(
      propertyId,
      {
        status: status as string,
        channelType: channelType as string,
        assignedTo: assignedTo as string,
        priority: priority as string,
        unreadOnly: unreadOnly === 'true'
      },
      parseInt(page as string) || 1,
      parseInt(limit as string) || 20
    );

    res.json({
      success: true,
      data: result.conversations,
      total: result.total,
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 20
    });
});
export const assignConversation = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { staffId, department } = req.body;

    await messagingService.assignConversation(conversationId, staffId, department);

    res.json({
      success: true,
      message: 'Conversation assigned'
    });
});
export const updateConversationPriority = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { priority } = req.body;

    await messagingService.updateConversationPriority(conversationId, priority);

    res.json({
      success: true,
      message: 'Priority updated'
    });
});
export const resolveConversation = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { resolution } = req.body;

    await messagingService.resolveConversation(conversationId, resolution);

    res.json({
      success: true,
      message: 'Conversation resolved'
    });
});
export const reopenConversation = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;

    await messagingService.reopenConversation(conversationId);

    res.json({
      success: true,
      message: 'Conversation reopened'
    });
});
export const markConversationRead = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;

    await messagingService.markConversationRead(conversationId);

    res.json({
      success: true,
      message: 'Marked as read'
    });
});
// =============================================
// MESSAGES
// =============================================

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { content, messageType, mediaUrl, mediaType, templateId, templateParams } = req.body;
    const userId = req.user?.id;
    const userName = req.user?.email?.split('@')[0] || 'Staff';

    const message = await messagingService.sendMessage(
      conversationId,
      content,
      { type: 'staff', id: userId, name: userName },
      { messageType, mediaUrl, mediaType, templateId, templateParams }
    );

    res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent'
    });
});
export const getConversationMessages = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { page, limit } = req.query;

    const result = await messagingService.getConversationMessages(
      conversationId,
      parseInt(page as string) || 1,
      parseInt(limit as string) || 50
    );

    res.json({
      success: true,
      data: result.messages,
      total: result.total
    });
});
// =============================================
// TEMPLATES
// =============================================

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;

    const template = await messagingService.createTemplate(propertyId, req.body);

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created'
    });
});
export const getTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { templateId } = req.params;

    const template = await messagingService.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
});
export const getPropertyTemplates = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { channelType } = req.query;

    const templates = await messagingService.getPropertyTemplates(
      propertyId,
      channelType as string
    );

    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
});
export const renderTemplate = asyncHandler(async (req: Request, res: Response) => {
    const { templateId } = req.params;
    const { variables } = req.body;

    const content = await messagingService.renderTemplate(templateId, variables || {});

    res.json({
      success: true,
      data: { content }
    });
});
// =============================================
// CANNED RESPONSES
// =============================================

export const createCannedResponse = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const userId = req.user?.id;

    const responseId = await messagingService.createCannedResponse(propertyId, req.body, userId);

    res.status(201).json({
      success: true,
      data: { id: responseId },
      message: 'Canned response created'
    });
});
export const getCannedResponses = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { category } = req.query;

    const responses = await messagingService.getCannedResponses(propertyId, category as string);

    res.json({
      success: true,
      data: responses,
      count: responses.length
    });
});
export const useCannedResponse = asyncHandler(async (req: Request, res: Response) => {
    const { responseId } = req.params;

    const content = await messagingService.useCannedResponse(responseId);

    res.json({
      success: true,
      data: { content }
    });
});
// =============================================
// WEBHOOKS
// =============================================

export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const { channelId } = req.params;
    const eventType = req.headers['x-webhook-event'] as string || 'message.received';

    await messagingService.processWebhook(channelId, eventType, req.body);

    res.status(200).json({ success: true });
  } catch (error) {
    // Log error but return 200 to prevent webhook retries
    console.error('Webhook processing error:', error);
    res.status(200).json({ success: false });
  }
}

// =============================================
// ANALYTICS
// =============================================

export const getMessagingAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { propertyId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const analytics = await messagingService.getMessagingAnalytics(propertyId, start, end);

    res.json({
      success: true,
      data: analytics
    });
});

// =============================================
// PUBLIC INQUIRIES
// =============================================
export const submitInquiry = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const {
      name,
      email,
      phone,
      subject,
      message,
      moduleId,
      moduleSlug,
      moduleName,
    } = req.body as Record<string, any>;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, error: 'name, email, subject and message are required' });
    }

    let { data, error } = await supabase
      .from('support_inquiries')
      .insert({
        name,
        email,
        phone: phone || null,
        subject,
        message,
        status: 'new',
        metadata: {
          moduleId: moduleId || null,
          moduleSlug: moduleSlug || null,
          moduleName: moduleName || null,
        },
      })
      .select('id')
      .single();

    if (error && /metadata|column/i.test(String(error.message || error.details || ''))) {
      const fallback = await supabase
        .from('support_inquiries')
        .insert({
          name,
          email,
          phone: phone || null,
          subject,
          message,
          status: 'new',
        })
        .select('id')
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    res.status(201).json({ success: true, data, message: 'Inquiry submitted successfully' });
});