import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';

/**
 * Delete Preview Controller
 * Provides impact analysis before deleting resources
 * Shows all affected/related data that would be impacted
 */

type EntityType = 'user' | 'booking' | 'staff' | 'unit' | 'catalog_item' | 'module';

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
export const getDeletePreview = asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.params;
    const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
    const supabase = getSupabase();

    // Validate entity type
    const validTypes: EntityType[] = ['user', 'booking', 'staff', 'unit', 'catalog_item', 'module'];
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
        result = await getUserDeletePreview(supabase, entityId, propertyId);
        break;
      case 'booking':
        result = await getBookingDeletePreview(supabase, entityId, propertyId);
        break;
      case 'staff':
        result = await getStaffDeletePreview(supabase, entityId, propertyId);
        break;
      case 'unit':
        result = await getUnitDeletePreview(supabase, entityId, propertyId);
        break;
      case 'catalog_item':
        result = await getCatalogItemDeletePreview(supabase, entityId, propertyId);
        break;
      case 'module':
        result = await getModuleDeletePreview(supabase, entityId, propertyId);
        break;
      default:
        res.status(400).json({ success: false, error: 'Unsupported entity type' });
        return;
    }

    logger.info(`Delete preview requested for ${entityType}:${entityId} on property:${propertyId}`, {
      severity: result.impact.severity,
      canDelete: result.canDelete,
    });

    res.json({ success: true, data: result });
});

/**
 * User delete preview
 */
async function getUserDeletePreview(supabase: any, userId: string, propertyId?: string): Promise<DeletePreviewResult> {
  // Get user info
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, created_at')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  // If in property context, check membership or transaction presence
  if (propertyId) {
    const { data: access } = await supabase
      .from('user_property_access')
      .select('id')
      .eq('user_id', userId)
      .eq('property_id', propertyId)
      .limit(1);

    const { count: bookingsCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', userId)
      .eq('property_id', propertyId);

    if ((!access || access.length === 0) && (!bookingsCount || bookingsCount === 0)) {
      throw new Error('User not found in this property context');
    }
  }

  // Count related data
  let bookingsQuery = supabase.from('transactions').select('id, booking_number', { count: 'exact' }).eq('customer_id', userId).eq('engine_type', 'time_exclusive_reservation').limit(5);
  let ordersQuery = supabase.from('transactions').select('id, order_number', { count: 'exact' }).eq('customer_id', userId).eq('engine_type', 'instant_transaction').limit(5);
  let poolTicketsQuery = supabase.from('transactions').select('id, ticket_number', { count: 'exact' }).eq('customer_id', userId).eq('engine_type', 'shared_capacity_access').limit(5);
  let reviewsQuery = supabase.from('reviews').select('id, rating', { count: 'exact' }).eq('user_id', userId).limit(5);

  if (propertyId) {
    bookingsQuery = bookingsQuery.eq('property_id', propertyId);
    ordersQuery = ordersQuery.eq('property_id', propertyId);
    poolTicketsQuery = poolTicketsQuery.eq('property_id', propertyId);
    reviewsQuery = reviewsQuery.eq('property_id', propertyId);
  }

  const [
    bookingsResult,
    ordersResult,
    poolTicketsResult,
    reviewsResult,
    sessionsResult,
    rolesResult,
  ] = await Promise.all([
    bookingsQuery,
    ordersQuery,
    poolTicketsQuery,
    reviewsQuery,
    supabase.from('user_sessions').select('id', { count: 'exact' }).eq('user_id', userId),
    supabase.from('user_roles').select('role_id', { count: 'exact' }).eq('user_id', userId),
  ]);

  const relatedEntities: RelatedEntity[] = [
    { table: 'bookings', count: bookingsResult.count || 0, examples: bookingsResult.data?.map((b: any) => ({ id: b.id, identifier: b.booking_number })) },
    { table: 'orders', count: ordersResult.count || 0, examples: ordersResult.data?.map((o: any) => ({ id: o.id, identifier: o.order_number })) },
    { table: 'tickets', count: poolTicketsResult.count || 0, examples: poolTicketsResult.data?.map((t: any) => ({ id: t.id, identifier: t.ticket_number })) },
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
async function getBookingDeletePreview(supabase: any, bookingId: string, propertyId?: string): Promise<DeletePreviewResult> {
  let query = supabase
    .from('transactions')
    .select('id, booking_number, status, amount, customer_id, created_at, property_id')
    .eq('id', bookingId)
    .eq('engine_type', 'time_exclusive_reservation');

  if (propertyId) {
    query = query.eq('property_id', propertyId);
  }

  const { data: booking, error } = await query.single();

  if (error || !booking) {
    throw new Error('Booking not found');
  }

  let paymentsQuery = supabase.from('payments').select('id, amount', { count: 'exact' }).eq('reference_id', bookingId).eq('reference_table', 'transactions');
  if (propertyId) {
    paymentsQuery = paymentsQuery.eq('property_id', propertyId);
  }

  const [paymentsResult, addOnsResult] = await Promise.all([
    paymentsQuery,
    // Addons assumed in metadata
    Promise.resolve({ count: 0, data: [] })
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
async function getStaffDeletePreview(supabase: any, staffId: string, propertyId?: string): Promise<DeletePreviewResult> {
  const { data: staff, error } = await supabase
    .from('users')
    .select('id, email, full_name, created_at')
    .eq('id', staffId)
    .single();

  if (error || !staff) {
    throw new Error('Staff member not found');
  }

  if (propertyId) {
    const { data: access, error: accessError } = await supabase
      .from('user_property_access')
      .select('id')
      .eq('user_id', staffId)
      .eq('property_id', propertyId)
      .limit(1);

    if (accessError || !access || access.length === 0) {
      throw new Error('Staff member not found in this property context');
    }
  }

  let shiftsQuery = supabase.from('staff_shifts').select('id', { count: 'exact' }).eq('staff_id', staffId);
  let assignmentsQuery = supabase.from('staff_assignments').select('id', { count: 'exact' }).eq('staff_id', staffId);
  let housekeepingQuery = supabase.from('housekeeping_tasks').select('id', { count: 'exact' }).eq('assigned_to', staffId);
  let ordersAssignedQuery = supabase.from('transactions').select('id', { count: 'exact' }).eq('staff_id', staffId);

  if (propertyId) {
    shiftsQuery = shiftsQuery.eq('property_id', propertyId);
    assignmentsQuery = assignmentsQuery.eq('property_id', propertyId);
    housekeepingQuery = housekeepingQuery.eq('property_id', propertyId);
    ordersAssignedQuery = ordersAssignedQuery.eq('property_id', propertyId);
  }

  const [
    shiftsResult,
    assignmentsResult,
    housekeepingResult,
    ordersAssignedResult,
  ] = await Promise.all([
    shiftsQuery,
    assignmentsQuery,
    housekeepingQuery,
    ordersAssignedQuery,
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
  let upcomingShiftsQuery = supabase
    .from('staff_shifts')
    .select('id', { count: 'exact' })
    .eq('staff_id', staffId)
    .gte('start_time', new Date().toISOString());

  if (propertyId) {
    upcomingShiftsQuery = upcomingShiftsQuery.eq('property_id', propertyId);
  }

  const { count: upcomingShifts } = await upcomingShiftsQuery;

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
 * Unit delete preview
 */
async function getUnitDeletePreview(supabase: any, unitId: string, propertyId?: string): Promise<DeletePreviewResult> {
  let query = supabase
    .from('accommodation_units')
    .select('id, name, created_at, property_id')
    .eq('id', unitId);

  if (propertyId) {
    query = query.eq('property_id', propertyId);
  }

  const { data: unit, error } = await query.single();

  if (error || !unit) {
    throw new Error('Unit not found');
  }

  let bookingsQuery = supabase.from('transactions').select('id, booking_number, status', { count: 'exact' }).eq('reference_id', unitId).eq('reference_table', 'accommodation_units').limit(10);
  let imagesQuery = supabase.from('accommodation_unit_images').select('id', { count: 'exact' }).eq('unit_id', unitId);

  if (propertyId) {
    bookingsQuery = bookingsQuery.eq('property_id', propertyId);
  }

  const [bookingsResult, imagesResult] = await Promise.all([
    bookingsQuery,
    imagesQuery,
  ]);

  const activeBookings = bookingsResult.data?.filter((b: any) => 
    ['pending', 'confirmed', 'checked_in'].includes(b.status)
  ).length || 0;

  const relatedEntities: RelatedEntity[] = [
    { table: 'bookings', count: bookingsResult.count || 0, examples: bookingsResult.data?.slice(0, 5).map((b: any) => ({ id: b.id, identifier: b.booking_number })) },
    { table: 'images', count: imagesResult.count || 0 },
  ].filter(e => e.count > 0);

  const warnings: string[] = [];
  const recommendations: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

  if (activeBookings > 0) {
    severity = 'critical';
    warnings.push(`Unit has ${activeBookings} active booking(s)`);
    recommendations.push('Complete or cancel all active bookings first');
  } else if (bookingsResult.count && bookingsResult.count > 0) {
    severity = 'high';
    warnings.push(`Unit has ${bookingsResult.count} historical booking(s)`);
    recommendations.push('Consider deactivating instead of deleting to preserve history');
  }

  return {
    entity: {
      type: 'unit',
      id: unitId,
      identifier: unit.name,
      created_at: unit.created_at,
    },
    impact: {
      severity,
      message: `Deleting unit will affect all associated bookings and add-ons`,
      warnings,
    },
    relatedEntities,
    recommendations,
    canDelete: activeBookings === 0,
    requiresForce: (bookingsResult.count || 0) > 0,
  };
}

/**
 * Catalog item delete preview
 */
async function getCatalogItemDeletePreview(supabase: any, itemId: string, propertyId?: string): Promise<DeletePreviewResult> {
  const { data: item, error } = await supabase
    .from('catalog_items')
    .select('id, name, created_at, category_id')
    .eq('id', itemId)
    .single();

  if (error || !item) {
    throw new Error('Catalog item not found');
  }

  if (propertyId) {
    const { data: category } = await supabase
      .from('catalog_categories')
      .select('property_id, module_id')
      .eq('id', item.category_id)
      .single();

    if (category) {
      if (category.property_id && category.property_id !== propertyId) {
        throw new Error('Menu item not found in this property context');
      } else if (category.module_id) {
        const { data: mod } = await supabase
          .from('modules')
          .select('property_id')
          .eq('id', category.module_id)
          .single();
        if (mod && mod.property_id !== propertyId) {
          throw new Error('Menu item not found in this property context');
        }
      }
    }
  }

  let orderItemsQuery = supabase.from('transactions').select('id', { count: 'exact' }).filter('metadata->items', 'cs', `[{"catalog_item_id": "${itemId}"}]`);
  let inventoryQuery = supabase.from('inventory_recipes').select('id', { count: 'exact' }).eq('catalog_item_id', itemId);

  if (propertyId) {
    orderItemsQuery = orderItemsQuery.eq('property_id', propertyId);
    inventoryQuery = inventoryQuery.eq('property_id', propertyId);
  }

  const [orderItemsResult, inventoryResult] = await Promise.all([
    orderItemsQuery,
    inventoryQuery,
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
    warnings.push(`Catalog item appears in ${orderItemsResult.count} order(s)`);
    recommendations.push('Mark as unavailable instead of deleting to preserve order history');
  }

  recommendations.push('Set is_available=false to hide without deleting');

  return {
    entity: {
      type: 'catalog_item',
      id: itemId,
      identifier: item.name,
      created_at: item.created_at,
    },
    impact: {
      severity,
      message: `Catalog item appears in historical orders`,
      warnings,
    },
    relatedEntities,
    recommendations,
    canDelete: true,
    requiresForce: (orderItemsResult.count || 0) > 10,
  };
}

/**
 * Module delete preview
 */
async function getModuleDeletePreview(supabase: any, moduleId: string, propertyId?: string): Promise<DeletePreviewResult> {
  let moduleQuery = supabase
    .from('modules')
    .select('id, name, template_type, created_at, property_id')
    .eq('id', moduleId);

  if (propertyId) {
    moduleQuery = moduleQuery.eq('property_id', propertyId);
  }

  const { data: module, error } = await moduleQuery.single();

  if (error || !module) {
    throw new Error('Module not found');
  }

  // Different related data based on module type
  let relatedEntities: RelatedEntity[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
  let canDelete = true;

  if (module.template_type === 'time_exclusive_reservation') {
    let bookingsQuery = supabase
      .from('transactions')
      .select('id', { count: 'exact' })
      .eq('module_id', moduleId);
    
    let unitsQuery = supabase
      .from('accommodation_units')
      .select('id', { count: 'exact' })
      .eq('module_id', moduleId);

    if (propertyId) {
      bookingsQuery = bookingsQuery.eq('property_id', propertyId);
      unitsQuery = unitsQuery.eq('property_id', propertyId);
    }

    const [bookingsResult, unitsResult] = await Promise.all([
      bookingsQuery,
      unitsQuery,
    ]);

    const bookingsCount = bookingsResult.count;
    const unitsCount = unitsResult.count;

    relatedEntities = [
      { table: 'units', count: unitsCount || 0 },
      { table: 'bookings', count: bookingsCount || 0 },
    ].filter(e => e.count > 0);

    if (bookingsCount && bookingsCount > 0) {
      severity = 'critical';
      warnings.push(`Module has ${bookingsCount} booking(s)`);
      canDelete = false;
    }
  } else if (module.template_type === 'instant_transaction') {
    let ordersQuery = supabase.from('transactions').select('id', { count: 'exact' }).eq('module_id', moduleId);
    let catalogQuery = supabase.from('catalog_items').select('id', { count: 'exact' }).eq('module_id', moduleId);

    if (propertyId) {
      ordersQuery = ordersQuery.eq('property_id', propertyId);
    }

    const [ordersResult, catalogResult] = await Promise.all([
      ordersQuery,
      catalogQuery,
    ]);

    relatedEntities = [
      { table: 'orders', count: ordersResult.count || 0 },
      { table: 'catalog_items', count: catalogResult.count || 0 },
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
