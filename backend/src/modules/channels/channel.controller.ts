import { Request, Response } from 'express';
import crypto from 'crypto';
import * as channelService from './channel.service.js';
import { getOTAAdapter, listOTAAdapters } from './adapters/ota-registry.js';

// ==================== CONNECTIONS ====================

export async function getConnections(req: Request, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;

    if (!propertyId) {
      res.status(400).json({ error: 'Property ID is required' });
      return;
    }

    const connections = await channelService.getConnections(propertyId);

    res.json({
      success: true,
      connections,
      available_channels: Object.values(channelService.CHANNELS),
      available_adapters: listOTAAdapters(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get connections';
    res.status(500).json({ error: message });
  }
}

export async function getConnection(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;

    const connection = await channelService.getConnection(connectionId);

    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    // Get mappings
    const [roomMappings, rateMappings, syncLog] = await Promise.all([
      channelService.getRoomMappings(connectionId),
      channelService.getRateMappings(connectionId),
      channelService.getSyncLog(connectionId, 20)
    ]);

    res.json({
      success: true,
      connection,
      room_mappings: roomMappings,
      rate_mappings: rateMappings,
      recent_activity: syncLog
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get connection';
    res.status(500).json({ error: message });
  }
}

export async function createConnection(req: Request, res: Response): Promise<void> {
  try {
    const { propertyId } = req.params;
    const { channel_code, hotel_code, siteminder_property_id } = req.body;

    if (!channel_code) {
      res.status(400).json({ error: 'Channel code is required' });
      return;
    }

    const connection = await channelService.createConnection(
      propertyId,
      channel_code,
      hotel_code,
      siteminder_property_id
    );

    res.status(201).json({
      success: true,
      message: 'Channel connection created',
      connection
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create connection';
    res.status(400).json({ error: message });
  }
}

export async function activateConnection(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;

    await channelService.activateConnection(connectionId);

    res.json({
      success: true,
      message: 'Connection activated successfully'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to activate connection';
    res.status(400).json({ error: message });
  }
}

export async function pauseConnection(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;

    await channelService.updateConnectionStatus(connectionId, 'paused');

    res.json({
      success: true,
      message: 'Connection paused'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to pause connection';
    res.status(400).json({ error: message });
  }
}

export async function deleteConnection(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;

    await channelService.deleteConnection(connectionId);

    res.json({
      success: true,
      message: 'Connection deleted'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete connection';
    res.status(500).json({ error: message });
  }
}

// ==================== ROOM MAPPINGS ====================

export async function getRoomMappings(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;

    const mappings = await channelService.getRoomMappings(connectionId);

    res.json({
      success: true,
      mappings
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get room mappings';
    res.status(500).json({ error: message });
  }
}

export async function createRoomMapping(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;
    const { room_type_id, channel_room_code, channel_room_name } = req.body;

    if (!room_type_id || !channel_room_code || !channel_room_name) {
      res.status(400).json({ error: 'room_type_id, channel_room_code, and channel_room_name are required' });
      return;
    }

    const mapping = await channelService.createRoomMapping(
      connectionId,
      room_type_id,
      channel_room_code,
      channel_room_name
    );

    res.status(201).json({
      success: true,
      mapping
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create room mapping';
    res.status(400).json({ error: message });
  }
}

export async function updateRoomMapping(req: Request, res: Response): Promise<void> {
  try {
    const { mappingId } = req.params;
    const { channel_room_code, channel_room_name, is_active } = req.body;

    // FIX: Iteration 16 - Whitelist allowed fields to prevent overwriting connection_id, id, etc.
    const updates: Record<string, any> = {};
    if (channel_room_code !== undefined) updates.channel_room_code = channel_room_code;
    if (channel_room_name !== undefined) updates.channel_room_name = channel_room_name;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields provided for update' });
      return;
    }

    await channelService.updateRoomMapping(mappingId, updates);

    res.json({
      success: true,
      message: 'Room mapping updated'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update room mapping';
    res.status(400).json({ error: message });
  }
}

export async function deleteRoomMapping(req: Request, res: Response): Promise<void> {
  try {
    const { mappingId } = req.params;

    await channelService.deleteRoomMapping(mappingId);

    res.json({
      success: true,
      message: 'Room mapping deleted'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete room mapping';
    res.status(500).json({ error: message });
  }
}

// ==================== RATE MAPPINGS ====================

export async function getRateMappings(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;

    const mappings = await channelService.getRateMappings(connectionId);

    res.json({
      success: true,
      mappings
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get rate mappings';
    res.status(500).json({ error: message });
  }
}

export async function createRateMapping(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;
    const { rate_plan_id, channel_rate_code, channel_rate_name, markup_type, markup_value, commission_rate } = req.body;

    if (!rate_plan_id || !channel_rate_code || !channel_rate_name) {
      res.status(400).json({ error: 'rate_plan_id, channel_rate_code, and channel_rate_name are required' });
      return;
    }

    const mapping = await channelService.createRateMapping(
      connectionId,
      rate_plan_id,
      channel_rate_code,
      channel_rate_name,
      { markupType: markup_type, markupValue: markup_value, commissionRate: commission_rate }
    );

    res.status(201).json({
      success: true,
      mapping
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create rate mapping';
    res.status(400).json({ error: message });
  }
}

// ==================== SYNC OPERATIONS ====================

export async function triggerAvailabilitySync(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;
    const { start_date, end_date } = req.body;

    const startDate = start_date ? new Date(start_date) : new Date();
    const endDate = end_date ? new Date(end_date) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const result = await channelService.pushAvailabilityForDateRange(
      connectionId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      message: `Availability sync completed: ${result.success} successful, ${result.failed} failed`,
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync availability';
    res.status(500).json({ error: message });
  }
}

export async function triggerRateSync(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      res.status(400).json({ error: 'Rate updates array is required' });
      return;
    }

    const result = await channelService.pushRates(connectionId, updates);

    res.json({
      success: true,
      message: `Rate sync completed: ${result.success} successful, ${result.failed} failed`,
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync rates';
    res.status(500).json({ error: message });
  }
}

export async function getSyncLog(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;
    const { limit } = req.query;

    const log = await channelService.getSyncLog(
      connectionId,
      limit ? parseInt(String(limit), 10) : 100
    );

    res.json({
      success: true,
      log
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get sync log';
    res.status(500).json({ error: message });
  }
}

// ==================== RESERVATIONS ====================

export async function getChannelReservations(req: Request, res: Response): Promise<void> {
  try {
    const { connectionId } = req.params;
    const { start_date, end_date, status, limit } = req.query;

    const reservations = await channelService.getChannelReservations(connectionId, {
      startDate: start_date ? String(start_date) : undefined,
      endDate: end_date ? String(end_date) : undefined,
      status: status ? String(status) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined
    });

    res.json({
      success: true,
      reservations
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get reservations';
    res.status(500).json({ error: message });
  }
}

// ==================== WEBHOOKS ====================

export async function handleSiteMinderWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { property_id, channel } = req.params;
    const payload = req.body;

    // SECURITY FIX (HIGH-007): Verify webhook signature
    const signature = req.headers['x-siteminder-signature'] as string;
    const webhookSecret = process.env.SITEMINDER_WEBHOOK_SECRET;

    if (webhookSecret) {
      if (!signature) {
        console.error('SiteMinder webhook missing signature header');
        res.status(401).json({ error: 'Missing webhook signature' });
        return;
      }

      // Compute expected HMAC-SHA256 signature
      const rawBody = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      // Timing-safe comparison to prevent timing attacks
      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);
      if (sigBuffer.length !== expectedBuffer.length ||
          !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        console.error('SiteMinder webhook signature mismatch');
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    await channelService.handleSiteMinderWebhook(property_id, channel, payload);

    res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('SiteMinder webhook error:', error);
    res.status(500).json({ error: message });
  }
}

// Generic OTA webhook for direct connections
export async function handleOTAWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { property_id, channel } = req.params;
    const payload = req.body;

    try {
      getOTAAdapter(String(channel).toLowerCase());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Adapter not registered';
      res.status(400).json({ error: message });
      return;
    }

    await channelService.handleSiteMinderWebhook(property_id, channel, payload);

    res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    res.status(500).json({ error: message });
  }
}

// ==================== FULL SYNC ====================

export async function triggerFullSync(req: Request, res: Response): Promise<void> {
  try {
    // Queue full sync for all active connections
    setImmediate(() => {
      channelService.syncAllActiveConnections().catch(console.error);
    });

    res.status(202).json({
      success: true,
      message: 'Full sync queued for all active connections'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to trigger full sync';
    res.status(500).json({ error: message });
  }
}
