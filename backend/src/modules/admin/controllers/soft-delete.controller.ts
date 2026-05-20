import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { logActivity } from '../../../utils/activityLogger.js';

/**
 * Soft Delete Controller
 * Provides soft delete and restore functionality for critical entities
 */

type SoftDeleteEntity = 'users' | 'transactions' | 'accommodation_units';

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
export const getDeletedRecords = asyncHandler(async (req: Request, res: Response) => {
    const { entityType } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
    const supabase = getSupabase();

    // Validate entity type
    const validTypes: SoftDeleteEntity[] = ['users', 'transactions', 'accommodation_units'];
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
      case 'transactions':
        selectFields += ', ticket_number, order_number, booking_number, customer_name';
        break;
      case 'accommodation_units':
        selectFields += ', name';
        break;
    }

    let query = supabase.from(entityType).select(selectFields, { count: 'exact' });

    if (propertyId) {
      if (entityType === 'users') {
        const { data: userAccess } = await supabase
          .from('user_property_access')
          .select('user_id')
          .eq('property_id', propertyId);
        
        const userIds = (userAccess || []).map((ua: any) => ua.user_id);
        query = query.in('id', userIds);
      } else {
        query = query.eq('property_id', propertyId);
      }
    }

    const { data, error, count } = await query
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
        case 'transactions':
          identifier = record.ticket_number || record.order_number || record.booking_number || record.customer_name;
          break;
        case 'accommodation_units':
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
});

/**
 * POST /api/admin/deleted/:entityType/:entityId/restore
 * Restores a soft-deleted record
 */
export const restoreRecord = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.params;
    const userId = req.user?.userId;
    if (!userId) throw new Error('Authentication required');
    const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
    const supabase = getSupabase();

    // Validate entity type
    const validTypes: SoftDeleteEntity[] = ['users', 'transactions', 'accommodation_units'];
    if (!validTypes.includes(entityType as SoftDeleteEntity)) {
      res.status(400).json({
        success: false,
        error: `Invalid entity type. Valid types: ${validTypes.join(', ')}`,
      });
      return;
    }

    // Verify record exists and belongs to property
    let fetchQuery = supabase.from(entityType).select('id, deleted_at');
    
    if (propertyId) {
      if (entityType === 'users') {
        const { data: access } = await supabase
          .from('user_property_access')
          .select('id')
          .eq('user_id', entityId)
          .eq('property_id', propertyId)
          .limit(1);
        
        if (!access || access.length === 0) {
          res.status(404).json({ success: false, error: 'Record not found in this property context' });
          return;
        }
      } else {
        fetchQuery = fetchQuery.eq('property_id', propertyId);
      }
    }

    const { data: existing, error: fetchError } = await fetchQuery
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
    let updateQuery = supabase
      .from(entityType)
      .update({
        deleted_at: null,
        deleted_by: null,
        is_active: true, // Also reactivate if applicable
      })
      .eq('id', entityId);

    if (propertyId && entityType !== 'users') {
      updateQuery = updateQuery.eq('property_id', propertyId);
    }

    const { data, error } = await updateQuery
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
});

/**
 * DELETE /api/admin/deleted/:entityType/:entityId/permanent
 * Permanently deletes a soft-deleted record (requires force=true query param)
 */
export const permanentDelete = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.params;
    const { force } = req.query;
    const userId = req.user?.userId;
    if (!userId) throw new Error('Authentication required');
    const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
    const supabase = getSupabase();

    if (force !== 'true') {
      res.status(400).json({
        success: false,
        error: 'Permanent deletion requires force=true query parameter',
      });
      return;
    }

    // Validate entity type
    const validTypes: SoftDeleteEntity[] = ['users', 'transactions', 'accommodation_units'];
    if (!validTypes.includes(entityType as SoftDeleteEntity)) {
      res.status(400).json({
        success: false,
        error: `Invalid entity type. Valid types: ${validTypes.join(', ')}`,
      });
      return;
    }

    // Verify record is already soft-deleted and belongs to property
    let fetchQuery = supabase.from(entityType).select('id, deleted_at');
    
    if (propertyId) {
      if (entityType === 'users') {
        const { data: access } = await supabase
          .from('user_property_access')
          .select('id')
          .eq('user_id', entityId)
          .eq('property_id', propertyId)
          .limit(1);
        
        if (!access || access.length === 0) {
          res.status(404).json({ success: false, error: 'Record not found in this property context' });
          return;
        }
      } else {
        fetchQuery = fetchQuery.eq('property_id', propertyId);
      }
    }

    const { data: existing, error: fetchError } = await fetchQuery
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
    let deleteQuery = supabase
      .from(entityType)
      .delete()
      .eq('id', entityId);

    if (propertyId && entityType !== 'users') {
      deleteQuery = deleteQuery.eq('property_id', propertyId);
    }

    const { error } = await deleteQuery;

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
});

/**
 * POST /api/admin/soft-delete/:entityType/:entityId
 * Soft deletes a record
 */
export const softDelete = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.params;
    const userId = req.user?.userId;
    if (!userId) throw new Error('Authentication required');
    const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
    const supabase = getSupabase();

    // Validate entity type
    const validTypes: SoftDeleteEntity[] = ['users', 'transactions', 'accommodation_units'];
    if (!validTypes.includes(entityType as SoftDeleteEntity)) {
      res.status(400).json({
        success: false,
        error: `Invalid entity type. Valid types: ${validTypes.join(', ')}`,
      });
      return;
    }

    // Verify record exists, belongs to property, and is not already deleted
    let fetchQuery = supabase.from(entityType).select('id, deleted_at');
    
    if (propertyId) {
      if (entityType === 'users') {
        const { data: access } = await supabase
          .from('user_property_access')
          .select('id')
          .eq('user_id', entityId)
          .eq('property_id', propertyId)
          .limit(1);
        
        if (!access || access.length === 0) {
          res.status(404).json({ success: false, error: 'Record not found in this property context' });
          return;
        }
      } else {
        fetchQuery = fetchQuery.eq('property_id', propertyId);
      }
    }

    const { data: existing, error: fetchError } = await fetchQuery
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
    let updateQuery = supabase
      .from(entityType)
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        is_active: false,
      })
      .eq('id', entityId);

    if (propertyId && entityType !== 'users') {
      updateQuery = updateQuery.eq('property_id', propertyId);
    }

    const { data, error } = await updateQuery
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
});
