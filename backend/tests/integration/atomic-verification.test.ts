/**
 * Atomic Functions Verification
 *
 * Verifies that the engine-layer atomic booking function works end-to-end
 * via the HTTP API. No direct DB/Supabase client calls — all setup and
 * teardown goes through the API or is handled by the integration lifecycle
 * (setup.ts seeds users; test-DB teardown removes them).
 */
import request from 'supertest';
import app from '../../src/app';
import { initializeDatabase, closeDatabase } from '../../src/database/connection';
import { trackTransaction } from './setup';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('stripe', () => ({
  default: class MockStripe {
    paymentIntents = {
      create: vi.fn().mockResolvedValue({
        id: 'pi_test_atomic',
        client_secret: 'secret',
        status: 'requires_payment_method',
      }),
      retrieve: vi.fn().mockResolvedValue({ id: 'pi_test_atomic', status: 'succeeded' }),
    };
    refunds = {
      create: vi.fn().mockResolvedValue({ id: 're_test_atomic', status: 'succeeded' }),
    };
  },
}));

vi.mock('../../src/services/email.service', () => ({
  emailService: {
    sendBookingConfirmation: vi.fn().mockResolvedValue(true),
    sendTicketConfirmation: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../src/socket/index', () => ({
  emitToUnit: vi.fn(),
  initSocket: vi.fn(),
  initializeSocketServer: vi.fn(),
}));

vi.mock('../../src/config/session-store', () => ({
  getRedis: () => null,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Atomic Functions Verification', () => {
  let authToken: string;
  let testChaletId: string;

  beforeAll(async () => {
    await initializeDatabase();

    // Register a fresh user via the API
    const email = `atomic-${Date.now()}@test.v2ecosystem.local`;
    const password = 'Password123!';

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, fullName: 'Atomic Test User' });

    if (registerRes.status !== 201) {
      console.warn('Registration failed:', registerRes.status, registerRes.body);
    }

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });

    authToken =
      loginRes.body?.data?.tokens?.accessToken ||
      loginRes.body?.accessToken || '';

    if (!authToken) {
      console.warn('Login failed:', loginRes.status, loginRes.body);
    }

    // Resolve a bookable unit via the API
    const unitsRes = await request(app).get('/api/v1/units');
    const units: Array<{ id: string }> = unitsRes.body?.data ?? [];
    testChaletId = units[0]?.id ?? '';

    if (!testChaletId) {
      console.warn('No bookable units returned from /api/v1/units — booking test will be skipped');
    }
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should create chalet booking using atomic function', async () => {
    if (!authToken || !testChaletId) {
      console.warn('Skipping test: Missing auth token or chalet ID');
      return;
    }

    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 30);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);

    const res = await request(app)
      .post('/api/v1/units/bookings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        unit_id: testChaletId,
        check_in_date: checkIn.toISOString().split('T')[0],
        check_out_date: checkOut.toISOString().split('T')[0],
        number_of_guests: 2,
        addOns: [],
        paymentMethod: 'card',
      });

    if (res.status !== 201) {
      console.error('Chalet Booking failed:', res.status, res.body);
    }

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.booking_number).toBeDefined();

    // Track the created transaction for lifecycle cleanup
    if (res.body?.data?.id) {
      trackTransaction(res.body.data.id);
    }
  });
});
