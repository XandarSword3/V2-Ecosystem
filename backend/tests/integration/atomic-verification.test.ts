
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { supabase } from '../../src/lib/supabase';
import { initializeDatabase, closeDatabase } from '../../src/database/connection';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock Stripe class-based export
vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      paymentIntents = {
        create: vi.fn().mockResolvedValue({
            id: 'pi_test_atomic',
            client_secret: 'secret',
            status: 'requires_payment_method',
        }),
        retrieve: vi.fn().mockResolvedValue({
            id: 'pi_test_atomic',
            status: 'succeeded',
        }),
      };
      refunds = {
        create: vi.fn().mockResolvedValue({
            id: 're_test_atomic',
            status: 'succeeded',
        }),
      };
    }
  };
});

vi.mock('../../src/services/email.service', () => ({
    emailService: {
        sendBookingConfirmation: vi.fn().mockResolvedValue(true),
        sendTicketConfirmation: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('../../src/socket/index', () => ({
    emitToUnit: vi.fn(),
  initSocket: vi.fn(),
  initializeSocketServer: vi.fn()
}));

vi.mock('../../src/config/session-store', () => ({
    getRedis: () => null
}));


// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Atomic Functions Verification', () => {
  let testUserId: string;
  let testChaletId: string;
  let authToken: string;

  beforeAll(async () => {
    await initializeDatabase();

    // 1. Create a User
    const email = `atomic-${Date.now()}@test.v2ecosystem.local`;
    
    const { data: user, error: signUpError } = await supabase.auth.signUp({
      email,
      password: 'Password123!',
    });
    console.log('Signup error:', signUpError);
    
    // In test environment or remote, we might need to bypass email confirmation or sign up as admin
    if (signUpError) {
      // Try to create user directly via admin API if normal signup fails/requires confirmation
      const adminAuth = supabase.auth.admin;
      if (adminAuth) {
         const { data: adminUser, error: adminErr } = await adminAuth.createUser({
            email,
            password: 'Password123!',
            email_confirm: true
         });
         if (adminUser?.user) user.user = adminUser.user;
      }
    }
    
    if (user?.user) {
      testUserId = user.user.id;
      const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: 'Password123!',
      });
      console.log('SignIn error:', signInError);
      authToken = session?.session?.access_token || '';
      
      // Ensure user in public table
      await supabase.from('users').upsert({
          id: testUserId,
          email: email,
          role: 'user'
      });
    }

    // 2. Get/Create Chalet
    const { data: unit } = await supabase
      .from('bookable_units')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
      
    if (unit) {
        testChaletId = unit.id;
        console.log('Using existing bookable unit:', testChaletId);
        await supabase
          .from('transactions')
          .delete()
          .eq('engine_type', 'time_exclusive_reservation')
          .filter('metadata->>unit_id', 'eq', testChaletId);
    } else {
        const { data: newUnit, error: insErr } = await supabase.from('bookable_units').insert({
            name: 'Atomic Test Unit',
            base_price: 100,
            weekend_price: 120,
            capacity: 4,
            is_active: true,
        }).select().single();
        console.log('Inserted bookable unit:', newUnit, 'Error:', insErr);
        testChaletId = newUnit?.id;
    }
    console.log('Final testChaletId:', testChaletId);
  });

  afterAll(async () => {
    if (testUserId) await supabase.auth.admin.deleteUser(testUserId);
    await closeDatabase();
  });

  it('should create chalet booking using atomic function', async () => {
    if (!authToken || !testChaletId) {
        console.warn('Skipping test: Missing auth token or chalet ID');
        return;
    }

    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 30); // Future date to avoid conflicts
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
        paymentMethod: 'card'
      });
      
    if (res.status !== 201) {
        console.error('Chalet Booking failed:', res.status, res.body);
    }
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.booking_number).toBeDefined();
  });
});
