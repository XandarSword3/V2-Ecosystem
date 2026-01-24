/**
 * Restaurant Table Management Service
 * 
 * Handles table reservations, visual floor plan, and kitchen display integration.
 */

import { prisma } from '../config/database.js';
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
  section: string;
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
  minCapacity: number;
  status: string;
  position: TablePosition | unknown;
  section: string;
  features: unknown;
  currentReservation?: TableReservation[];
  currentOrder?: TableOrder[];
}

interface SystemSetting {
  key: string;
  value?: string;
}

interface ReservationRecord {
  tableId: string;
}

/**
 * Get all tables with current status
 */
export async function getAllTables(
  includeOutOfService: boolean = false
): Promise<TableInfo[]> {
  const where: TableFilterOptions = {};
  if (!includeOutOfService) {
    where.status = { not: TableStatus.OUT_OF_SERVICE };
  }

  const tables = await prisma.restaurantTable.findMany({
    where,
    include: {
      currentReservation: {
        where: {
          status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.SEATED] },
          date: { equals: new Date().toISOString().split('T')[0] },
        },
      },
      currentOrder: {
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      },
    },
    orderBy: { number: 'asc' },
  });

  return tables.map((table: any) => ({
    id: table.id,
    number: table.number,
    name: table.name,
    capacity: table.capacity,
    minCapacity: table.minCapacity,
    status: table.status as TableStatus,
    position: (table.position as unknown as TablePosition) || { x: 0, y: 0, rotation: 0, width: 60, height: 60, shape: 'rectangle' },
    section: table.section || 'main',
    features: (table.features as unknown as string[]) || [],
    currentReservation: table.currentReservation?.[0] ? {
        ...table.currentReservation[0],
        status: table.currentReservation[0].status as ReservationStatus
    } : undefined,
    currentOrder: table.currentOrder?.[0],
  }));
}

/**
 * Get available tables for a specific date/time and party size
 */
export async function getAvailableTables(
  date: string,
  time: string,
  partySize: number
): Promise<TableInfo[]> {
  // Get all tables that can accommodate the party
  const tables = await prisma.restaurantTable.findMany({
    where: {
      status: { not: TableStatus.OUT_OF_SERVICE },
      capacity: { gte: partySize },
      minCapacity: { lte: partySize },
    },
  });

  // Calculate time window (2 hours for reservation)
  const reservationStart = new Date(`${date}T${time}`);
  const reservationEnd = new Date(reservationStart.getTime() + 2 * 60 * 60 * 1000);

  // Find tables with conflicting reservations
  const conflictingReservations = await prisma.tableReservation.findMany({
    where: {
      date,
      status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      OR: [
        {
          time: { gte: time },
          endTime: { lte: new Date(reservationEnd).toTimeString().slice(0, 5) },
        },
      ],
    },
    select: { tableId: true },
  });

  const bookedTableIds = new Set(conflictingReservations.map((r: ReservationRecord) => r.tableId));

  return tables
    .filter((table: RestaurantTable) => !bookedTableIds.has(table.id))
    .map((table: RestaurantTable) => ({
      id: table.id,
      number: table.number,
      name: table.name,
      capacity: table.capacity,
      minCapacity: table.minCapacity,
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
    const existingReservation = await prisma.tableReservation.findFirst({
      where: {
        tableId,
        date: input.date.toISOString().split('T')[0],
        time: input.time,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      },
    });

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
    const reservation = await prisma.tableReservation.create({
      data: {
        tableId,
        date: input.date.toISOString().split('T')[0],
        time: input.time,
        endTime: endTime.toTimeString().slice(0, 5),
        partySize: input.partySize,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail,
        specialRequests: input.specialRequests,
        userId: input.userId,
        status: ReservationStatus.PENDING,
      },
      include: {
        table: true,
      },
    });

    // Notify staff via WebSocket
    io.to('restaurant-staff').emit('new-reservation', {
      id: reservation.id,
      table: reservation.table.name,
      time: reservation.time,
      partySize: reservation.partySize,
      guestName: reservation.guestName,
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
  await prisma.restaurantTable.update({
    where: { id: tableId },
    data: {
      status,
      lastStatusChange: new Date(),
      lastStatusChangedBy: staffId,
    },
  });

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
  const reservation = await prisma.tableReservation.findUnique({
    where: { id: reservationId },
    include: { table: true },
  });

  if (!reservation) {
    return { success: false, message: 'Reservation not found' };
  }

  if (reservation.status !== ReservationStatus.CONFIRMED) {
    return { success: false, message: 'Reservation is not confirmed' };
  }

  // Update reservation and table
  await prisma.$transaction([
    prisma.tableReservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.SEATED,
        seatedAt: new Date(),
        seatedBy: staffId,
      },
    }),
    prisma.restaurantTable.update({
      where: { id: reservation.tableId },
      data: { status: TableStatus.OCCUPIED },
    }),
  ]);

  // Notify kitchen
  io.to('kitchen').emit('table-seated', {
    tableId: reservation.tableId,
    tableName: reservation.table.name,
    partySize: reservation.partySize,
  });

  logger.info('Guests seated', { reservationId, tableId: reservation.tableId });

  return { success: true, message: 'Guests seated successfully' };
}

/**
 * Complete a table session (guests leaving)
 */
export async function completeTable(
  tableId: string,
  staffId: string
): Promise<void> {
  const table = await prisma.restaurantTable.findUnique({
    where: { id: tableId },
    include: {
      currentReservation: {
        where: { status: ReservationStatus.SEATED },
      },
    },
  });

  if (!table) {
    throw new Error('Table not found');
  }

  await prisma.$transaction([
    // Complete reservation if exists
    ...(table.currentReservation.length > 0
      ? [
          prisma.tableReservation.update({
            where: { id: table.currentReservation[0].id },
            data: {
              status: ReservationStatus.COMPLETED,
              completedAt: new Date(),
            },
          }),
        ]
      : []),
    // Set table to cleaning
    prisma.restaurantTable.update({
      where: { id: tableId },
      data: { status: TableStatus.CLEANING },
    }),
  ]);

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
  const sections = [...new Set(tables.map(t => t.section))];
  
  // Get floor plan dimensions from settings
  const settings = await prisma.systemSettings.findMany({
    where: {
      key: { startsWith: 'restaurant.floorPlan.' },
    },
  });

  const dimensions = {
    width: parseInt(settings.find((s: SystemSetting) => s.key === 'restaurant.floorPlan.width')?.value || '800'),
    height: parseInt(settings.find((s: SystemSetting) => s.key === 'restaurant.floorPlan.height')?.value || '600'),
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
  const table = await prisma.restaurantTable.findUnique({
    where: { id: tableId },
  });

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

  await prisma.restaurantTable.update({
    where: { id: tableId },
    data: {
      position: { ...currentPosition, ...position },
    },
  });

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

  return prisma.tableReservation.findMany({
    where: {
      date: today,
      status: {
        notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
      },
    },
    include: {
      table: {
        select: { id: true, name: true, number: true },
      },
    },
    orderBy: { time: 'asc' },
  });
}

/**
 * Cancel a reservation
 */
export async function cancelReservation(
  reservationId: string,
  reason?: string
): Promise<ReservationResult> {
  const reservation = await prisma.tableReservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    return { success: false, message: 'Reservation not found' };
  }

  if (reservation.status === ReservationStatus.CANCELLED) {
    return { success: false, message: 'Reservation is already cancelled' };
  }

  await prisma.tableReservation.update({
    where: { id: reservationId },
    data: {
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });

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
  await prisma.tableReservation.update({
    where: { id: reservationId },
    data: {
      status: ReservationStatus.NO_SHOW,
      noShowMarkedAt: new Date(),
      noShowMarkedBy: staffId,
    },
  });

  logger.info('Reservation marked as no-show', { reservationId, staffId });
}

/**
 * Confirm a pending reservation
 */
export async function confirmReservation(
  reservationId: string,
  staffId: string
): Promise<ReservationResult> {
  const reservation = await prisma.tableReservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    return { success: false, message: 'Reservation not found' };
  }

  if (reservation.status !== ReservationStatus.PENDING) {
    return { success: false, message: 'Reservation is not pending' };
  }

  await prisma.tableReservation.update({
    where: { id: reservationId },
    data: {
      status: ReservationStatus.CONFIRMED,
      confirmedAt: new Date(),
      confirmedBy: staffId,
    },
  });

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
