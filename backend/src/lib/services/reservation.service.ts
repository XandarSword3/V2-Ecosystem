import { 
  Container, 
  Reservation, 
  ReservationType, 
  ReservationStatus,
  ReservationConflict 
} from '../container/types';

export interface CreateReservationInput {
  type: ReservationType;
  guestId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  resourceId: string;
  resourceName: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  specialRequests?: string;
  notes?: string;
  totalAmount: number;
  depositAmount?: number;
  bookedBy: string;
}

export interface UpdateReservationInput {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn?: string;
  checkOut?: string;
  guestCount?: number;
  specialRequests?: string;
  notes?: string;
  totalAmount?: number;
  depositAmount?: number;
}

export interface ReservationService {
  // CRUD Operations
  createReservation(input: CreateReservationInput): Promise<Reservation>;
  getReservation(id: string): Promise<Reservation | null>;
  getReservationByConfirmationCode(code: string): Promise<Reservation | null>;
  getReservations(): Promise<Reservation[]>;
  getReservationsByGuest(guestId: string): Promise<Reservation[]>;
  getReservationsByResource(resourceId: string): Promise<Reservation[]>;
  getReservationsByStatus(status: ReservationStatus): Promise<Reservation[]>;
  getReservationsByType(type: ReservationType): Promise<Reservation[]>;
  getReservationsForDateRange(startDate: string, endDate: string): Promise<Reservation[]>;
  updateReservation(id: string, input: UpdateReservationInput): Promise<Reservation>;
  deleteReservation(id: string): Promise<void>;
  
  // Status Operations
  confirmReservation(id: string): Promise<Reservation>;
  checkIn(id: string, staffId: string): Promise<Reservation>;
  checkOut(id: string, staffId: string): Promise<Reservation>;
  cancelReservation(id: string, reason: string, cancelledBy: string): Promise<Reservation>;
  markNoShow(id: string): Promise<Reservation>;
  
  // Payment Operations
  recordDeposit(id: string): Promise<Reservation>;
  refundDeposit(id: string): Promise<Reservation>;
  
  // Availability & Conflicts
  checkAvailability(resourceId: string, checkIn: string, checkOut: string): Promise<boolean>;
  findConflicts(resourceId: string, checkIn: string, checkOut: string, excludeId?: string): Promise<ReservationConflict[]>;
  
  // Queries
  getUpcomingReservations(guestId: string): Promise<Reservation[]>;
  getTodayCheckIns(): Promise<Reservation[]>;
  getTodayCheckOuts(): Promise<Reservation[]>;
  getPendingReservations(): Promise<Reservation[]>;
  
  // Utilities
  generateConfirmationCode(): string;
  calculateDuration(checkIn: string, checkOut: string): number;
  isValidDateRange(checkIn: string, checkOut: string): boolean;
  canCancel(reservation: Reservation): boolean;
  canCheckIn(reservation: Reservation): boolean;
  canCheckOut(reservation: Reservation): boolean;
  canModify(reservation: Reservation): boolean;
}

export function createReservationService(container: Container): ReservationService {
  const { reservationRepository, logger } = container;
  
  function generateConfirmationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  
  function calculateDuration(checkIn: string, checkOut: string): number {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end.getTime() - start.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
  
  function isValidDateRange(checkIn: string, checkOut: string): boolean {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }
    
    return end > start;
  }
  
  function canCancel(reservation: Reservation): boolean {
    return ['pending', 'confirmed'].includes(reservation.status);
  }
  
  function canCheckIn(reservation: Reservation): boolean {
    if (reservation.status !== 'confirmed') return false;
    
    const now = new Date();
    const checkInDate = new Date(reservation.checkIn);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const checkInDay = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
    
    return checkInDay <= today;
  }
  
  function canCheckOut(reservation: Reservation): boolean {
    return reservation.status === 'checked_in';
  }
  
  function canModify(reservation: Reservation): boolean {
    return ['pending', 'confirmed'].includes(reservation.status);
  }
  
  async function createReservation(input: CreateReservationInput): Promise<Reservation> {
    // Validate dates
    if (!isValidDateRange(input.checkIn, input.checkOut)) {
      throw new Error('Invalid date range: check-out must be after check-in');
    }
    
    // Check for guest count
    if (input.guestCount < 1) {
      throw new Error('Guest count must be at least 1');
    }
    
    // Check for conflicts
    const conflicts = await reservationRepository.findConflicts(
      input.resourceId,
      input.checkIn,
      input.checkOut
    );
    
    if (conflicts.length > 0) {
      throw new Error('Resource is not available for the requested dates');
    }
    
    const confirmationCode = generateConfirmationCode();
    
    const reservation = await reservationRepository.create({
      ...input,
      status: 'pending',
      depositAmount: input.depositAmount || 0,
      depositPaid: false,
      confirmationCode
    });
    
    logger.info('Reservation created', { 
      reservationId: reservation.id, 
      confirmationCode,
      type: input.type 
    });
    
    return reservation;
  }
  
  async function getReservation(id: string): Promise<Reservation | null> {
    return reservationRepository.getById(id);
  }
  
  async function getReservationByConfirmationCode(code: string): Promise<Reservation | null> {
    return reservationRepository.getByConfirmationCode(code);
  }
  
  async function getReservations(): Promise<Reservation[]> {
    return reservationRepository.getAll();
  }
  
  async function getReservationsByGuest(guestId: string): Promise<Reservation[]> {
    return reservationRepository.getByGuestId(guestId);
  }
  
  async function getReservationsByResource(resourceId: string): Promise<Reservation[]> {
    return reservationRepository.getByResourceId(resourceId);
  }
  
  async function getReservationsByStatus(status: ReservationStatus): Promise<Reservation[]> {
    return reservationRepository.getByStatus(status);
  }
  
  async function getReservationsByType(type: ReservationType): Promise<Reservation[]> {
    return reservationRepository.getByType(type);
  }
  
  async function getReservationsForDateRange(startDate: string, endDate: string): Promise<Reservation[]> {
    return reservationRepository.getByDateRange(startDate, endDate);
  }
  
  async function updateReservation(id: string, input: UpdateReservationInput): Promise<Reservation> {
    const reservation = await reservationRepository.getById(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (!canModify(reservation)) {
      throw new Error('Cannot modify reservation in current status');
    }
    
    // If dates are being updated, validate and check conflicts
    const newCheckIn = input.checkIn || reservation.checkIn;
    const newCheckOut = input.checkOut || reservation.checkOut;
    
    if (input.checkIn || input.checkOut) {
      if (!isValidDateRange(newCheckIn, newCheckOut)) {
        throw new Error('Invalid date range: check-out must be after check-in');
      }
      
      const conflicts = await reservationRepository.findConflicts(
        reservation.resourceId,
        newCheckIn,
        newCheckOut,
        id
      );
      
      if (conflicts.length > 0) {
        throw new Error('Resource is not available for the updated dates');
      }
    }
    
    if (input.guestCount !== undefined && input.guestCount < 1) {
      throw new Error('Guest count must be at least 1');
    }
    
    const updated = await reservationRepository.update(id, input);
    
    logger.info('Reservation updated', { reservationId: id });
    
    return updated;
  }
  
  async function deleteReservation(id: string): Promise<void> {
    const reservation = await reservationRepository.getById(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    await reservationRepository.delete(id);
    
    logger.info('Reservation deleted', { reservationId: id });
  }
  
  async function confirmReservation(id: string): Promise<Reservation> {
    const reservation = await reservationRepository.getById(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (reservation.status !== 'pending') {
      throw new Error('Can only confirm pending reservations');
    }
    
    const updated = await reservationRepository.update(id, {
      status: 'confirmed'
    });
    
    logger.info('Reservation confirmed', { reservationId: id });
    
    return updated;
  }
  
  async function checkIn(id: string, staffId: string): Promise<Reservation> {
    const reservation = await reservationRepository.getById(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (!canCheckIn(reservation)) {
      throw new Error('Cannot check in: reservation must be confirmed and check-in date must be today or earlier');
    }
    
    const updated = await reservationRepository.update(id, {
      status: 'checked_in',
      checkedInAt: new Date().toISOString(),
      checkedInBy: staffId
    });
    
    logger.info('Guest checked in', { reservationId: id, staffId });
    
    return updated;
  }
  
  async function checkOut(id: string, staffId: string): Promise<Reservation> {
    const reservation = await reservationRepository.getById(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (!canCheckOut(reservation)) {
      throw new Error('Cannot check out: guest must be checked in first');
    }
    
    const updated = await reservationRepository.update(id, {
      status: 'checked_out',
      checkedOutAt: new Date().toISOString(),
      checkedOutBy: staffId
    });
    
    logger.info('Guest checked out', { reservationId: id, staffId });
    
    return updated;
  }
  
  async function cancelReservation(id: string, reason: string, cancelledBy: string): Promise<Reservation> {
    const reservation = await reservationRepository.getById(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (!canCancel(reservation)) {
      throw new Error('Cannot cancel reservation in current status');
    }
    
    const updated = await reservationRepository.update(id, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: new Date().toISOString(),
      cancelledBy
    });
    
    logger.info('Reservation cancelled', { reservationId: id, reason });
    
    return updated;
  }
  
  async function markNoShow(id: string): Promise<Reservation> {
    const reservation = await reservationRepository.getById(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (reservation.status !== 'confirmed') {
      throw new Error('Can only mark confirmed reservations as no-show');
    }
    
    const updated = await reservationRepository.update(id, {
      status: 'no_show'
    });
    
    logger.info('Reservation marked as no-show', { reservationId: id });
    
    return updated;
  }
  
  async function recordDeposit(id: string): Promise<Reservation> {
    const reservation = await reservationRepository.getById(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (reservation.depositPaid) {
      throw new Error('Deposit already paid');
    }
    
    if (reservation.depositAmount <= 0) {
      throw new Error('No deposit required for this reservation');
    }
    
    const updated = await reservationRepository.update(id, {
      depositPaid: true
    });
    
    logger.info('Deposit recorded', { reservationId: id, amount: reservation.depositAmount });
    
    return updated;
  }
  
  async function refundDeposit(id: string): Promise<Reservation> {
    const reservation = await reservationRepository.getById(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (!reservation.depositPaid) {
      throw new Error('No deposit to refund');
    }
    
    const updated = await reservationRepository.update(id, {
      depositPaid: false
    });
    
    logger.info('Deposit refunded', { reservationId: id, amount: reservation.depositAmount });
    
    return updated;
  }
  
  async function checkAvailability(resourceId: string, checkIn: string, checkOut: string): Promise<boolean> {
    const conflicts = await reservationRepository.findConflicts(resourceId, checkIn, checkOut);
    return conflicts.length === 0;
  }
  
  async function findConflicts(
    resourceId: string, 
    checkIn: string, 
    checkOut: string, 
    excludeId?: string
  ): Promise<ReservationConflict[]> {
    const conflicts = await reservationRepository.findConflicts(resourceId, checkIn, checkOut, excludeId);
    
    return conflicts.map(r => ({
      reservationId: r.id,
      resourceId: r.resourceId,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      guestName: r.guestName
    }));
  }
  
  async function getUpcomingReservations(guestId: string): Promise<Reservation[]> {
    const reservations = await reservationRepository.getByGuestId(guestId);
    const now = new Date().toISOString();
    
    return reservations
      .filter(r => r.checkIn >= now && !['cancelled', 'checked_out', 'no_show'].includes(r.status))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }
  
  async function getTodayCheckIns(): Promise<Reservation[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    
    const reservations = await reservationRepository.getByDateRange(startOfDay, endOfDay);
    
    return reservations.filter(r => r.status === 'confirmed');
  }
  
  async function getTodayCheckOuts(): Promise<Reservation[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().split('T')[0];
    
    const reservations = await reservationRepository.getByStatus('checked_in');
    
    return reservations.filter(r => r.checkOut.split('T')[0] === startOfDay);
  }
  
  async function getPendingReservations(): Promise<Reservation[]> {
    return reservationRepository.getByStatus('pending');
  }
  
  return {
    createReservation,
    getReservation,
    getReservationByConfirmationCode,
    getReservations,
    getReservationsByGuest,
    getReservationsByResource,
    getReservationsByStatus,
    getReservationsByType,
    getReservationsForDateRange,
    updateReservation,
    deleteReservation,
    confirmReservation,
    checkIn,
    checkOut,
    cancelReservation,
    markNoShow,
    recordDeposit,
    refundDeposit,
    checkAvailability,
    findConflicts,
    getUpcomingReservations,
    getTodayCheckIns,
    getTodayCheckOuts,
    getPendingReservations,
    generateConfirmationCode,
    calculateDuration,
    isValidDateRange,
    canCancel,
    canCheckIn,
    canCheckOut,
    canModify
  };
}
