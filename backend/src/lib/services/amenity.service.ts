import { 
  Container, 
  Amenity, 
  AmenityCategory,
  AmenityStatus,
  AmenitySchedule,
  AmenityReservation
} from '../container/types';

export interface CreateAmenityInput {
  name: string;
  description: string;
  category: AmenityCategory;
  location: string;
  capacity?: number;
  openingTime: string;
  closingTime: string;
  requiresReservation?: boolean;
  pricePerHour?: number;
  isComplimentary?: boolean;
  images?: string[];
  rules?: string[];
  ageRestriction?: number;
}

export interface UpdateAmenityInput {
  name?: string;
  description?: string;
  category?: AmenityCategory;
  location?: string;
  capacity?: number;
  openingTime?: string;
  closingTime?: string;
  requiresReservation?: boolean;
  pricePerHour?: number;
  isComplimentary?: boolean;
  images?: string[];
  rules?: string[];
  ageRestriction?: number;
}

export interface CreateReservationInput {
  amenityId: string;
  guestId: string;
  guestName: string;
  date: string;
  startTime: string;
  endTime: string;
  partySize: number;
  notes?: string;
}

export interface AmenityService {
  // CRUD Operations
  createAmenity(input: CreateAmenityInput): Promise<Amenity>;
  getAmenity(id: string): Promise<Amenity | null>;
  getAmenities(): Promise<Amenity[]>;
  getAmenitiesByCategory(category: AmenityCategory): Promise<Amenity[]>;
  getActiveAmenities(): Promise<Amenity[]>;
  updateAmenity(id: string, input: UpdateAmenityInput): Promise<Amenity>;
  deleteAmenity(id: string): Promise<void>;
  
  // Status Operations
  setStatus(id: string, status: AmenityStatus): Promise<Amenity>;
  openAmenity(id: string): Promise<Amenity>;
  closeAmenity(id: string): Promise<Amenity>;
  setMaintenance(id: string): Promise<Amenity>;
  activateAmenity(id: string): Promise<Amenity>;
  deactivateAmenity(id: string): Promise<Amenity>;
  
  // Schedule Management
  getSchedule(amenityId: string): Promise<AmenitySchedule[]>;
  setSchedule(amenityId: string, schedule: Omit<AmenitySchedule, 'id'>[]): Promise<AmenitySchedule[]>;
  isOpenAt(amenityId: string, dayOfWeek: number, time: string): Promise<boolean>;
  
  // Reservation Management
  createReservation(input: CreateReservationInput): Promise<AmenityReservation>;
  getReservation(id: string): Promise<AmenityReservation | null>;
  getReservationsForAmenity(amenityId: string, date: string): Promise<AmenityReservation[]>;
  getReservationsForGuest(guestId: string): Promise<AmenityReservation[]>;
  confirmReservation(id: string): Promise<AmenityReservation>;
  cancelReservation(id: string): Promise<AmenityReservation>;
  completeReservation(id: string): Promise<AmenityReservation>;
  markNoShow(id: string): Promise<AmenityReservation>;
  
  // Availability
  checkAvailability(amenityId: string, date: string, startTime: string, endTime: string): Promise<boolean>;
  getAvailableSlots(amenityId: string, date: string): Promise<{ startTime: string; endTime: string }[]>;
  
  // Utilities
  isValidTimeRange(startTime: string, endTime: string): boolean;
  parseTime(time: string): { hours: number; minutes: number };
  formatTime(hours: number, minutes: number): string;
  calculateDurationMinutes(startTime: string, endTime: string): number;
  calculateCost(amenity: Amenity, durationMinutes: number): number;
}

export function createAmenityService(container: Container): AmenityService {
  const { amenityRepository, logger } = container;
  
  function parseTime(time: string): { hours: number; minutes: number } {
    const [hours, minutes] = time.split(':').map(Number);
    return { hours: hours || 0, minutes: minutes || 0 };
  }
  
  function formatTime(hours: number, minutes: number): string {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  
  function isValidTimeRange(startTime: string, endTime: string): boolean {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;
    
    return endMinutes > startMinutes;
  }
  
  function calculateDurationMinutes(startTime: string, endTime: string): number {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;
    
    return endMinutes - startMinutes;
  }
  
  function calculateCost(amenity: Amenity, durationMinutes: number): number {
    if (amenity.isComplimentary || !amenity.pricePerHour) {
      return 0;
    }
    
    const hours = durationMinutes / 60;
    return Math.round(hours * amenity.pricePerHour * 100) / 100;
  }
  
  function doTimesOverlap(
    start1: string, 
    end1: string, 
    start2: string, 
    end2: string
  ): boolean {
    const s1 = parseTime(start1);
    const e1 = parseTime(end1);
    const s2 = parseTime(start2);
    const e2 = parseTime(end2);
    
    const start1Min = s1.hours * 60 + s1.minutes;
    const end1Min = e1.hours * 60 + e1.minutes;
    const start2Min = s2.hours * 60 + s2.minutes;
    const end2Min = e2.hours * 60 + e2.minutes;
    
    return start1Min < end2Min && end1Min > start2Min;
  }
  
  async function createAmenity(input: CreateAmenityInput): Promise<Amenity> {
    if (!input.name.trim()) {
      throw new Error('Amenity name is required');
    }
    
    if (!isValidTimeRange(input.openingTime, input.closingTime)) {
      throw new Error('Invalid time range: closing time must be after opening time');
    }
    
    const amenity = await amenityRepository.create({
      name: input.name.trim(),
      description: input.description,
      category: input.category,
      status: 'available',
      location: input.location,
      capacity: input.capacity,
      openingTime: input.openingTime,
      closingTime: input.closingTime,
      requiresReservation: input.requiresReservation || false,
      pricePerHour: input.pricePerHour,
      isComplimentary: input.isComplimentary ?? true,
      images: input.images || [],
      rules: input.rules || [],
      ageRestriction: input.ageRestriction,
      isActive: true
    });
    
    logger.info('Amenity created', { amenityId: amenity.id, name: amenity.name });
    
    return amenity;
  }
  
  async function getAmenity(id: string): Promise<Amenity | null> {
    return amenityRepository.getById(id);
  }
  
  async function getAmenities(): Promise<Amenity[]> {
    return amenityRepository.getAll();
  }
  
  async function getAmenitiesByCategory(category: AmenityCategory): Promise<Amenity[]> {
    return amenityRepository.getByCategory(category);
  }
  
  async function getActiveAmenities(): Promise<Amenity[]> {
    return amenityRepository.getActive();
  }
  
  async function updateAmenity(id: string, input: UpdateAmenityInput): Promise<Amenity> {
    const amenity = await amenityRepository.getById(id);
    
    if (!amenity) {
      throw new Error('Amenity not found');
    }
    
    // Validate time range if both times are being updated
    if (input.openingTime && input.closingTime) {
      if (!isValidTimeRange(input.openingTime, input.closingTime)) {
        throw new Error('Invalid time range: closing time must be after opening time');
      }
    } else if (input.openingTime) {
      if (!isValidTimeRange(input.openingTime, amenity.closingTime)) {
        throw new Error('Invalid time range: closing time must be after opening time');
      }
    } else if (input.closingTime) {
      if (!isValidTimeRange(amenity.openingTime, input.closingTime)) {
        throw new Error('Invalid time range: closing time must be after opening time');
      }
    }
    
    if (input.name !== undefined && !input.name.trim()) {
      throw new Error('Amenity name cannot be empty');
    }
    
    const updated = await amenityRepository.update(id, {
      ...input,
      name: input.name?.trim()
    });
    
    logger.info('Amenity updated', { amenityId: id });
    
    return updated;
  }
  
  async function deleteAmenity(id: string): Promise<void> {
    const amenity = await amenityRepository.getById(id);
    
    if (!amenity) {
      throw new Error('Amenity not found');
    }
    
    await amenityRepository.delete(id);
    
    logger.info('Amenity deleted', { amenityId: id });
  }
  
  async function setStatus(id: string, status: AmenityStatus): Promise<Amenity> {
    const amenity = await amenityRepository.getById(id);
    
    if (!amenity) {
      throw new Error('Amenity not found');
    }
    
    const updated = await amenityRepository.update(id, { status });
    
    logger.info('Amenity status changed', { amenityId: id, status });
    
    return updated;
  }
  
  async function openAmenity(id: string): Promise<Amenity> {
    return setStatus(id, 'available');
  }
  
  async function closeAmenity(id: string): Promise<Amenity> {
    return setStatus(id, 'closed');
  }
  
  async function setMaintenance(id: string): Promise<Amenity> {
    return setStatus(id, 'maintenance');
  }
  
  async function activateAmenity(id: string): Promise<Amenity> {
    const amenity = await amenityRepository.getById(id);
    
    if (!amenity) {
      throw new Error('Amenity not found');
    }
    
    const updated = await amenityRepository.update(id, { isActive: true });
    
    logger.info('Amenity activated', { amenityId: id });
    
    return updated;
  }
  
  async function deactivateAmenity(id: string): Promise<Amenity> {
    const amenity = await amenityRepository.getById(id);
    
    if (!amenity) {
      throw new Error('Amenity not found');
    }
    
    const updated = await amenityRepository.update(id, { isActive: false });
    
    logger.info('Amenity deactivated', { amenityId: id });
    
    return updated;
  }
  
  async function getSchedule(amenityId: string): Promise<AmenitySchedule[]> {
    return amenityRepository.getSchedule(amenityId);
  }
  
  async function setSchedule(
    amenityId: string, 
    schedule: Omit<AmenitySchedule, 'id'>[]
  ): Promise<AmenitySchedule[]> {
    const amenity = await amenityRepository.getById(amenityId);
    
    if (!amenity) {
      throw new Error('Amenity not found');
    }
    
    // Validate schedule entries
    for (const entry of schedule) {
      if (entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
        throw new Error('Invalid day of week: must be 0-6');
      }
      
      if (!entry.isClosed && !isValidTimeRange(entry.openingTime, entry.closingTime)) {
        throw new Error('Invalid time range in schedule');
      }
    }
    
    const saved = await amenityRepository.setSchedule(amenityId, schedule);
    
    logger.info('Schedule updated', { amenityId });
    
    return saved;
  }
  
  async function isOpenAt(amenityId: string, dayOfWeek: number, time: string): Promise<boolean> {
    const amenity = await amenityRepository.getById(amenityId);
    
    if (!amenity || !amenity.isActive || amenity.status !== 'available') {
      return false;
    }
    
    const schedule = await amenityRepository.getSchedule(amenityId);
    const daySchedule = schedule.find(s => s.dayOfWeek === dayOfWeek);
    
    if (daySchedule) {
      if (daySchedule.isClosed) return false;
      
      const { hours, minutes } = parseTime(time);
      const timeMinutes = hours * 60 + minutes;
      
      const openTime = parseTime(daySchedule.openingTime);
      const closeTime = parseTime(daySchedule.closingTime);
      
      const openMinutes = openTime.hours * 60 + openTime.minutes;
      const closeMinutes = closeTime.hours * 60 + closeTime.minutes;
      
      return timeMinutes >= openMinutes && timeMinutes < closeMinutes;
    }
    
    // Use default hours from amenity
    const { hours, minutes } = parseTime(time);
    const timeMinutes = hours * 60 + minutes;
    
    const openTime = parseTime(amenity.openingTime);
    const closeTime = parseTime(amenity.closingTime);
    
    const openMinutes = openTime.hours * 60 + openTime.minutes;
    const closeMinutes = closeTime.hours * 60 + closeTime.minutes;
    
    return timeMinutes >= openMinutes && timeMinutes < closeMinutes;
  }
  
  async function createReservation(input: CreateReservationInput): Promise<AmenityReservation> {
    const amenity = await amenityRepository.getById(input.amenityId);
    
    if (!amenity) {
      throw new Error('Amenity not found');
    }
    
    if (!amenity.isActive) {
      throw new Error('Amenity is not active');
    }
    
    if (amenity.status !== 'available') {
      throw new Error('Amenity is not available');
    }
    
    if (!isValidTimeRange(input.startTime, input.endTime)) {
      throw new Error('Invalid time range: end time must be after start time');
    }
    
    if (input.partySize < 1) {
      throw new Error('Party size must be at least 1');
    }
    
    if (amenity.capacity && input.partySize > amenity.capacity) {
      throw new Error('Party size exceeds amenity capacity');
    }
    
    // Check for conflicts
    const available = await checkAvailability(
      input.amenityId, 
      input.date, 
      input.startTime, 
      input.endTime
    );
    
    if (!available) {
      throw new Error('Time slot is not available');
    }
    
    const reservation = await amenityRepository.createReservation({
      amenityId: input.amenityId,
      guestId: input.guestId,
      guestName: input.guestName,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      partySize: input.partySize,
      status: 'pending',
      notes: input.notes
    });
    
    logger.info('Amenity reservation created', { 
      reservationId: reservation.id, 
      amenityId: input.amenityId 
    });
    
    return reservation;
  }
  
  async function getReservation(id: string): Promise<AmenityReservation | null> {
    return amenityRepository.getReservation(id);
  }
  
  async function getReservationsForAmenity(amenityId: string, date: string): Promise<AmenityReservation[]> {
    return amenityRepository.getReservationsByAmenity(amenityId, date);
  }
  
  async function getReservationsForGuest(guestId: string): Promise<AmenityReservation[]> {
    return amenityRepository.getReservationsByGuest(guestId);
  }
  
  async function confirmReservation(id: string): Promise<AmenityReservation> {
    const reservation = await amenityRepository.getReservation(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (reservation.status !== 'pending') {
      throw new Error('Can only confirm pending reservations');
    }
    
    const updated = await amenityRepository.updateReservation(id, {
      status: 'confirmed'
    });
    
    logger.info('Reservation confirmed', { reservationId: id });
    
    return updated;
  }
  
  async function cancelReservation(id: string): Promise<AmenityReservation> {
    const reservation = await amenityRepository.getReservation(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (['cancelled', 'completed', 'no_show'].includes(reservation.status)) {
      throw new Error('Cannot cancel reservation in current status');
    }
    
    await amenityRepository.cancelReservation(id);
    
    const updated = await amenityRepository.getReservation(id);
    
    logger.info('Reservation cancelled', { reservationId: id });
    
    return updated!;
  }
  
  async function completeReservation(id: string): Promise<AmenityReservation> {
    const reservation = await amenityRepository.getReservation(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (reservation.status !== 'confirmed') {
      throw new Error('Can only complete confirmed reservations');
    }
    
    const updated = await amenityRepository.updateReservation(id, {
      status: 'completed'
    });
    
    logger.info('Reservation completed', { reservationId: id });
    
    return updated;
  }
  
  async function markNoShow(id: string): Promise<AmenityReservation> {
    const reservation = await amenityRepository.getReservation(id);
    
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    
    if (reservation.status !== 'confirmed') {
      throw new Error('Can only mark confirmed reservations as no-show');
    }
    
    const updated = await amenityRepository.updateReservation(id, {
      status: 'no_show'
    });
    
    logger.info('Reservation marked as no-show', { reservationId: id });
    
    return updated;
  }
  
  async function checkAvailability(
    amenityId: string, 
    date: string, 
    startTime: string, 
    endTime: string
  ): Promise<boolean> {
    const reservations = await amenityRepository.getReservationsByAmenity(amenityId, date);
    
    const activeReservations = reservations.filter(r => 
      !['cancelled', 'no_show'].includes(r.status)
    );
    
    for (const reservation of activeReservations) {
      if (doTimesOverlap(startTime, endTime, reservation.startTime, reservation.endTime)) {
        return false;
      }
    }
    
    return true;
  }
  
  async function getAvailableSlots(
    amenityId: string, 
    date: string
  ): Promise<{ startTime: string; endTime: string }[]> {
    const amenity = await amenityRepository.getById(amenityId);
    
    if (!amenity) {
      return [];
    }
    
    const reservations = await amenityRepository.getReservationsByAmenity(amenityId, date);
    const activeReservations = reservations
      .filter(r => !['cancelled', 'no_show'].includes(r.status))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    const slots: { startTime: string; endTime: string }[] = [];
    let currentTime = amenity.openingTime;
    
    for (const reservation of activeReservations) {
      if (currentTime < reservation.startTime) {
        slots.push({
          startTime: currentTime,
          endTime: reservation.startTime
        });
      }
      currentTime = reservation.endTime;
    }
    
    if (currentTime < amenity.closingTime) {
      slots.push({
        startTime: currentTime,
        endTime: amenity.closingTime
      });
    }
    
    return slots;
  }
  
  return {
    createAmenity,
    getAmenity,
    getAmenities,
    getAmenitiesByCategory,
    getActiveAmenities,
    updateAmenity,
    deleteAmenity,
    setStatus,
    openAmenity,
    closeAmenity,
    setMaintenance,
    activateAmenity,
    deactivateAmenity,
    getSchedule,
    setSchedule,
    isOpenAt,
    createReservation,
    getReservation,
    getReservationsForAmenity,
    getReservationsForGuest,
    confirmReservation,
    cancelReservation,
    completeReservation,
    markNoShow,
    checkAvailability,
    getAvailableSlots,
    isValidTimeRange,
    parseTime,
    formatTime,
    calculateDurationMinutes,
    calculateCost
  };
}
