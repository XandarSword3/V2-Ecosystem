export interface AvailabilityResult {
  roomId: string;
  from: Date;
  to: Date;
  values: Array<{ date: string; available: number }>;
}

export interface RateResult {
  roomId: string;
  from: Date;
  to: Date;
  values: Array<{ date: string; rate: number; currency?: string }>;
}

export interface Reservation {
  id: string;
  from: Date;
  to: Date;
  guestName?: string;
  status?: string;
}

export interface ReservationInput {
  roomId: string;
  from: Date;
  to: Date;
  guestName?: string;
  guestEmail?: string;
  notes?: string;
}

export interface OTAAdapter {
  getName(): string;
  getAvailability(roomId: string, from: Date, to: Date): Promise<AvailabilityResult>;
  updateAvailability(roomId: string, date: Date, available: number): Promise<void>;
  getRates(roomId: string, from: Date, to: Date): Promise<RateResult>;
  updateRates(roomId: string, date: Date, rate: number): Promise<void>;
  getReservations(from: Date, to: Date): Promise<Reservation[]>;
  createReservation(reservation: ReservationInput): Promise<string>;
  cancelReservation(reservationId: string): Promise<void>;
}
