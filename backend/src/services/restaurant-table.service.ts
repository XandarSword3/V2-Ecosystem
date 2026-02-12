/**
 * Restaurant Table Management Service
 * 
 * Handles table reservations, visual floor plan, and kitchen display integration.
 */

import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { io } from '../config/socket.js';

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  CLEANING = 'CLEANING',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SEATED = 'SEATED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

interface TablePosition {
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  shape: 'rectangle' | 'circle' | 'square';
}

interface TableReservation {
  id: string;
  guestName: string;
  partySize: number;
  time: string;
  status: ReservationStatus;
}

interface TableOrder {
  id: string;
  status: string;
  total: number;
}

interface TableInfo {
  id: string;
  number: number;
  name: string;
  capacity: number;
  minCapacity: number;
  status: TableStatus;
  position: TablePosition;
  section: string | null;
  features: string[];
  currentReservation?: TableReservation;
  currentOrder?: TableOrder;
}

interface CreateReservationInput {
  tableId?: string;
  date: Date;
  time: string;
  partySize: number;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  specialRequests?: string;
  userId?: string;
}

interface ReservationResult {
  success: boolean;
  message: string;
  reservation?: TableReservation;
}

interface TableFilterOptions {
  status?: TableStatus | { not: TableStatus };
  section?: string;
  minCapacity?: number;
  maxCapacity?: number;
}

interface RestaurantTable {
  id: string;
  number: number;
  name: string;
  capacity: number;
  min_capacity: number;
  status: string;
  position: TablePosition | unknown;
  section: string | null;
  features: unknown;
  currentReservation?: TableReservation[];
  currentOrder?: TableOrder[];
}

interface SystemSetting {
  key: string;
  value?: string;
}

interface ReservationRecord {
  table_id: string;
}

/**
 * Get all tables with current status
 */
export async function getAllTables(
  includeOutOfService: boolean = false
): Promise<TableInfo[]> {
  const supabase = getSupabase();
  const today = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('restaurant_tables')
    .select('*')
    .order('number', { ascending: true });

  if (!includeOutOfService) {
    query = query.neq('status', TableStatus.OUT_OF_SERVICE);
  }

  const { data: tables, error } = await query;
  if (error) throw error;

  // Fetch current reservations for today
  const tableIds = (tables || []).map((t: any) => t.id);
  const { data: reservations } = await supabase
    .from('table_reservations')
    .select('*')
    .in('table_id', tableIds)
    .in('status', [ReservationStatus.CONFIRMED, ReservationStatus.SEATED])
    .eq('date', today);

  // Fetch current orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .in('table_id', tableIds)
    .in('status', ['PENDING', 'IN_PROGRESS']);

  return (tables || []).map((table: any) => {
    const tableReservations = (reservations || []).filter((r: any) => r.table_id === table.id);
    const tableOrders = (orders || []).filter((o: any) => o.table_id === table.id);
    return {
      id: table.id,
      number: table.number,
      name: table.name,
      capacity: table.capacity,
      minCapacity: table.min_capacity,
      status: table.status as TableStatus,
      position: (table.position as unknown as TablePosition) || { x: 0, y: 0, rotation: 0, width: 60, height: 60, shape: 'rectangle' },
      section: table.section || 'main',
      features: (table.features as unknown as string[]) || [],
      currentReservation: tableReservations[0] ? {
          ...tableReservations[0],
          status: tableReservations[0].status as ReservationStatus
      } : undefined,
      currentOrder: tableOrders[0],
    };
  });
}

/**
 * Get available tables for a specific date/time and party size
 */
export async function getAvailableTables(
  date: string,
  time: string,
  partySize: number
): Promise<TableInfo[]> {
  const supabase = getSupabase();

  // Get all tables that can accommodate the party
  const { data: tables, error: tablesError } = await supabase
    .from('restaurant_tables')
    .select('*')
    .neq('status', TableStatus.OUT_OF_SERVICE)
    .gte('capacity', partySize)
    .lte('min_capacity', partySize);
  if (tablesError) throw tablesError;

  // Calculate time window (2 hours for reservation)
  const reservationStart = new Date(`${date}T${time}`);
  const reservationEnd = new Date(reservationStart.getTime() + 2 * 60 * 60 * 1000);

  // Find tables with conflicting reservations
  const { data: conflictingReservations, error: conflictError } = await supabase
    .from('table_reservations')
    .select('table_id')
    .eq('date', date)
    .in('status', [ReservationStatus.PENDING, ReservationStatus.CONFIRMED])
    .gte('time', time)
    .lte('end_time', new Date(reservationEnd).toTimeString().slice(0, 5));
  if (conflictError) throw conflictError;

  const bookedTableIds = new Set((conflictingReservations || []).map((r: ReservationRecord) => r.table_id));

  return (tables || [])
    .filter((table: RestaurantTable) => !bookedTableIds.has(table.id))
    .map((table: RestaurantTable) => ({
      id: table.id,
      number: table.number,
      name: table.name,
      capacity: table.capacity,
      minCapacity: table.min_capacity,
      status: TableStatus.AVAILABLE,
      position: table.position as TablePosition,
      section: table.section,
      features: table.features as string[],
    }));
}

/**
 * Create a table reservation
 */
export async function createReservation(
  input: CreateReservationInput
): Promise<ReservationResult> {
  try {
    // Find available table if not specified
    let tableId = input.tableId;
    
    if (!tableId) {
      const availableTables = await getAvailableTables(
        input.date.toISOString().split('T')[0],
        input.time,
        input.partySize
      );

      if (availableTables.length === 0) {
        return {
          success: false,
          message: 'No tables available for the requested time and party size',
        };
      }

      // Select the smallest table that fits
      const sortedTables = availableTables.sort((a, b) => a.capacity - b.capacity);
      tableId = sortedTables[0].id;
    }

    // Verify table availability
    const supabase = getSupabase();
    const { data: existingReservation, error: existingError } = await supabase
      .from('table_reservations')
      .select('id')
      .eq('table_id', tableId)
      .eq('date', input.date.toISOString().split('T')[0])
      .eq('time', input.time)
      .in('status', [ReservationStatus.PENDING, ReservationStatus.CONFIRMED])
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingReservation) {
      return {
        success: false,
        message: 'Table is already reserved for this time',
      };
    }

    // Calculate end time (2 hours default)
    const startTime = new Date(`${input.date.toISOString().split('T')[0]}T${input.time}`);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    // Create reservation
    const { data: reservation, error: createError } = await supabase
      .from('table_reservations')
      .insert({
        table_id: tableId,
        date: input.date.toISOString().split('T')[0],
        time: input.time,
        end_time: endTime.toTimeString().slice(0, 5),
        party_size: input.partySize,
        guest_name: input.guestName,
        guest_phone: input.guestPhone,
        guest_email: input.guestEmail,
        special_requests: input.specialRequests,
        user_id: input.userId,
        status: ReservationStatus.PENDING,
      })
      .select('*, table:restaurant_tables(*)')
      .single();
    if (createError) throw createError;

    // Notify staff via WebSocket
    io.to('restaurant-staff').emit('new-reservation', {
      id: reservation.id,
      table: reservation.table.name,
      time: reservation.time,
      partySize: reservation.party_size,
      guestName: reservation.guest_name,
    });

    logger.info('Reservation created', {
      reservationId: reservation.id,
      tableId,
      date: input.date,
      time: input.time,
    });

    return {
      success: true,
      message: 'Reservation created successfully',
      reservation: {
        ...reservation,
        status: reservation.status as ReservationStatus
      },
    };
  } catch (error: any) {
    logger.error('Failed to create reservation', { error: error.message });
    throw error;
  }
}

/**
 * Update table status
 */
export async function updateTableStatus(
  tableId: string,
  status: TableStatus,
  staffId?: string
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('restaurant_tables')
    .update({
      status,
      last_status_change: new Date().toISOString(),
      last_status_changed_by: staffId,
    })
    .eq('id', tableId);
  if (error) throw error;

  // Notify via WebSocket
  io.to('restaurant-staff').emit('table-status-changed', {
    tableId,
    status,
    timestamp: new Date(),
  });

  logger.info('Table status updated', { tableId, status, staffId });
}

/**
 * Seat guests (mark reservation as seated)
 */
export async function seatGuests(
  reservationId: string,
  staffId: string
): Promise<ReservationResult> {
  const supabase = getSupabase();
  const { data: reservation, error: reservationError } = await supabase
    .from('table_reservations')
    .select('*, table:restaurant_tables(*)')
    .eq('id', reservationId)
    .maybeSingle();
  if (reservationError) throw reservationError;

  if (!reservation) {
    return { success: false, message: 'Reservation not found' };
  }

  if (reservation.status !== ReservationStatus.CONFIRMED) {
    return { success: false, message: 'Reservation is not confirmed' };
  }

  // Update reservation and table (sequential calls replacing $transaction)
  const { error: updateReservationError } = await supabase
    .from('table_reservations')
    .update({
      status: ReservationStatus.SEATED,
      seated_at: new Date().toISOString(),
      seated_by: staffId,
    })
    .eq('id', reservationId);
  if (updateReservationError) throw updateReservationError;

  const { error: updateTableError } = await supabase
    .from('restaurant_tables')
    .update({ status: TableStatus.OCCUPIED })
    .eq('id', reservation.table_id);
  if (updateTableError) throw updateTableError;

  // Notify kitchen
  io.to('kitchen').emit('table-seated', {
    tableId: reservation.table_id,
    tableName: reservation.table.name,
    partySize: reservation.party_size,
  });

  logger.info('Guests seated', { reservationId, tableId: reservation.table_id });

  return { success: true, message: 'Guests seated successfully' };
}

/**
 * Complete a table session (guests leaving)
 */
export async function completeTable(
  tableId: string,
  staffId: string
): Promise<void> {
  const supabase = getSupabase();
  const { data: table, error: tableError } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('id', tableId)
    .maybeSingle();
  if (tableError) throw tableError;

  if (!table) {
    throw new Error('Table not found');
  }

  // Get seated reservations for this table
  const { data: seatedReservations, error: resError } = await supabase
    .from('table_reservations')
    .select('*')
    .eq('table_id', tableId)
    .eq('status', ReservationStatus.SEATED);
  if (resError) throw resError;

  // Complete reservation if exists (sequential calls replacing $transaction)
  if (seatedReservations && seatedReservations.length > 0) {
    const { error: completeResError } = await supabase
      .from('table_reservations')
      .update({
        status: ReservationStatus.COMPLETED,
        completed_at: new Date().toISOString(),
      })
      .eq('id', seatedReservations[0].id);
    if (completeResError) throw completeResError;
  }

  // Set table to cleaning
  const { error: updateTableError } = await supabase
    .from('restaurant_tables')
    .update({ status: TableStatus.CLEANING })
    .eq('id', tableId);
  if (updateTableError) throw updateTableError;

  // Notify staff
  io.to('restaurant-staff').emit('table-needs-cleaning', {
    tableId,
    tableName: table.name,
  });

  logger.info('Table completed', { tableId, staffId });
}

/**
 * Get floor plan configuration
 */
export async function getFloorPlan(): Promise<{
  tables: TableInfo[];
  sections: string[];
  dimensions: { width: number; height: number };
}> {
  const tables = await getAllTables(true);
  const sections = [...new Set(tables.map(t => t.section))].filter((s): s is string => s !== null);
  
  // Get floor plan dimensions from settings
  const supabase = getSupabase();
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('*')
    .like('key', 'restaurant.floorPlan.%');
  if (error) throw error;

  const dimensions = {
    width: parseInt((settings || []).find((s: SystemSetting) => s.key === 'restaurant.floorPlan.width')?.value || '800'),
    height: parseInt((settings || []).find((s: SystemSetting) => s.key === 'restaurant.floorPlan.height')?.value || '600'),
  };

  return { tables, sections, dimensions };
}

/**
 * Update table position (for floor plan editor)
 */
export async function updateTablePosition(
  tableId: string,
  position: Partial<TablePosition>,
  staffId: string
): Promise<void> {
  const supabase = getSupabase();
  const { data: table, error: tableError } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('id', tableId)
    .maybeSingle();
  if (tableError) throw tableError;

  if (!table) {
    throw new Error('Table not found');
  }

  const currentPosition = (table.position as unknown as TablePosition) || {
    x: 0,
    y: 0,
    rotation: 0,
    width: 60,
    height: 60,
    shape: 'rectangle',
  };

  const { error: updateError } = await supabase
    .from('restaurant_tables')
    .update({
      position: { ...currentPosition, ...position },
    })
    .eq('id', tableId);
  if (updateError) throw updateError;

  // Broadcast update
  io.to('restaurant-staff').emit('table-position-updated', {
    tableId,
    position: { ...currentPosition, ...position },
  });

  logger.info('Table position updated', { tableId, position, staffId });
}

/**
 * Get today's reservations
 */
export async function getTodaysReservations(): Promise<any[]> {
  const today = new Date().toISOString().split('T')[0];
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('table_reservations')
    .select('*, table:restaurant_tables(id, name, number)')
    .eq('date', today)
    .not('status', 'in', `(${ReservationStatus.CANCELLED},${ReservationStatus.NO_SHOW})`)
    .order('time', { ascending: true });
  if (error) throw error;

  return data || [];
}

/**
 * Cancel a reservation
 */
export async function cancelReservation(
  reservationId: string,
  reason?: string
): Promise<ReservationResult> {
  const supabase = getSupabase();
  const { data: reservation, error: resError } = await supabase
    .from('table_reservations')
    .select('*')
    .eq('id', reservationId)
    .maybeSingle();
  if (resError) throw resError;

  if (!reservation) {
    return { success: false, message: 'Reservation not found' };
  }

  if (reservation.status === ReservationStatus.CANCELLED) {
    return { success: false, message: 'Reservation is already cancelled' };
  }

  const { error: updateError } = await supabase
    .from('table_reservations')
    .update({
      status: ReservationStatus.CANCELLED,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq('id', reservationId);
  if (updateError) throw updateError;

  logger.info('Reservation cancelled', { reservationId, reason });

  return { success: true, message: 'Reservation cancelled' };
}

/**
 * Mark reservation as no-show
 */
export async function markNoShow(
  reservationId: string,
  staffId: string
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('table_reservations')
    .update({
      status: ReservationStatus.NO_SHOW,
      no_show_marked_at: new Date().toISOString(),
      no_show_marked_by: staffId,
    })
    .eq('id', reservationId);
  if (error) throw error;

  logger.info('Reservation marked as no-show', { reservationId, staffId });
}

/**
 * Confirm a pending reservation
 */
export async function confirmReservation(
  reservationId: string,
  staffId: string
): Promise<ReservationResult> {
  const supabase = getSupabase();
  const { data: reservation, error: resError } = await supabase
    .from('table_reservations')
    .select('*')
    .eq('id', reservationId)
    .maybeSingle();
  if (resError) throw resError;

  if (!reservation) {
    return { success: false, message: 'Reservation not found' };
  }

  if (reservation.status !== ReservationStatus.PENDING) {
    return { success: false, message: 'Reservation is not pending' };
  }

  const { error: updateError } = await supabase
    .from('table_reservations')
    .update({
      status: ReservationStatus.CONFIRMED,
      confirmed_at: new Date().toISOString(),
      confirmed_by: staffId,
    })
    .eq('id', reservationId);
  if (updateError) throw updateError;

  logger.info('Reservation confirmed', { reservationId, staffId });

  return { success: true, message: 'Reservation confirmed' };
}

export default {
  getAllTables,
  getAvailableTables,
  createReservation,
  updateTableStatus,
  seatGuests,
  completeTable,
  getFloorPlan,
  updateTablePosition,
  getTodaysReservations,
  cancelReservation,
  markNoShow,
  confirmReservation,
  TableStatus,
  ReservationStatus,
};
