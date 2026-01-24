import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { logActivity } from '../../../utils/activityLogger.js';

/**
 * Soft Delete Controller
 * Provides soft delete and restore functionality for critical entities
 */

type SoftDeleteEntity = 'users' | 'chalet_bookings' | 'restaurant_orders' | 'pool_tickets' | 'chalets';

interface SoftDeletedRecord {
  id: string;
  identifier: string;
  deleted_at: string;
  deleted_by: string | null;
}

/**
 * GET /api/admin/deleted/:entityType
 * Returns list of soft-deleted records for an entity type
 */
export async function getDeletedRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { entityType } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const supabase = getSupabase();

    // Validate entity type
    const validTypes: SoftDeleteEntity[] = ['users', 'chalet_bookings', 'restaurant_orders', 'pool_tickets', 'chalets'];
    if (!validTypes.includes(entityType as SoftDeleteEntity)) {
      res.status(400).json({
        success: false,
        error: `Invalid entity type. Valid types: ${validTypes.join(', ')}`,
      });
      return;
    }

    // Get select fields based on entity type
    let selectFields = 'id, deleted_at, deleted_by';
    switch (entityType) {
      case 'users':
        selectFields += ', email, full_name';
        break;
      case 'chalet_bookings':
        selectFields += ', booking_number, customer_name';
        break;
      case 'restaurant_orders':
        selectFields += ', order_number, customer_name';
        break;
      case 'pool_tickets':
        selectFields += ', ticket_number, guest_name';
        break;
      case 'chalets':
        selectFields += ', name';
        break;
    }

    const { data, error, count } = await supabase
      .from(entityType)
      .select(selectFields, { count: 'exact' })
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    // Map to consistent format
    const records: SoftDeletedRecord[] = (data || []).map((record: any) => {
      let identifier = '';
      switch (entityType) {
        case 'users':
          identifier = record.email || record.full_name;
          break;
        case 'chalet_bookings':
          identifier = record.booking_number;
          break;
        case 'restaurant_orders':
          identifier = record.order_number;
          break;
        case 'pool_tickets':
          identifier = record.ticket_number;
          break;
        case 'chalets':
          identifier = record.name;
          break;
      }
      return {
        id: record.id,
        identifier,
        deleted_at: record.deleted_at,
        deleted_by: record.deleted_by,
      };
    });

    res.json({
      success: true,
      data: records,
      pagination: { total: count, limit: Number(limit), offset: Number(offset) },
    });
  } catch (error: any) {
    logger.error('Error fetching deleted records', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/admin/deleted/:entityType/:entityId/restore
 * Restores a soft-deleted record
 */
export async function restoreRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { entityType, entityId } = req.params;
    const userId = (req as any).user?.userId;
    const supabase = getSupabase();

    // Validate entity type
    const validTypes: SoftDeleteEntity[] = ['users', 'chalet_bookings', 'restaurant_orders', 'pool_tickets', 'chalets'];
    if (!validTypes.includes(entityType as SoftDeleteEntity)) {
      res.status(400).json({
        success: false,
        error: `Invalid entity type. Valid types: ${validTypes.join(', ')}`,
      });
      return;
    }

    // Verify record exists and is deleted
    const { data: existing, error: fetchError } = await supabase
      .from(entityType)
      .select('id, deleted_at')
      .eq('id', entityId)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    if (!existing.deleted_at) {
      res.status(400).json({ success: false, error: 'Record is not deleted' });
      return;
    }

    // Restore the record
    const { data, error } = await supabase
      .from(entityType)
      .update({
        deleted_at: null,
        deleted_by: null,
        is_active: true, // Also reactivate if applicable
      })
      .eq('id', entityId)
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: userId,
      action: 'RESTORE_RECORD',
      resource: entityType,
      resource_id: entityId,
      details: { restored_by: userId },
    });

    logger.info(`Record restored: ${entityType}:${entityId}`, { userId });

    res.json({
      success: true,
      message: 'Record restored successfully',
      data,
    });
  } catch (error: any) {
    logger.error('Error restoring record', { error: error.message });
    next(error);
  }
}

/**
 * DELETE /api/admin/deleted/:entityType/:entityId/permanent
 * Permanently deletes a soft-deleted record (requires force=true query param)
 */
export async function permanentDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { entityType, entityId } = req.params;
    const { force } = req.query;
    const userId = (req as any).user?.userId;
    const supabase = getSupabase();

    if (force !== 'true') {
      res.status(400).json({
        success: false,
        error: 'Permanent deletion requires force=true query parameter',
      });
      return;
    }

    // Validate entity type
    const validTypes: SoftDeleteEntity[] = ['users', 'chalet_bookings', 'restaurant_orders', 'pool_tickets', 'chalets'];
    if (!validTypes.includes(entityType as SoftDeleteEntity)) {
      res.status(400).json({
        success: false,
        error: `Invalid entity type. Valid types: ${validTypes.join(', ')}`,
      });
      return;
    }

    // Verify record is already soft-deleted
    const { data: existing, error: fetchError } = await supabase
      .from(entityType)
      .select('id, deleted_at')
      .eq('id', entityId)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    if (!existing.deleted_at) {
      res.status(400).json({ 
        success: false, 
        error: 'Record must be soft-deleted first before permanent deletion',
      });
      return;
    }

    // Permanently delete the record
    const { error } = await supabase
      .from(entityType)
      .delete()
      .eq('id', entityId);

    if (error) throw error;

    await logActivity({
      user_id: userId,
      action: 'PERMANENT_DELETE',
      resource: entityType,
      resource_id: entityId,
      details: { deleted_by: userId },
    });

    logger.warn(`Record permanently deleted: ${entityType}:${entityId}`, { userId });

    res.json({
      success: true,
      message: 'Record permanently deleted',
    });
  } catch (error: any) {
    logger.error('Error permanently deleting record', { error: error.message });
    next(error);
  }
}

/**
 * POST /api/admin/soft-delete/:entityType/:entityId
 * Soft deletes a record
 */
export async function softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { entityType, entityId } = req.params;
    const userId = (req as any).user?.userId;
    const supabase = getSupabase();

    // Validate entity type
    const validTypes: SoftDeleteEntity[] = ['users', 'chalet_bookings', 'restaurant_orders', 'pool_tickets', 'chalets'];
    if (!validTypes.includes(entityType as SoftDeleteEntity)) {
      res.status(400).json({
        success: false,
        error: `Invalid entity type. Valid types: ${validTypes.join(', ')}`,
      });
      return;
    }

    // Verify record exists and is not already deleted
    const { data: existing, error: fetchError } = await supabase
      .from(entityType)
      .select('id, deleted_at')
      .eq('id', entityId)
      .single();

    if (fetchError || !existing) {
      res.status(404).json({ success: false, error: 'Record not found' });
      return;
    }

    if (existing.deleted_at) {
      res.status(400).json({ success: false, error: 'Record is already deleted' });
      return;
    }

    // Soft delete the record
    const { data, error } = await supabase
      .from(entityType)
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        is_active: false,
      })
      .eq('id', entityId)
      .select()
      .single();

    if (error) throw error;

    await logActivity({
      user_id: userId,
      action: 'SOFT_DELETE',
      resource: entityType,
      resource_id: entityId,
      details: { deleted_by: userId },
    });

    logger.info(`Record soft deleted: ${entityType}:${entityId}`, { userId });

    res.json({
      success: true,
      message: 'Record soft deleted successfully',
      data,
    });
  } catch (error: any) {
    logger.error('Error soft deleting record', { error: error.message });
    next(error);
  }
}
