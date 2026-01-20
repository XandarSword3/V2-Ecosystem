import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';

/**
 * Delete Preview Controller
 * Provides impact analysis before deleting resources
 * Shows all affected/related data that would be impacted
 */

type EntityType = 'user' | 'booking' | 'staff' | 'chalet' | 'menu_item' | 'table' | 'module';

interface RelatedEntity {
  table: string;
  count: number;
  examples?: Array<{ id: string; identifier: string }>;
}

interface DeletePreviewResult {
  entity: {
    type: EntityType;
    id: string;
    identifier: string; // Human-readable name/number
    created_at?: string;
  };
  impact: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    warnings: string[];
  };
  relatedEntities: RelatedEntity[];
  recommendations: string[];
  canDelete: boolean;
  requiresForce: boolean;
}

/**
 * GET /api/admin/delete-preview/:entityType/:entityId
 * Returns impact analysis for deleting an entity
 */
export async function getDeletePreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { entityType, entityId } = req.params;
    const supabase = getSupabase();

    // Validate entity type
    const validTypes: EntityType[] = ['user', 'booking', 'staff', 'chalet', 'menu_item', 'table', 'module'];
    if (!validTypes.includes(entityType as EntityType)) {
      res.status(400).json({
        success: false,
        error: `Invalid entity type. Valid types: ${validTypes.join(', ')}`,
      });
      return;
    }

    let result: DeletePreviewResult;

    switch (entityType as EntityType) {
      case 'user':
        result = await getUserDeletePreview(supabase, entityId);
        break;
      case 'booking':
        result = await getBookingDeletePreview(supabase, entityId);
        break;
      case 'staff':
        result = await getStaffDeletePreview(supabase, entityId);
        break;
      case 'chalet':
        result = await getChaletDeletePreview(supabase, entityId);
        break;
      case 'menu_item':
        result = await getMenuItemDeletePreview(supabase, entityId);
        break;
      case 'table':
        result = await getTableDeletePreview(supabase, entityId);
        break;
      case 'module':
        result = await getModuleDeletePreview(supabase, entityId);
        break;
      default:
        res.status(400).json({ success: false, error: 'Unsupported entity type' });
        return;
    }

    logger.info(`Delete preview requested for ${entityType}:${entityId}`, {
      severity: result.impact.severity,
      canDelete: result.canDelete,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error generating delete preview', { error: error.message });
    next(error);
  }
}

/**
 * User delete preview
 */
async function getUserDeletePreview(supabase: any, userId: string): Promise<DeletePreviewResult> {
  // Get user info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, created_at')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  // Count related data
  const [
    bookingsResult,
    ordersResult,
    poolTicketsResult,
    reviewsResult,
    sessionsResult,
    rolesResult,
  ] = await Promise.all([
    supabase.from('chalet_bookings').select('id, booking_number', { count: 'exact' }).eq('user_id', userId).limit(5),
    supabase.from('restaurant_orders').select('id, order_number', { count: 'exact' }).eq('user_id', userId).limit(5),
    supabase.from('pool_tickets').select('id, ticket_number', { count: 'exact' }).eq('user_id', userId).limit(5),
    supabase.from('reviews').select('id, rating', { count: 'exact' }).eq('user_id', userId).limit(5),
    supabase.from('user_sessions').select('id', { count: 'exact' }).eq('user_id', userId),
    supabase.from('user_roles').select('role_id', { count: 'exact' }).eq('user_id', userId),
  ]);

  const relatedEntities: RelatedEntity[] = [
    { table: 'chalet_bookings', count: bookingsResult.count || 0, examples: bookingsResult.data?.map((b: any) => ({ id: b.id, identifier: b.booking_number })) },
    { table: 'restaurant_orders', count: ordersResult.count || 0, examples: ordersResult.data?.map((o: any) => ({ id: o.id, identifier: o.order_number })) },
    { table: 'pool_tickets', count: poolTicketsResult.count || 0, examples: poolTicketsResult.data?.map((t: any) => ({ id: t.id, identifier: t.ticket_number })) },
    { table: 'reviews', count: reviewsResult.count || 0 },
    { table: 'user_sessions', count: sessionsResult.count || 0 },
    { table: 'user_roles', count: rolesResult.count || 0 },
  ].filter(e => e.count > 0);

  const totalRelated = relatedEntities.reduce((sum, e) => sum + e.count, 0);
  const hasActiveBookings = bookingsResult.data?.some((b: any) => ['pending', 'confirmed', 'checked_in'].includes(b.status));

  // Determine severity
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (hasActiveBookings) {
    severity = 'critical';
    warnings.push('User has active bookings that must be cancelled or completed first');
    recommendations.push('Complete or cancel all active bookings before deleting');
  } else if (totalRelated > 100) {
    severity = 'high';
    warnings.push(`User has ${totalRelated} related records that will be affected`);
    recommendations.push('Consider anonymizing instead of deleting (GDPR compliant)');
  } else if (totalRelated > 10) {
    severity = 'medium';
    warnings.push(`User has ${totalRelated} related records`);
  }

  recommendations.push('User data can be anonymized via GDPR endpoint instead');

  return {
    entity: {
      type: 'user',
      id: userId,
      identifier: user.email || user.full_name,
      created_at: user.created_at,
    },
    impact: {
      severity,
      message: `Deleting this user will affect ${totalRelated} related records`,
      warnings,
    },
    relatedEntities,
    recommendations,
    canDelete: !hasActiveBookings,
    requiresForce: totalRelated > 50,
  };
}

/**
 * Booking delete preview
 */
async function getBookingDeletePreview(supabase: any, bookingId: string): Promise<DeletePreviewResult> {
  const { data: booking, error } = await supabase
    .from('chalet_bookings')
    .select('id, booking_number, status, check_in_date, check_out_date, total_amount, user_id, created_at')
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    throw new Error('Booking not found');
  }

  const [paymentsResult, addOnsResult] = await Promise.all([
    supabase.from('payments').select('id, amount', { count: 'exact' }).eq('booking_id', bookingId),
    supabase.from('chalet_booking_addons').select('id', { count: 'exact' }).eq('booking_id', bookingId),
  ]);

  const relatedEntities: RelatedEntity[] = [
    { table: 'payments', count: paymentsResult.count || 0 },
    { table: 'booking_addons', count: addOnsResult.count || 0 },
  ].filter(e => e.count > 0);

  const warnings: string[] = [];
  const recommendations: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  
  const activeStatuses = ['pending', 'confirmed', 'checked_in'];
  if (activeStatuses.includes(booking.status)) {
    severity = 'critical';
    warnings.push(`Booking is currently ${booking.status} - cannot delete active booking`);
    recommendations.push('Cancel the booking first using the status update endpoint');
  }

  if (paymentsResult.count > 0) {
    severity = severity === 'critical' ? 'critical' : 'high';
    warnings.push(`${paymentsResult.count} payment record(s) will be orphaned`);
    recommendations.push('Ensure refunds are processed before deletion');
  }

  return {
    entity: {
      type: 'booking',
      id: bookingId,
      identifier: booking.booking_number,
      created_at: booking.created_at,
    },
    impact: {
      severity,
      message: `Booking ${booking.booking_number} (${booking.status})`,
      warnings,
    },
    relatedEntities,
    recommendations,
    canDelete: !activeStatuses.includes(booking.status),
    requiresForce: paymentsResult.count > 0,
  };
}

/**
 * Staff delete preview
 */
async function getStaffDeletePreview(supabase: any, staffId: string): Promise<DeletePreviewResult> {
  const { data: staff, error } = await supabase
    .from('users')
    .select('id, email, full_name, created_at')
    .eq('id', staffId)
    .single();

  if (error || !staff) {
    throw new Error('Staff member not found');
  }

  const [
    shiftsResult,
    assignmentsResult,
    housekeepingResult,
    ordersAssignedResult,
  ] = await Promise.all([
    supabase.from('staff_shifts').select('id', { count: 'exact' }).eq('staff_id', staffId),
    supabase.from('staff_assignments').select('id', { count: 'exact' }).eq('staff_id', staffId),
    supabase.from('housekeeping_tasks').select('id', { count: 'exact' }).eq('assigned_to', staffId),
    supabase.from('restaurant_orders').select('id', { count: 'exact' }).eq('assigned_staff_id', staffId),
  ]);

  const relatedEntities: RelatedEntity[] = [
    { table: 'staff_shifts', count: shiftsResult.count || 0 },
    { table: 'staff_assignments', count: assignmentsResult.count || 0 },
    { table: 'housekeeping_tasks', count: housekeepingResult.count || 0 },
    { table: 'assigned_orders', count: ordersAssignedResult.count || 0 },
  ].filter(e => e.count > 0);

  const totalRelated = relatedEntities.reduce((sum, e) => sum + e.count, 0);
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // Check for upcoming shifts
  const { count: upcomingShifts } = await supabase
    .from('staff_shifts')
    .select('id', { count: 'exact' })
    .eq('staff_id', staffId)
    .gte('start_time', new Date().toISOString());

  if (upcomingShifts && upcomingShifts > 0) {
    severity = 'high';
    warnings.push(`Staff member has ${upcomingShifts} upcoming shift(s)`);
    recommendations.push('Reassign shifts before removing staff member');
  }

  if (totalRelated > 50) {
    severity = severity === 'high' ? 'high' : 'medium';
    warnings.push(`Staff has ${totalRelated} historical records`);
  }

  recommendations.push('Consider deactivating the account instead of deleting');
  recommendations.push('Historical records will be preserved for audit purposes');

  return {
    entity: {
      type: 'staff',
      id: staffId,
      identifier: staff.full_name || staff.email,
      created_at: staff.created_at,
    },
    impact: {
      severity,
      message: `Removing staff member will affect ${totalRelated} records`,
      warnings,
    },
    relatedEntities,
    recommendations,
    canDelete: !upcomingShifts || upcomingShifts === 0,
    requiresForce: totalRelated > 20,
  };
}

/**
 * Chalet delete preview
 */
async function getChaletDeletePreview(supabase: any, chaletId: string): Promise<DeletePreviewResult> {
  const { data: chalet, error } = await supabase
    .from('chalets')
    .select('id, name, created_at')
    .eq('id', chaletId)
    .single();

  if (error || !chalet) {
    throw new Error('Chalet not found');
  }

  const [bookingsResult, addOnsResult, imagesResult] = await Promise.all([
    supabase.from('chalet_bookings').select('id, booking_number, status', { count: 'exact' }).eq('chalet_id', chaletId).limit(10),
    supabase.from('chalet_add_ons').select('id', { count: 'exact' }).eq('chalet_id', chaletId),
    supabase.from('chalet_images').select('id', { count: 'exact' }).eq('chalet_id', chaletId),
  ]);

  const activeBookings = bookingsResult.data?.filter((b: any) => 
    ['pending', 'confirmed', 'checked_in'].includes(b.status)
  ).length || 0;

  const relatedEntities: RelatedEntity[] = [
    { table: 'chalet_bookings', count: bookingsResult.count || 0, examples: bookingsResult.data?.slice(0, 5).map((b: any) => ({ id: b.id, identifier: b.booking_number })) },
    { table: 'chalet_add_ons', count: addOnsResult.count || 0 },
    { table: 'chalet_images', count: imagesResult.count || 0 },
  ].filter(e => e.count > 0);

  const warnings: string[] = [];
  const recommendations: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  if (activeBookings > 0) {
    severity = 'critical';
    warnings.push(`Chalet has ${activeBookings} active booking(s)`);
    recommendations.push('Complete or cancel all active bookings first');
  } else if (bookingsResult.count && bookingsResult.count > 0) {
    severity = 'high';
    warnings.push(`Chalet has ${bookingsResult.count} historical booking(s)`);
    recommendations.push('Consider deactivating instead of deleting to preserve history');
  }

  return {
    entity: {
      type: 'chalet',
      id: chaletId,
      identifier: chalet.name,
      created_at: chalet.created_at,
    },
    impact: {
      severity,
      message: `Deleting chalet will affect all associated bookings and add-ons`,
      warnings,
    },
    relatedEntities,
    recommendations,
    canDelete: activeBookings === 0,
    requiresForce: (bookingsResult.count || 0) > 0,
  };
}

/**
 * Menu item delete preview
 */
async function getMenuItemDeletePreview(supabase: any, itemId: string): Promise<DeletePreviewResult> {
  const { data: item, error } = await supabase
    .from('menu_items')
    .select('id, name, created_at')
    .eq('id', itemId)
    .single();

  if (error || !item) {
    throw new Error('Menu item not found');
  }

  const [orderItemsResult, inventoryResult] = await Promise.all([
    supabase.from('restaurant_order_items').select('id', { count: 'exact' }).eq('menu_item_id', itemId),
    supabase.from('inventory_recipes').select('id', { count: 'exact' }).eq('menu_item_id', itemId),
  ]);

  const relatedEntities: RelatedEntity[] = [
    { table: 'order_items', count: orderItemsResult.count || 0 },
    { table: 'inventory_recipes', count: inventoryResult.count || 0 },
  ].filter(e => e.count > 0);

  const warnings: string[] = [];
  const recommendations: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  if (orderItemsResult.count && orderItemsResult.count > 0) {
    severity = 'high';
    warnings.push(`Menu item appears in ${orderItemsResult.count} order(s)`);
    recommendations.push('Mark as unavailable instead of deleting to preserve order history');
  }

  recommendations.push('Set is_available=false to hide without deleting');

  return {
    entity: {
      type: 'menu_item',
      id: itemId,
      identifier: item.name,
      created_at: item.created_at,
    },
    impact: {
      severity,
      message: `Menu item appears in historical orders`,
      warnings,
    },
    relatedEntities,
    recommendations,
    canDelete: true,
    requiresForce: (orderItemsResult.count || 0) > 10,
  };
}

/**
 * Table delete preview
 */
async function getTableDeletePreview(supabase: any, tableId: string): Promise<DeletePreviewResult> {
  const { data: table, error } = await supabase
    .from('restaurant_tables')
    .select('id, table_number, created_at')
    .eq('id', tableId)
    .single();

  if (error || !table) {
    throw new Error('Table not found');
  }

  const [ordersResult, reservationsResult] = await Promise.all([
    supabase.from('restaurant_orders').select('id', { count: 'exact' }).eq('table_id', tableId),
    supabase.from('table_reservations').select('id', { count: 'exact' }).eq('table_id', tableId),
  ]);

  const relatedEntities: RelatedEntity[] = [
    { table: 'restaurant_orders', count: ordersResult.count || 0 },
    { table: 'table_reservations', count: reservationsResult.count || 0 },
  ].filter(e => e.count > 0);

  const warnings: string[] = [];
  const recommendations: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // Check for active orders
  const { count: activeOrders } = await supabase
    .from('restaurant_orders')
    .select('id', { count: 'exact' })
    .eq('table_id', tableId)
    .in('status', ['pending', 'preparing', 'ready']);

  if (activeOrders && activeOrders > 0) {
    severity = 'critical';
    warnings.push(`Table has ${activeOrders} active order(s)`);
    recommendations.push('Complete all active orders before deleting');
  }

  return {
    entity: {
      type: 'table',
      id: tableId,
      identifier: `Table ${table.table_number}`,
      created_at: table.created_at,
    },
    impact: {
      severity,
      message: `Table has ${ordersResult.count || 0} historical orders`,
      warnings,
    },
    relatedEntities,
    recommendations,
    canDelete: !activeOrders || activeOrders === 0,
    requiresForce: (ordersResult.count || 0) > 50,
  };
}

/**
 * Module delete preview
 */
async function getModuleDeletePreview(supabase: any, moduleId: string): Promise<DeletePreviewResult> {
  const { data: module, error } = await supabase
    .from('modules')
    .select('id, name, type, created_at')
    .eq('id', moduleId)
    .single();

  if (error || !module) {
    throw new Error('Module not found');
  }

  // Different related data based on module type
  let relatedEntities: RelatedEntity[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let canDelete = true;

  if (module.type === 'multi_day') {
    const { count: bookingsCount } = await supabase
      .from('chalet_bookings')
      .select('id', { count: 'exact' })
      .eq('module_id', moduleId);
    
    const { count: unitsCount } = await supabase
      .from('chalets')
      .select('id', { count: 'exact' })
      .eq('module_id', moduleId);

    relatedEntities = [
      { table: 'units/chalets', count: unitsCount || 0 },
      { table: 'bookings', count: bookingsCount || 0 },
    ].filter(e => e.count > 0);

    if (bookingsCount && bookingsCount > 0) {
      severity = 'critical';
      warnings.push(`Module has ${bookingsCount} booking(s)`);
      canDelete = false;
    }
  } else if (module.type === 'restaurant') {
    const [ordersResult, tablesResult, menuResult] = await Promise.all([
      supabase.from('restaurant_orders').select('id', { count: 'exact' }).eq('module_id', moduleId),
      supabase.from('restaurant_tables').select('id', { count: 'exact' }).eq('module_id', moduleId),
      supabase.from('menu_items').select('id', { count: 'exact' }).eq('module_id', moduleId),
    ]);

    relatedEntities = [
      { table: 'orders', count: ordersResult.count || 0 },
      { table: 'tables', count: tablesResult.count || 0 },
      { table: 'menu_items', count: menuResult.count || 0 },
    ].filter(e => e.count > 0);

    if (ordersResult.count && ordersResult.count > 0) {
      severity = 'high';
      warnings.push(`Module has ${ordersResult.count} order(s)`);
    }
  }

  recommendations.push('Consider disabling the module instead of deleting');
  recommendations.push('All related data will be cascade deleted');

  return {
    entity: {
      type: 'module',
      id: moduleId,
      identifier: module.name,
      created_at: module.created_at,
    },
    impact: {
      severity,
      message: `Deleting module will remove all associated data`,
      warnings,
    },
    relatedEntities,
    recommendations,
    canDelete,
    requiresForce: true,
  };
}
