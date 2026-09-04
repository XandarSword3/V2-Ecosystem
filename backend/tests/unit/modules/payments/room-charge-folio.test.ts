/**
 * Room Charge Folio Unit Tests
 *
 * Tests: POS room charging, folio balance calculation, folio settlement,
 *        and checkout balance enforcement guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// ── Mocks ────────────────────────────────────────────────────────────

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabase,
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../src/engines/engine-service.js', () => ({
  getEngineService: () => ({
    transitionState: vi.fn().mockResolvedValue({ success: true, data: { status: 'checked_out' } }),
  }),
}));

import {
  postRoomCharge,
  getFolioBalance,
  settleFolioBalance,
} from '../../../../src/modules/payments/payment.controller.js';
import { updateModuleBookingStatus } from '../../../../src/modules/staff/module-staff.controller.js';

const VALID_ORDER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const VALID_BOOKING_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

function mockReq(body = {}, params = {}, user: any = { userId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', tenantId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44' }): Request {
  return {
    body,
    params,
    user,
    query: {},
  } as unknown as Request;
}

function mockRes(): Response & { _status: number; _json: any } {
  const res: any = {
    _status: 200,
    _json: null,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: any) {
      res._json = data;
      return res;
    },
  };
  return res;
}

describe('Room Charge Folio Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('postRoomCharge', () => {
    it('should charge a POS order to a checked-in booking folio', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, val: string) => ({
                single: vi.fn().mockResolvedValue(
                  val === VALID_ORDER_ID
                    ? {
                        data: {
                          id: VALID_ORDER_ID,
                          total_amount: '45.00',
                          status: 'pending',
                          tenant_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
                          property_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
                        },
                        error: null,
                      }
                    : {
                        data: {
                          id: VALID_BOOKING_ID,
                          status: 'checked_in',
                          engine_type: 'time_exclusive_reservation',
                          tenant_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
                          property_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
                        },
                        error: null,
                      }
                ),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'payment_ledger') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'ledger-row-1', reference_id: VALID_BOOKING_ID, amount: '45.00', event_type: 'charge' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'payments') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'pay-1' }, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const req = mockReq({ orderId: VALID_ORDER_ID, bookingId: VALID_BOOKING_ID });
      const res = mockRes();

      await (postRoomCharge as any)(req, res, vi.fn());

      expect(res._status).toBe(201);
      expect(res._json.success).toBe(true);
      expect(res._json.data.amount).toBe(45);
    });

    it('should reject charging if booking is not checked_in', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col: string, val: string) => ({
                single: vi.fn().mockResolvedValue(
                  val === VALID_ORDER_ID
                    ? {
                        data: {
                          id: VALID_ORDER_ID,
                          total_amount: '45.00',
                          status: 'pending',
                          tenant_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
                          property_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
                        },
                        error: null,
                      }
                    : {
                        data: {
                          id: VALID_BOOKING_ID,
                          status: 'confirmed',
                          engine_type: 'time_exclusive_reservation',
                          tenant_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
                          property_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
                        },
                        error: null,
                      }
                ),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            }),
          };
        }
        return {};
      });

      const req = mockReq({ orderId: VALID_ORDER_ID, bookingId: VALID_BOOKING_ID });
      const res = mockRes();

      await (postRoomCharge as any)(req, res, vi.fn());

      expect(res._status).toBe(400);
      expect(res._json.error).toContain('active checked-in room');
    });
  });

  describe('getFolioBalance', () => {
    it('should correctly calculate net folio balance', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: VALID_BOOKING_ID, tenant_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'payment_ledger') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({
                      data: [
                        { event_type: 'charge', amount: '50.00' },
                        { event_type: 'charge', amount: '25.00' },
                        { event_type: 'settlement', amount: '30.00' },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const req = mockReq({}, { bookingId: VALID_BOOKING_ID });
      const res = mockRes();

      await (getFolioBalance as any)(req, res, vi.fn());

      expect(res._status).toBe(200);
      expect(res._json.data.totalCharges).toBe(75);
      expect(res._json.data.totalSettlements).toBe(30);
      expect(res._json.data.balance).toBe(45);
    });
  });

  describe('settleFolioBalance', () => {
    it('should record settlement entry and calculate updated remaining balance', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: VALID_BOOKING_ID, tenant_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', property_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'payment_ledger') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'settle-ledger-1', event_type: 'settlement', amount: '45.00' },
                  error: null,
                }),
              }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      { event_type: 'charge', amount: '45.00' },
                      { event_type: 'settlement', amount: '45.00' },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'payments') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'pay-2' }, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const req = mockReq({ bookingId: VALID_BOOKING_ID, amount: 45, method: 'cash' });
      const res = mockRes();

      await (settleFolioBalance as any)(req, res, vi.fn());

      expect(res._status).toBe(201);
      expect(res._json.data.remainingBalance).toBe(0);
    });
  });

  describe('updateModuleBookingStatus (Checkout Guard)', () => {
    it('should return 409 FOLIO_BALANCE_DUE when checkout is attempted with open balance', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'modules') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'mod-1', engine_type: 'time_exclusive_reservation' },
                }),
              }),
            }),
          };
        }
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { status: 'checked_in' },
                }),
              }),
            }),
          };
        }
        if (table === 'payment_ledger') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: [
                      { event_type: 'charge', amount: '120.00' },
                    ],
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const req = mockReq({ status: 'checked_out' }, { slug: 'chalets', bookingId: VALID_BOOKING_ID });
      const res = mockRes();

      await updateModuleBookingStatus(req, res);

      expect(res._status).toBe(409);
      expect(res._json.error).toBe('FOLIO_BALANCE_DUE');
      expect(res._json.balance).toBe(120);
    });
  });
});
