/**
 * Device Management Controller
 * 
 * Handles device registration for push notifications.
 * Supports iOS, Android, and Web platforms.
 * 
 * @module modules/devices/controller
 */

import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

interface DeviceTokenPayload {
  deviceToken: string;
  platform: 'ios' | 'android' | 'web';
  deviceName?: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  notificationsEnabled?: boolean;
}

/**
 * Register or update a device token
 * POST /api/devices/register
 */
export async function registerDevice(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      deviceToken,
      platform,
      deviceName,
      appVersion,
      deviceModel,
      osVersion,
      notificationsEnabled = true,
    }: DeviceTokenPayload = req.body;

    // Validate required fields
    if (!deviceToken || typeof deviceToken !== 'string') {
      res.status(400).json({ error: 'Device token is required' });
      return;
    }

    if (!platform || !['ios', 'android', 'web'].includes(platform)) {
      res.status(400).json({ error: 'Invalid platform. Must be ios, android, or web' });
      return;
    }

    const supabase = getSupabase();

    // Check if this token already exists (regardless of user)
    const { data: existingToken, error: lookupError } = await supabase
      .from('device_tokens')
      .select('id, user_id')
      .eq('device_token', deviceToken)
      .maybeSingle();

    if (lookupError && lookupError.code !== 'PGRST116') {
      logger.error('Error looking up device token:', lookupError);
      res.status(500).json({ error: 'Database error' });
      return;
    }

    if (existingToken) {
      // Token exists - update it (possibly reassign to new user if they logged in on same device)
      const { data: updated, error: updateError } = await supabase
        .from('device_tokens')
        .update({
          user_id: userId,
          platform,
          device_name: deviceName || null,
          app_version: appVersion || null,
          device_model: deviceModel || null,
          os_version: osVersion || null,
          notifications_enabled: notificationsEnabled,
          is_active: true,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', existingToken.id)
        .select('id, platform, notifications_enabled, created_at, last_used_at')
        .single();

      if (updateError) {
        logger.error('Error updating device token:', updateError);
        res.status(500).json({ error: 'Failed to update device registration' });
        return;
      }

      logger.info(`Device token updated for user ${userId}, platform: ${platform}`);
      
      res.json({
        message: 'Device updated successfully',
        device: updated,
      });
      return;
    }

    // New token - insert it
    const { data: newDevice, error: insertError } = await supabase
      .from('device_tokens')
      .insert({
        user_id: userId,
        device_token: deviceToken,
        platform,
        device_name: deviceName || null,
        app_version: appVersion || null,
        device_model: deviceModel || null,
        os_version: osVersion || null,
        notifications_enabled: notificationsEnabled,
        is_active: true,
        last_used_at: new Date().toISOString(),
      })
      .select('id, platform, notifications_enabled, created_at, last_used_at')
      .single();

    if (insertError) {
      logger.error('Error inserting device token:', insertError);
      res.status(500).json({ error: 'Failed to register device' });
      return;
    }

    logger.info(`New device registered for user ${userId}, platform: ${platform}`);

    res.status(201).json({
      message: 'Device registered successfully',
      device: newDevice,
    });
  } catch (error) {
    logger.error('Device registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Unregister a device token
 * DELETE /api/devices/unregister
 */
export async function unregisterDevice(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { deviceToken } = req.body;

    if (!deviceToken || typeof deviceToken !== 'string') {
      res.status(400).json({ error: 'Device token is required' });
      return;
    }

    const supabase = getSupabase();

    // Soft delete - mark as inactive
    const { data, error } = await supabase
      .from('device_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('device_token', deviceToken)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Error unregistering device:', error);
      res.status(500).json({ error: 'Failed to unregister device' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    logger.info(`Device unregistered for user ${userId}`);

    res.json({ message: 'Device unregistered successfully' });
  } catch (error) {
    logger.error('Device unregistration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get user's registered devices
 * GET /api/devices
 */
export async function getUserDevices(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const supabase = getSupabase();

    const { data: devices, error } = await supabase
      .from('device_tokens')
      .select('id, platform, device_name, device_model, app_version, os_version, notifications_enabled, is_active, last_used_at, created_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_used_at', { ascending: false });

    if (error) {
      logger.error('Error fetching user devices:', error);
      res.status(500).json({ error: 'Failed to fetch devices' });
      return;
    }

    res.json({
      devices: devices || [],
      count: devices?.length || 0,
    });
  } catch (error) {
    logger.error('Get user devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Update device notification preferences
 * PATCH /api/devices/:deviceId/preferences
 */
export async function updateDevicePreferences(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { deviceId } = req.params;
    const { notificationsEnabled, deviceName } = req.body;

    if (typeof notificationsEnabled !== 'boolean' && typeof deviceName !== 'string') {
      res.status(400).json({ error: 'At least one preference must be provided' });
      return;
    }

    const supabase = getSupabase();

    // Build update object
    const updates: Record<string, unknown> = {};
    if (typeof notificationsEnabled === 'boolean') {
      updates.notifications_enabled = notificationsEnabled;
    }
    if (typeof deviceName === 'string') {
      updates.device_name = deviceName;
    }

    const { data, error } = await supabase
      .from('device_tokens')
      .update(updates)
      .eq('id', deviceId)
      .eq('user_id', userId)
      .select('id, platform, device_name, notifications_enabled')
      .single();

    if (error) {
      logger.error('Error updating device preferences:', error);
      res.status(500).json({ error: 'Failed to update device preferences' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    logger.info(`Device preferences updated for user ${userId}, device ${deviceId}`);

    res.json({
      message: 'Device preferences updated',
      device: data,
    });
  } catch (error) {
    logger.error('Update device preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Remove a specific device (hard delete)
 * DELETE /api/devices/:deviceId
 */
export async function removeDevice(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { deviceId } = req.params;

    const supabase = getSupabase();

    const { error } = await supabase
      .from('device_tokens')
      .delete()
      .eq('id', deviceId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error removing device:', error);
      res.status(500).json({ error: 'Failed to remove device' });
      return;
    }

    logger.info(`Device ${deviceId} removed for user ${userId}`);

    res.json({ message: 'Device removed successfully' });
  } catch (error) {
    logger.error('Remove device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Logout from all devices (invalidate all tokens)
 * POST /api/devices/logout-all
 */
export async function logoutAllDevices(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { exceptCurrent } = req.body;
    const currentToken = req.body.currentDeviceToken;

    const supabase = getSupabase();

    let query = supabase
      .from('device_tokens')
      .update({ is_active: false })
      .eq('user_id', userId);

    // Optionally exclude current device
    if (exceptCurrent && currentToken) {
      query = query.neq('device_token', currentToken);
    }

    const { error } = await query;

    if (error) {
      logger.error('Error logging out all devices:', error);
      res.status(500).json({ error: 'Failed to logout from all devices' });
      return;
    }

    logger.info(`All devices logged out for user ${userId}`);

    res.json({ message: 'Logged out from all devices successfully' });
  } catch (error) {
    logger.error('Logout all devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

