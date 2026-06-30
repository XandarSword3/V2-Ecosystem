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
 * Credentials are resolved in priority order:
 *   1. Constructor params (from tenant_integrations DB row via getTenantIntegration)
 *   2. Environment variables (legacy single-tenant / platform-level fallback)
 *
 * The channel service is responsible for resolving and passing per-tenant
 * credentials so multiple tenants can each have their own SiteMinder account.
 */
export class SiteMinderAdapter implements OTAAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly propertyId: string;

  constructor(credentials?: { apiKey?: string; propertyId?: string; baseUrl?: string }) {
    this.baseUrl    = credentials?.baseUrl    || process.env.SITEMINDER_BASE_URL    || 'https://api.siteminder.com';
    this.apiKey     = credentials?.apiKey     || process.env.SITEMINDER_API_KEY     || '';
    this.propertyId = credentials?.propertyId || process.env.SITEMINDER_PROPERTY_ID || '';
  }

  getName(): string {
    return 'siteminder';
  }

  private assertConfigured(): void {
    if (!this.apiKey || !this.propertyId) {
      throw new Error(
        'SiteMinder not configured for this tenant. Configure SiteMinder credentials via Settings → Integrations or set SITEMINDER_API_KEY and SITEMINDER_PROPERTY_ID environment variables.'
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
