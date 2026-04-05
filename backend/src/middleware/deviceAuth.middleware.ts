/**
 * Device Authentication Middleware
 * 
 * Verifies kiosk device identity via device token in the X-Device-Token header.
 * Kiosk devices authenticate using a token issued during device registration
 * rather than user JWT, since they operate without human login.
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware that verifies the X-Device-Token header against registered kiosk devices.
 * Sets req.deviceId on success for downstream handlers.
 */
export async function authenticateDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  const deviceToken = req.headers['x-device-token'] as string;

  if (!deviceToken) {
    res.status(401).json({ success: false, error: 'Device token required' });
    return;
  }

  // Validate token format (UUID v4)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceToken)) {
    res.status(401).json({ success: false, error: 'Invalid device token format' });
    return;
  }

  // Verify against database
  const supabase = getSupabase();
  try {
    const { data: device, error } = await supabase
      .from('kiosk_devices')
      .select('id, property_id, status')
      .eq('device_token', deviceToken)
      .eq('is_active', true)
      .single();

    if (error || !device) {
      logger.warn('Device authentication failed', {
        token: deviceToken.substring(0, 8) + '...',
        ip: req.ip,
      });
      res.status(401).json({ success: false, error: 'Invalid or inactive device' });
      return;
    }

    // Attach device info to request for downstream use
    (req as any).deviceId = device.id;
    (req as any).devicePropertyId = device.property_id;
    next();
  } catch (err: unknown) {
    logger.error('Device auth error:', err);
    res.status(500).json({ success: false, error: 'Device authentication failed' });
  }
}
