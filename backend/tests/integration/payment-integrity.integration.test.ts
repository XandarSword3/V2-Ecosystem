/**
 * Integration proofs for the payment-schema fixes.
 *
 * Real Postgres/Supabase (local `.env.test`), real HTTP routes. No mocks.
 *
 * Covers:
 *   - postRoomCharge reads `transactions.amount` / `currency` (not the
 *     nonexistent `total_amount`) and writes payments + payment_ledger;
 *   - updateReferencePaymentStatus writes `metadata.payment_status` (not the
 *     nonexistent `payment_status` column) and throws instead of discarding
 *     lookup/update errors;
 *   - payModuleOrder rejects an under-tender before any settlement/ledger
 *     write, and accepts exact tender.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import app from '../../src/app';
import { getSupabase } from '../../src/database/supabase';
import { updateReferencePaymentStatus } from '../../src/modules/payments/payment.controller';

const password = 'PaymentIntegrity123!';

describe('payment integrity (real database)', () => {
  const supabase = getSupabase();
  const run = randomUUID().slice(0, 8);

  let tenantId = '';
  let propertyId = '';
  let moduleId = '';
  let moduleSlug = '';
  let staffId = '';
  let token = '';
  let posOrderId = '';
  let bookingId = '';
  let directOrderId = '';
  let underTenderOrderId = '';
  let exactTenderOrderId = '';

  const pricingSnapshot = {
    currency: 'USD',
    subtotal: 20,
    taxAmount: 0,
    taxRate: 0,
    taxBreakdown: [],
    serviceCharge: 0,
    serviceChargeRate: 0,
    deliveryFee: 0,
    feeBreakdown: [],
    preDiscountTotal: 20,
    discounts: [],
    totalDiscount: 0,
    totalAmount: 20,
    lineItems: [
      { itemId: 'integration-item', name: 'Integration Item', unitPrice: 20, unitAdjustment: 0, quantity: 1, lineTotal: 20 },
    ],
    loyaltyPointsEarned: 0,
    depositAmount: 0,
  };

  async function insertTransaction(input: {
    engineType: 'instant_transaction' | 'time_exclusive_reservation';
    status: string;
    amount: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  }) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        engine_type: input.engineType,
        status: input.status,
        amount: input.amount,
        currency: input.currency ?? 'USD',
        module_id: moduleId,
        tenant_id: tenantId,
        property_id: propertyId,
        metadata: input.metadata ?? {},
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(`transaction fixture failed: ${error?.message}`);
    return data.id as string;
  }

  beforeAll(async () => {
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({ subdomain: `payment-integrity-${run}` })
      .select('id')
      .single();
    if (tenantErr || !tenant) throw new Error(`tenant fixture failed: ${tenantErr?.message}`);
    tenantId = tenant.id;

    const { data: property, error: propErr } = await supabase
      .from('properties')
      .insert({ name: `Payment Integrity ${run}`, tenant_id: tenantId })
      .select('id')
      .single();
    if (propErr || !property) throw new Error(`property fixture failed: ${propErr?.message}`);
    propertyId = property.id;

    moduleSlug = `payment-integrity-${run}`;
    const { data: mod, error: modErr } = await supabase
      .from('modules')
      .insert({
        name: 'Payment Integrity Module',
        slug: moduleSlug,
        engine_type: 'instant_transaction',
        tenant_id: tenantId,
        property_id: propertyId,
        is_active: true,
      })
      .select('id')
      .single();
    if (modErr || !mod) throw new Error(`module fixture failed: ${modErr?.message}`);
    moduleId = mod.id;

    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        email: `payment-integrity-${run}@integration.test`,
        password_hash: await bcrypt.hash(password, 12),
        full_name: 'Payment Integrity Staff',
        scope: 'property_staff',
        roles: ['staff'],
        tenant_id: tenantId,
        token_version: 0,
        is_active: true,
        email_verified: true,
      })
      .select('id')
      .single();
    if (userErr || !user) throw new Error(`user fixture failed: ${userErr?.message}`);
    staffId = user.id;

    const { error: accessErr } = await supabase
      .from('user_property_access')
      .insert({ user_id: staffId, property_id: propertyId, tenant_id: tenantId, access_level: 'staff' });
    if (accessErr) throw new Error(`access fixture failed: ${accessErr.message}`);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Tenant-ID', tenantId)
      .send({ email: `payment-integrity-${run}@integration.test`, password });
    if (login.status !== 200) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
    token = login.body.data?.accessToken || login.body.data?.tokens?.accessToken;
    if (!token) throw new Error('login returned no access token');

    posOrderId = await insertTransaction({
      engineType: 'instant_transaction',
      status: 'open',
      amount: 42.5,
      currency: 'EUR',
      metadata: { payment_status: 'unpaid' },
    });
    bookingId = await insertTransaction({
      engineType: 'time_exclusive_reservation',
      status: 'checked_in',
      amount: 0,
      metadata: { payment_status: 'unpaid', check_in_date: new Date().toISOString().slice(0, 10) },
    });
    directOrderId = await insertTransaction({
      engineType: 'instant_transaction',
      status: 'open',
      amount: 33.25,
      metadata: { payment_status: 'unpaid' },
    });
    underTenderOrderId = await insertTransaction({
      engineType: 'instant_transaction',
      status: 'confirmed',
      amount: 20,
      metadata: {
        payment_status: 'unpaid',
        pricing: pricingSnapshot,
        fulfillment_mode: 'none',
        fulfillment_destination_type: 'none',
      },
    });
    exactTenderOrderId = await insertTransaction({
      engineType: 'instant_transaction',
      status: 'confirmed',
      amount: 20,
      metadata: {
        payment_status: 'unpaid',
        pricing: pricingSnapshot,
        fulfillment_mode: 'none',
        fulfillment_destination_type: 'none',
      },
    });
  });

  afterAll(async () => {
    const ids = [posOrderId, bookingId, directOrderId, underTenderOrderId, exactTenderOrderId].filter(Boolean);
    if (ids.length > 0) {
      await supabase.from('payment_ledger').delete().in('reference_id', ids);
      await supabase.from('engine_financial_ledger').delete().in('entity_id', ids);
      await supabase.from('payments').delete().in('reference_id', ids);
      await supabase.from('transactions').delete().in('id', ids);
    }
    if (staffId) {
      await supabase.from('user_property_access').delete().eq('user_id', staffId);
      await supabase.from('users').delete().eq('id', staffId);
    }
    if (moduleId) await supabase.from('modules').delete().eq('id', moduleId);
    if (propertyId) await supabase.from('properties').delete().eq('id', propertyId);
    if (tenantId) await supabase.from('tenants').delete().eq('id', tenantId);
  });

  it('postRoomCharge uses the real amount/currency columns and records ledger + payment', async () => {
    const res = await request(app)
      .post('/api/v1/payments/room-charge')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenantId)
      .set('X-Property-ID', propertyId)
      .send({ orderId: posOrderId, bookingId });

    expect(res.status).toBe(201);

    const { data: order } = await supabase
      .from('transactions')
      .select('metadata')
      .eq('id', posOrderId)
      .single();
    expect(order?.metadata?.payment_status).toBe('paid');

    const { data: payment } = await supabase
      .from('payments')
      .select('amount, currency, method, status')
      .eq('reference_id', posOrderId)
      .single();
    expect(Number(payment?.amount)).toBe(42.5);
    expect(payment?.currency).toBe('EUR');
    expect(payment?.method).toBe('room_charge');
    expect(payment?.status).toBe('completed');

    const { data: ledger } = await supabase
      .from('payment_ledger')
      .select('amount, currency, event_type')
      .eq('reference_id', bookingId)
      .eq('event_type', 'charge')
      .single();
    expect(Number(ledger?.amount)).toBe(42.5);
    expect(ledger?.currency).toBe('EUR');
  });

  it('updateReferencePaymentStatus writes metadata.payment_status and throws instead of discarding errors', async () => {
    await updateReferencePaymentStatus('instant_transaction', directOrderId, 'partial');

    const { data: order } = await supabase
      .from('transactions')
      .select('metadata')
      .eq('id', directOrderId)
      .single();
    expect(order?.metadata?.payment_status).toBe('partial');

    await expect(
      updateReferencePaymentStatus('instant_transaction', randomUUID(), 'paid'),
    ).rejects.toThrow(/Failed to record payment status|Could not look up/);
  });

  it('payModuleOrder rejects an under-tender and writes no ledger entry', async () => {
    const res = await request(app)
      .post(`/api/v1/staff/modules/${moduleSlug}/orders/${underTenderOrderId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenantId)
      .set('X-Property-ID', propertyId)
      .send({ paymentMethod: 'cash', amountPaid: 19.99, tipAmount: 0 });

    expect(res.status).toBe(400);
    expect(String(res.body?.error || '')).toMatch(/below the amount due/i);

    const { data: order } = await supabase
      .from('transactions')
      .select('metadata')
      .eq('id', underTenderOrderId)
      .single();
    expect(order?.metadata?.payment_status).toBe('unpaid');

    const { count } = await supabase
      .from('engine_financial_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', underTenderOrderId);
    expect(count ?? 0).toBe(0);
  });

  it('payModuleOrder accepts exact tender and records the settlement once', async () => {
    const res = await request(app)
      .post(`/api/v1/staff/modules/${moduleSlug}/orders/${exactTenderOrderId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', tenantId)
      .set('X-Property-ID', propertyId)
      .send({ paymentMethod: 'cash', amountPaid: 20, tipAmount: 0 });

    expect(res.status).toBe(200);
    expect(res.body?.data?.paymentStatus).toBe('paid');

    const { data: order } = await supabase
      .from('transactions')
      .select('metadata')
      .eq('id', exactTenderOrderId)
      .single();
    expect(order?.metadata?.payment_status).toBe('paid');
    expect(Number(order?.metadata?.amount_paid)).toBe(20);

    const { count } = await supabase
      .from('engine_financial_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', exactTenderOrderId);
    expect(count).toBe(1);
  });
});
