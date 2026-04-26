import type {
  OTAAdapter,
  AvailabilityResult,
  RateResult,
  Reservation,
  ReservationInput,
} from './ota-adapter.interface.js';

export class SiteMinderAdapter implements OTAAdapter {
  getName(): string {
    return 'siteminder';
  }

  async getAvailability(roomId: string, from: Date, to: Date): Promise<AvailabilityResult> {
    return {
      roomId,
      from,
      to,
      values: [],
    };
  }

  async updateAvailability(roomId: string, date: Date, available: number): Promise<void> {
    void roomId;
    void date;
    void available;
  }

  async getRates(roomId: string, from: Date, to: Date): Promise<RateResult> {
    return {
      roomId,
      from,
      to,
      values: [],
    };
  }

  async updateRates(roomId: string, date: Date, rate: number): Promise<void> {
    void roomId;
    void date;
    void rate;
  }

  async getReservations(from: Date, to: Date): Promise<Reservation[]> {
    void from;
    void to;
    return [];
  }

  async createReservation(reservation: ReservationInput): Promise<string> {
    void reservation;
    throw new Error('Direct reservation creation is not implemented for SiteMinder adapter');
  }

  async cancelReservation(reservationId: string): Promise<void> {
    void reservationId;
  }
}
