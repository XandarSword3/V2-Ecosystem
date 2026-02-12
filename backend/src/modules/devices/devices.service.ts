/**
 * Device Management Service
 * 
 * Business logic for device registration and push notification management.
 * Supports iOS, Android, and Web platforms.
 * 
 * @module modules/devices/service
 */

import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

export interface DeviceTokenPayload {
  deviceToken: string;
  platform: 'ios' | 'android' | 'web';
  deviceName?: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  notificationsEnabled?: boolean;
}

export interface DeviceRecord {
  id: string;
  user_id: string;
  device_token: string;
  platform: 'ios' | 'android' | 'web';
  device_name: string | null;
  app_version: string | null;
  device_model: string | null;
  os_version: string | null;
  notifications_enabled: boolean;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
}

export interface DeviceSummary {
  id: string;
  platform: string;
  device_name?: string | null;
  device_model?: string | null;
  app_version?: string | null;
  os_version?: string | null;
  notifications_enabled: boolean;
  is_active?: boolean;
  last_used_at: string;
  created_at: string;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Find device by token
 */
export async function findDeviceByToken(deviceToken: string): Promise<ServiceResult<{ id: string; user_id: string } | null>> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('device_tokens')
      .select('id, user_id')
      .eq('device_token', deviceToken)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error looking up device token:', error);
      return { success: false, error: 'Database error' };
    }

    return { success: true, data };
  } catch (error) {
    logger.error('Find device by token error:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Register a new device token
 */
export async function registerDeviceToken(
  userId: string,
  payload: DeviceTokenPayload
): Promise<ServiceResult<DeviceSummary>> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('device_tokens')
      .insert({
        user_id: userId,
        device_token: payload.deviceToken,
        platform: payload.platform,
        device_name: payload.deviceName || null,
        app_version: payload.appVersion || null,
        os_version: payload.osVersion || null,
        notifications_enabled: payload.notificationsEnabled ?? true,
        is_active: true,
        last_used_at: new Date().toISOString(),
      })
      .select('id, platform, notifications_enabled, created_at, last_used_at')
      .single();

    if (error) {
      logger.error('Error inserting device token:', error);
      return { success: false, error: 'Failed to register device' };
    }

    logger.info(`New device registered for user ${userId}, platform: ${payload.platform}`);
    return { success: true, data };
  } catch (error) {
    logger.error('Register device token error:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Update an existing device token
 */
export async function updateDeviceToken(
  deviceId: string,
  userId: string,
  payload: Partial<DeviceTokenPayload>
): Promise<ServiceResult<DeviceSummary>> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('device_tokens')
      .update({
        user_id: userId,
        platform: payload.platform,
        device_name: payload.deviceName || null,
        app_version: payload.appVersion || null,
        os_version: payload.osVersion || null,
        notifications_enabled: payload.notificationsEnabled ?? true,
        is_active: true,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', deviceId)
      .select('id, platform, notifications_enabled, created_at, last_used_at')
      .single();

    if (error) {
      logger.error('Error updating device token:', error);
      return { success: false, error: 'Failed to update device registration' };
    }

    logger.info(`Device token updated for user ${userId}, platform: ${payload.platform}`);
    return { success: true, data };
  } catch (error) {
    logger.error('Update device token error:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Unregister (soft delete) a device token
 */
export async function unregisterDeviceToken(
  userId: string,
  deviceToken: string
): Promise<ServiceResult<{ id: string } | null>> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('device_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('device_token', deviceToken)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Error unregistering device:', error);
      return { success: false, error: 'Failed to unregister device' };
    }

    if (data) {
      logger.info(`Device unregistered for user ${userId}`);
    }
    
    return { success: true, data };
  } catch (error) {
    logger.error('Unregister device token error:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Get all active devices for a user
 */
export async function getUserDevices(userId: string): Promise<ServiceResult<DeviceSummary[]>> {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('device_tokens')
      .select('id, platform, device_name, app_version, os_version, notifications_enabled, is_active, last_used_at, created_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_used_at', { ascending: false });

    if (error) {
      logger.error('Error fetching user devices:', error);
      return { success: false, error: 'Failed to fetch devices' };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Get user devices error:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Update device preferences (notifications, name)
 */
export async function updateDevicePreferences(
  deviceId: string,
  userId: string,
  preferences: { notificationsEnabled?: boolean; deviceName?: string }
): Promise<ServiceResult<DeviceSummary | null>> {
  try {
    const supabase = getSupabase();
    
    const updates: Record<string, unknown> = {};
    if (typeof preferences.notificationsEnabled === 'boolean') {
      updates.notifications_enabled = preferences.notificationsEnabled;
    }
    if (typeof preferences.deviceName === 'string') {
      updates.device_name = preferences.deviceName;
    }

    const { data, error } = await supabase
      .from('device_tokens')
      .update(updates)
      .eq('id', deviceId)
      .eq('user_id', userId)
      .select('id, platform, device_name, notifications_enabled, last_used_at, created_at')
      .single();

    if (error) {
      logger.error('Error updating device preferences:', error);
      return { success: false, error: 'Failed to update device preferences' };
    }

    if (data) {
      logger.info(`Device preferences updated for user ${userId}, device ${deviceId}`);
    }
    
    return { success: true, data };
  } catch (error) {
    logger.error('Update device preferences error:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Remove a device (hard delete)
 */
export async function removeDevice(deviceId: string, userId: string): Promise<ServiceResult<void>> {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('device_tokens')
      .delete()
      .eq('id', deviceId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error removing device:', error);
      return { success: false, error: 'Failed to remove device' };
    }

    logger.info(`Device ${deviceId} removed for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error('Remove device error:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Logout from all devices (mark all as inactive)
 */
export async function logoutAllDevices(
  userId: string,
  options?: { exceptToken?: string }
): Promise<ServiceResult<void>> {
  try {
    const supabase = getSupabase();
    
    let query = supabase
      .from('device_tokens')
      .update({ is_active: false })
      .eq('user_id', userId);

    if (options?.exceptToken) {
      query = query.neq('device_token', options.exceptToken);
    }

    const { error } = await query;

    if (error) {
      logger.error('Error logging out all devices:', error);
      return { success: false, error: 'Failed to logout from all devices' };
    }

    logger.info(`All devices logged out for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error('Logout all devices error:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Get active device tokens for sending push notifications
 */
export async function getActiveDeviceTokens(
  userId: string,
  platform?: 'ios' | 'android' | 'web'
): Promise<ServiceResult<Array<{ device_token: string; platform: string }>>> {
  try {
    const supabase = getSupabase();
    
    let query = supabase
      .from('device_tokens')
      .select('device_token, platform')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('notifications_enabled', true);

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching active device tokens:', error);
      return { success: false, error: 'Failed to fetch device tokens' };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Get active device tokens error:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Bulk get active device tokens for multiple users
 */
export async function getBulkActiveDeviceTokens(
  userIds: string[],
  platform?: 'ios' | 'android' | 'web'
): Promise<ServiceResult<Array<{ user_id: string; device_token: string; platform: string }>>> {
  try {
    if (userIds.length === 0) {
      return { success: true, data: [] };
    }

    const supabase = getSupabase();
    
    let query = supabase
      .from('device_tokens')
      .select('user_id, device_token, platform')
      .in('user_id', userIds)
      .eq('is_active', true)
      .eq('notifications_enabled', true);

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching bulk device tokens:', error);
      return { success: false, error: 'Failed to fetch device tokens' };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    logger.error('Get bulk active device tokens error:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Clean up stale device tokens (not used in N days)
 */
export async function cleanupStaleDevices(daysInactive: number = 90): Promise<ServiceResult<number>> {
  try {
    const supabase = getSupabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const { data, error } = await supabase
      .from('device_tokens')
      .delete()
      .lt('last_used_at', cutoffDate.toISOString())
      .eq('is_active', false)
      .select('id');

    if (error) {
      logger.error('Error cleaning up stale devices:', error);
      return { success: false, error: 'Failed to cleanup stale devices' };
    }

    const count = data?.length || 0;
    logger.info(`Cleaned up ${count} stale device tokens`);
    return { success: true, data: count };
  } catch (error) {
    logger.error('Cleanup stale devices error:', error);
    return { success: false, error: 'Internal error' };
  }
}
