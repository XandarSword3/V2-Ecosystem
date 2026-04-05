import { test, expect } from '../fixtures/auth.fixture';
import type { APIRequestContext } from '@playwright/test';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3005';

type ChaletSummary = {
  id: string;
  max_guests?: number;
  maxGuests?: number;
};

function getIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString();
}

async function getCsrfToken(request: APIRequestContext): Promise<string> {
  const csrfResponse = await request.get(`${API_BASE_URL}/api/csrf-token`);
  expect(csrfResponse.status()).toBe(200);

  const csrfBody = await csrfResponse.json();
  const csrfToken = csrfBody?.csrfToken as string | undefined;
  expect(csrfToken).toBeTruthy();

  return csrfToken as string;
}

async function findBookableChalet(
  request: APIRequestContext,
  checkInDate: string,
  checkOutDate: string,
): Promise<ChaletSummary> {
  const chaletsResponse = await request.get(`${API_BASE_URL}/api/v1/chalets`);
  expect(chaletsResponse.status()).toBe(200);

  const chaletsBody = await chaletsResponse.json();
  const chalets = (chaletsBody?.data || []) as ChaletSummary[];
  expect(chalets.length).toBeGreaterThan(0);

  const startDay = checkInDate.slice(0, 10);
  const endDay = checkOutDate.slice(0, 10);

  for (const chalet of chalets) {
    if (!chalet?.id) {
      continue;
    }

    const availabilityResponse = await request.get(
      `${API_BASE_URL}/api/v1/chalets/${chalet.id}/availability`,
      {
        params: { startDate: startDay, endDate: endDay },
      },
    );

    if (availabilityResponse.status() !== 200) {
      continue;
    }

    const availabilityBody = await availabilityResponse.json();
    const blockedDates = Array.isArray(availabilityBody?.data?.blockedDates)
      ? availabilityBody.data.blockedDates
      : [];
    const hasOverlap = blockedDates.some(
      (blockedDate: string) => blockedDate >= startDay && blockedDate < endDay,
    );

    if (!hasOverlap) {
      return chalet;
    }
  }

  throw new Error('No available chalet found for smoke booking window');
}

test.describe('Smoke 02 - Core Booking Flow', () => {
  test('SMOKE-02 @smoke customer can create and retrieve a chalet booking', async ({ request, auth }) => {
    const customerToken = await auth.getApiToken('customer');
    const csrfToken = await getCsrfToken(request);
    const checkInDate = getIsoDate(10);
    const checkOutDate = getIsoDate(12);
    const chalet = await findBookableChalet(request, checkInDate, checkOutDate);
    const maxGuests = Number(chalet.max_guests ?? chalet.maxGuests ?? 2);
    const numberOfGuests = Math.max(1, Math.min(2, Number.isFinite(maxGuests) ? maxGuests : 2));

    const createResponse = await request.post(`${API_BASE_URL}/api/v1/chalets/bookings`, {
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'x-csrf-token': csrfToken,
      },
      data: {
        chaletId: chalet.id,
        customerName: 'Smoke Customer',
        customerEmail: `smoke.booking.${Date.now()}@example.com`,
        customerPhone: '+15550001234',
        checkInDate,
        checkOutDate,
        numberOfGuests,
        paymentMethod: 'card',
      },
    });

    expect(createResponse.status()).toBe(201);
    const createdBody = await createResponse.json();
    expect(createdBody?.success).toBe(true);

    const bookingId = createdBody?.data?.id as string | undefined;
    expect(bookingId).toBeTruthy();

    const fetchResponse = await request.get(`${API_BASE_URL}/api/v1/chalets/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(fetchResponse.status()).toBe(200);

    const fetchedBody = await fetchResponse.json();
    expect(fetchedBody?.success).toBe(true);
    expect(fetchedBody?.data?.id).toBe(bookingId);
    expect(fetchedBody?.data?.chalet_id).toBe(chalet.id);

    const myBookingsResponse = await request.get(`${API_BASE_URL}/api/v1/chalets/my-bookings`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(myBookingsResponse.status()).toBe(200);

    const myBookingsBody = await myBookingsResponse.json();
    const rows = Array.isArray(myBookingsBody?.data) ? myBookingsBody.data : [];
    expect(rows.some((row: { id?: string }) => row.id === bookingId)).toBe(true);
  });
});