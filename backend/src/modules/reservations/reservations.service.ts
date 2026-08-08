import type { SupabaseClient } from '@supabase/supabase-js';
import { emitToUser, emitToUnit } from '../../socket/index.js';
import { logger } from '../../utils/logger.js';
import { notificationService } from '../../services/notifications.service.js';

export interface ReservationParams {
  tenantId: string;
  propertyId: string;
  moduleId: string;
  serviceLocationId?: string | null;
  partySize: number;
  reservedFor: string;
  durationMinutes?: number;
  guestName: string;
  guestPhone?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

export async function createReservation(supabase: SupabaseClient, params: ReservationParams) {
  const {
    tenantId,
    propertyId,
    moduleId,
    serviceLocationId,
    partySize,
    reservedFor,
    durationMinutes = 90,
    guestName,
    guestPhone,
    notes,
    createdBy,
  } = params;

  const { data, error } = await supabase
    .from('reservations')
    .insert({
      tenant_id: tenantId,
      property_id: propertyId,
      module_id: moduleId,
      service_location_id: serviceLocationId ?? null,
      party_size: partySize,
      reserved_for: reservedFor,
      duration_minutes: durationMinutes,
      status: 'booked',
      guest_name: guestName,
      guest_phone: guestPhone ?? null,
      notes: notes ?? null,
      created_by: createdBy ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getReservationsForDay(
  supabase: SupabaseClient,
  moduleId: string,
  dateStr: string
) {
  // Start and end of specified date in UTC
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`).toISOString();
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`).toISOString();

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('module_id', moduleId)
    .gte('reserved_for', startOfDay)
    .lte('reserved_for', endOfDay)
    .order('reserved_for', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function assignTableToReservation(
  supabase: SupabaseClient,
  reservationId: string,
  serviceLocationId: string | null
) {
  const { data, error } = await supabase
    .from('reservations')
    .update({
      service_location_id: serviceLocationId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reservationId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function autoAssignStaffToLocation(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    propertyId: string;
    moduleId: string;
    serviceLocationId: string;
  }
): Promise<string | null> {
  const { propertyId, moduleId, serviceLocationId } = params;

  // 1. Query staff with active shift for this module (or property fallback)
  const { data: activeShifts, error: shiftError } = await supabase
    .from('staff_shifts')
    .select('staff_id, actual_start, module_id')
    .eq('property_id', propertyId)
    .eq('status', 'active');

  if (shiftError || !activeShifts || activeShifts.length === 0) {
    logger.warn('[Reservations] No active staff shifts found for auto-assignment');
    return null;
  }

  // Filter for module match if module_id is set on shift, else include property-level active shifts
  const matchingShifts = activeShifts.filter(
    (s: { module_id?: string | null }) => !s.module_id || s.module_id === moduleId
  );
  if (matchingShifts.length === 0) return null;

  const candidateStaffIds = matchingShifts.map((s: { staff_id: string }) => s.staff_id);

  // 2. Count current load per staff on service_locations
  const { data: locations, error: locError } = await supabase
    .from('service_locations')
    .select('id, assigned_staff_id, is_occupied')
    .eq('module_id', moduleId)
    .not('assigned_staff_id', 'is', null);

  const loadByStaff = new Map<string, number>();
  for (const staffId of candidateStaffIds) {
    loadByStaff.set(staffId, 0);
  }

  if (!locError && locations) {
    for (const loc of locations) {
      if (loc.assigned_staff_id && loadByStaff.has(loc.assigned_staff_id)) {
        loadByStaff.set(
          loc.assigned_staff_id,
          (loadByStaff.get(loc.assigned_staff_id) ?? 0) + (loc.is_occupied ? 1 : 0)
        );
      }
    }
  }

  // 3. Pick candidate with minimum load; tie-break by earliest actual_start
  const shiftStartMap = new Map(matchingShifts.map((s: { staff_id: string; actual_start: string }) => [s.staff_id, s.actual_start]));
  candidateStaffIds.sort((a: string, b: string) => {
    const loadA = loadByStaff.get(a) ?? 0;
    const loadB = loadByStaff.get(b) ?? 0;
    if (loadA !== loadB) return loadA - loadB;
    const startA = new Date(shiftStartMap.get(a) ?? 0).getTime();
    const startB = new Date(shiftStartMap.get(b) ?? 0).getTime();
    return startA - startB;
  });

  const selectedStaffId = candidateStaffIds[0] ?? null;

  if (selectedStaffId) {
    // 4. Update service_locations
    await supabase
      .from('service_locations')
      .update({ assigned_staff_id: selectedStaffId, updated_at: new Date().toISOString() })
      .eq('id', serviceLocationId);

    // 5. Notify via socket emitToUser
    emitToUser(selectedStaffId, 'table:assigned', {
      serviceLocationId,
      moduleId,
      propertyId,
      assignedAt: new Date().toISOString(),
    });

    // 6. Persistent in-app notification so the assignment is visible even if the staff member missed the socket event
    notificationService.create({
      userId: selectedStaffId,
      type: 'table_assignment',
      title: 'New Table Assigned',
      message: `You have been assigned to a new table (${serviceLocationId}).`,
      priority: 'high',
      targetType: 'service_location',
      targetId: serviceLocationId,
    }).catch((err) => logger.error('Failed to create table assignment notification', err));
  }

  return selectedStaffId;
}

export async function checkInReservation(
  supabase: SupabaseClient,
  params: {
    reservationId: string;
    serviceLocationId?: string | null;
  }
) {
  const { reservationId, serviceLocationId } = params;

  // Fetch reservation details first
  const { data: existing, error: fetchError } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', reservationId)
    .single();

  if (fetchError || !existing) throw fetchError || new Error('Reservation not found');

  const finalLocationId = serviceLocationId || existing.service_location_id;
  const now = new Date().toISOString();

  // Try auto-assignment if table is set
  let assignedStaffId: string | null = existing.assigned_staff_id ?? null;
  if (finalLocationId) {
    assignedStaffId = await autoAssignStaffToLocation(supabase, {
      tenantId: existing.tenant_id,
      propertyId: existing.property_id,
      moduleId: existing.module_id,
      serviceLocationId: finalLocationId,
    });
  }

  const { data, error } = await supabase
    .from('reservations')
    .update({
      status: 'seated',
      service_location_id: finalLocationId,
      assigned_staff_id: assignedStaffId,
      checked_in_at: now,
      updated_at: now,
    })
    .eq('id', reservationId)
    .select('*')
    .single();

  if (error) throw error;

  // Wire check-in to transaction confirmation: find pending transactions for this
  // service_location and flip them to confirmed so they reach the kitchen board
  if (finalLocationId) {
    const { data: pendingTransactions } = await supabase
      .from('transactions')
      .select('id')
      .eq('service_location_id', finalLocationId)
      .eq('module_id', existing.module_id)
      .eq('status', 'pending');

    if (pendingTransactions && pendingTransactions.length > 0) {
      const transactionIds = pendingTransactions.map((t: { id: string }) => t.id);
      
      await supabase
        .from('transactions')
        .update({ status: 'confirmed', updated_at: now })
        .in('id', transactionIds);

      // Emit socket event for real-time update to kitchen board
      emitToUnit(existing.tenant_id, existing.module_id, 'order:confirmed', {
        serviceLocationId: finalLocationId,
        transactionIds,
      });

      logger.info('[Reservations] Check-in confirmed pending transactions', {
        reservationId,
        serviceLocationId: finalLocationId,
        transactionIds,
      });
    }
  }

  return data;
}

export async function cancelReservation(supabase: SupabaseClient, reservationId: string) {
  const { data, error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', reservationId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function markReservationNoShow(supabase: SupabaseClient, reservationId: string) {
  const { data, error } = await supabase
    .from('reservations')
    .update({ status: 'no_show', updated_at: new Date().toISOString() })
    .eq('id', reservationId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function reassignStaffToLocation(
  supabase: SupabaseClient,
  serviceLocationId: string,
  staffId: string | null
) {
  const { data, error } = await supabase
    .from('service_locations')
    .update({
      assigned_staff_id: staffId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', serviceLocationId)
    .select('*')
    .single();

  if (error) throw error;

  if (staffId) {
    emitToUser(staffId, 'table:assigned', {
      serviceLocationId,
      assignedAt: new Date().toISOString(),
      reassigned: true,
    });

    // Persistent in-app notification for reassignment
    notificationService.create({
      userId: staffId,
      type: 'table_assignment',
      title: 'Table Reassigned to You',
      message: `You have been reassigned to table (${serviceLocationId}).`,
      priority: 'high',
      targetType: 'service_location',
      targetId: serviceLocationId,
    }).catch((err) => logger.error('Failed to create reassignment notification', err));
  }

  return data;
}
