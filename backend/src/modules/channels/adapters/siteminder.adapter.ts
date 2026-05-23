import type {
  OTAAdapter,
  AvailabilityResult,
  RateResult,
  Reservation,
  ReservationInput,
} from './ota-adapter.interface.js';
import { logger } from '../../../utils/logger.js';

/**
 * SiteMinder Channel Manager Adapter
 *
 * Implements the OTAAdapter interface using SiteMinder's REST API.
 * Credentials are read from environment variables:
 *   SITEMINDER_API_KEY      — Bearer token / API key
 *   SITEMINDER_PROPERTY_ID  — Property/hotel identifier in SiteMinder
 *   SITEMINDER_BASE_URL     — Base URL (default: https://api.siteminder.com)
 *
 * All methods throw with a descriptive message if credentials are missing,
 * so the channel service can surface a proper error to the admin rather than
 * silently returning empty data.
 */
export class SiteMinderAdapter implements OTAAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly propertyId: string;

  constructor() {
    this.baseUrl   = process.env.SITEMINDER_BASE_URL    || 'https://api.siteminder.com';
    this.apiKey    = process.env.SITEMINDER_API_KEY     || '';
    this.propertyId = process.env.SITEMINDER_PROPERTY_ID || '';
  }

  getName(): string {
    return 'siteminder';
  }

  private assertConfigured(): void {
    if (!this.apiKey || !this.propertyId) {
      throw new Error(
        'SiteMinder not configured. Set SITEMINDER_API_KEY and SITEMINDER_PROPERTY_ID environment variables.'
      );
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    this.assertConfigured();

    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`SiteMinder API error ${res.status} on ${method} ${path}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async getAvailability(roomId: string, from: Date, to: Date): Promise<AvailabilityResult> {
    const fromStr = from.toISOString().split('T')[0];
    const toStr   = to.toISOString().split('T')[0];

    type SMAvailResponse = { availability: Array<{ date: string; available: number }> };
    const data = await this.request<SMAvailResponse>(
      'GET',
      `/v1/properties/${this.propertyId}/rooms/${roomId}/availability?from=${fromStr}&to=${toStr}`,
    );

    logger.info('[SiteMinder] getAvailability', { roomId, fromStr, toStr, count: data.availability?.length });

    return {
      roomId,
      from,
      to,
      values: (data.availability || []).map(a => ({
        date: a.date,
        available: a.available,
      })),
    };
  }

  async updateAvailability(roomId: string, date: Date, available: number): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];

    await this.request('PUT', `/v1/properties/${this.propertyId}/rooms/${roomId}/availability`, {
      updates: [{ date: dateStr, available }],
    });

    logger.info('[SiteMinder] updateAvailability', { roomId, dateStr, available });
  }

  async getRates(roomId: string, from: Date, to: Date): Promise<RateResult> {
    const fromStr = from.toISOString().split('T')[0];
    const toStr   = to.toISOString().split('T')[0];

    type SMRateResponse = { rates: Array<{ date: string; rate: number; currency: string }> };
    const data = await this.request<SMRateResponse>(
      'GET',
      `/v1/properties/${this.propertyId}/rooms/${roomId}/rates?from=${fromStr}&to=${toStr}`,
    );

    logger.info('[SiteMinder] getRates', { roomId, fromStr, toStr, count: data.rates?.length });

    return {
      roomId,
      from,
      to,
      values: (data.rates || []).map(r => ({
        date: r.date,
        rate: r.rate,
        currency: r.currency,
      })),
    };
  }

  async updateRates(roomId: string, date: Date, rate: number): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];

    await this.request('PUT', `/v1/properties/${this.propertyId}/rooms/${roomId}/rates`, {
      updates: [{ date: dateStr, rate }],
    });

    logger.info('[SiteMinder] updateRates', { roomId, dateStr, rate });
  }

  async getReservations(from: Date, to: Date): Promise<Reservation[]> {
    const fromStr = from.toISOString().split('T')[0];
    const toStr   = to.toISOString().split('T')[0];

    type SMReservation = {
      id: string;
      roomId: string;
      guestName: string;
      guestEmail?: string;
      checkIn: string;
      checkOut: string;
      status: string;
      totalAmount: number;
      currency: string;
      source: string;
    };
    type SMReservationsResponse = { reservations: SMReservation[] };

    const data = await this.request<SMReservationsResponse>(
      'GET',
      `/v1/properties/${this.propertyId}/reservations?from=${fromStr}&to=${toStr}`,
    );

    logger.info('[SiteMinder] getReservations', { fromStr, toStr, count: data.reservations?.length });

    return (data.reservations || []).map(r => ({
      id: r.id,
      from: new Date(r.checkIn),
      to: new Date(r.checkOut),
      guestName: r.guestName,
      status: r.status,
    }));
  }

  async createReservation(reservation: ReservationInput): Promise<string> {
    type SMCreateResponse = { reservationId: string };
    const data = await this.request<SMCreateResponse>(
      'POST',
      `/v1/properties/${this.propertyId}/reservations`,
      reservation,
    );

    logger.info('[SiteMinder] createReservation', { reservationId: data.reservationId });
    return data.reservationId;
  }

  async cancelReservation(reservationId: string): Promise<void> {
    await this.request(
      'DELETE',
      `/v1/properties/${this.propertyId}/reservations/${reservationId}`,
    );

    logger.info('[SiteMinder] cancelReservation', { reservationId });
  }
}
