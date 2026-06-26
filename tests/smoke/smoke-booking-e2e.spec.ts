import { test, expect } from '../fixtures/auth.fixture';
import type { APIRequestContext } from '../fixtures/auth.fixture';

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
): Promise<ChaletSummary | null> {
  const chaletsResponse = await request.get(`${API_BASE_URL}/api/v1/units`);
  expect(chaletsResponse.status()).toBe(200);

  const chaletsBody = await chaletsResponse.json();
  const accommodation_units = (chaletsBody?.data || []) as ChaletSummary[];
  expect(accommodation_units.length).toBeGreaterThan(0);

  const startDay = checkInDate.slice(0, 10);
  const endDay = checkOutDate.slice(0, 10);

  for (const accommodationUnit of accommodation_units) {
    if (!accommodationUnit?.id) {
      continue;
    }

    const availabilityResponse = await request.get(
      `${API_BASE_URL}/api/v1/units/${accommodationUnit.id}/availability`,
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
      return accommodationUnit;
    }
  }

  return null;
}

test.describe('Smoke 02 - Core Booking Flow', () => {
  test('SMOKE-02 @smoke customer can create and retrieve a accommodation unit booking', async ({ request, auth }) => {
    const customerToken = await auth.getApiToken('customer');
    const csrfToken = await getCsrfToken(request);

    // Availability is data-dependent, so try a few windows before deciding to skip.
    const candidateWindows = [
      { checkInDate: getIsoDate(10), checkOutDate: getIsoDate(12) },
      { checkInDate: getIsoDate(20), checkOutDate: getIsoDate(22) },
      { checkInDate: getIsoDate(30), checkOutDate: getIsoDate(32) },
    ];

    let selectedWindow: { checkInDate: string; checkOutDate: string; accommodationUnit: ChaletSummary } | null = null;
    for (const window of candidateWindows) {
      const accommodationUnit = await findBookableChalet(request, window.checkInDate, window.checkOutDate);
      if (accommodationUnit) {
        selectedWindow = { ...window, accommodationUnit };
        break;
      }
    }

    test.skip(!selectedWindow, 'No available accommodation unit found across smoke booking windows');
    if (!selectedWindow) {
      return;
    }

    const { checkInDate, checkOutDate, accommodationUnit } = selectedWindow;
    const maxGuests = Number(accommodationUnit.max_guests ?? accommodationUnit.maxGuests ?? 2);
    const numberOfGuests = Math.max(1, Math.min(2, Number.isFinite(maxGuests) ? maxGuests : 2));

    const createResponse = await request.post(`${API_BASE_URL}/api/v1/units/bookings`, {
      headers: {
        Authorization: `Bearer ${customerToken}`,
        'x-csrf-token': csrfToken,
      },
      data: {
        unitId: accommodationUnit.id,
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

    const fetchResponse = await request.get(`${API_BASE_URL}/api/v1/units/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(fetchResponse.status()).toBe(200);

    const fetchedBody = await fetchResponse.json();
    expect(fetchedBody?.success).toBe(true);
    expect(fetchedBody?.data?.id).toBe(bookingId);
    expect(fetchedBody?.data?.unit_id).toBe(accommodationUnit.id);

    const myBookingsResponse = await request.get(`${API_BASE_URL}/api/v1/units/my-bookings`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    expect(myBookingsResponse.status()).toBe(200);

    const myBookingsBody = await myBookingsResponse.json();
    const rows = Array.isArray(myBookingsBody?.data) ? myBookingsBody.data : [];
    expect(rows.some((row: { id?: string }) => row.id === bookingId)).toBe(true);
  });
});
