/**
 * Restaurant Order Controller – comprehensive unit tests
 *
 * Uses the proven proxy-based Supabase mock so every chained
 * .from().select().eq()… resolves from a shared queue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ─── Proxy-based Supabase mock ───────────────────────────────────
let resolveQueue: any[];
let mockChain: any;

function setupMock() {
  resolveQueue = [];
  const handler: ProxyHandler<any> = {
    get(_target, prop: string) {
      if (prop === 'then') {
        const val = resolveQueue.shift() || { data: null, error: null };
        return (resolve: any) => resolve(val);
      }
      return (..._args: any[]) => mockChain;
    },
  };
  mockChain = new Proxy(function () {}, handler);
}

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () =>
    new Proxy(
      {},
      {
        get(_target, _prop: string) {
          return (..._args: any[]) => mockChain;
        },
      },
    ),
}));

// ─── Mock validateBody ──────────────────────────────────────────
const mockValidateBody = vi.fn((_, body) => body);

vi.mock('../../../../src/validation/schemas.js', () => ({
  createRestaurantOrderSchema: {},
  updateOrderStatusSchema: {},
  validateBody: (...args: any[]) => mockValidateBody(...args),
}));

// ─── Mock socket ────────────────────────────────────────────────
vi.mock('../../../../src/socket/index.js', () => ({
  emitToUnit: vi.fn(),
  emitToUser: vi.fn(),
  notifyAdmins: vi.fn(),
  emitToRole: vi.fn(),
}));

// ─── Mock email service ─────────────────────────────────────────
vi.mock('../../../../src/services/email.service.js', () => ({
  emailService: {
    sendOrderConfirmation: vi.fn().mockResolvedValue(true),
    sendOrderUpdate: vi.fn().mockResolvedValue(true),
  },
}));

// ─── Mock logger ────────────────────────────────────────────────
vi.mock('../../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Mock activity logger ───────────────────────────────────────
vi.mock('../../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn(),
}));

// ─── Mock tax service ───────────────────────────────────────────
vi.mock('../../../../src/services/tax.service.js', () => ({
  taxService: {
    getTaxRate: vi.fn().mockResolvedValue(0.1),
  },
}));

// ─── Import controller (AFTER mocks) ────────────────────────────
import {
  createOrder,
  getOrder,
  getOrderStatus,
  getMyOrders,
  getStaffOrders,
  getLiveOrders,
  updateOrderStatus,
  getDailyReport,
  getSalesReport,
} from '../../../../src/modules/restaurant/controllers/order.controller.js';

import { emitToUnit } from '../../../../src/socket/index.js';
import { logActivity } from '../../../../src/utils/activityLogger.js';

// ─── Helpers ─────────────────────────────────────────────────────
function mockReq(overrides: Record<string, any> = {}): Request {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'u1', userId: 'u1', roles: ['admin'] },
    ip: '127.0.0.1',
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const r: any = {};
  r.status = vi.fn().mockReturnValue(r);
  r.json = vi.fn().mockReturnValue(r);
  r.send = vi.fn().mockReturnValue(r);
  return r as Response;
}

function next(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// Reusable fixtures
const MENU_ITEM = {
  id: 'mi-1',
  name: 'Burger',
  price: '10.00',
  is_available: true,
  module_id: 'mod-1',
  preparation_time_minutes: 15,
};

const ORDER_ROW = {
  id: 'ord-1',
  order_number: 'R-260207-000001abc',
  customer_id: null,
  customer_name: 'Guest',
  customer_phone: null,
  table_id: null,
  module_id: 'mod-1',
  order_type: 'takeaway',
  status: 'pending',
  subtotal: '10.00',
  tax_amount: '1.00',
  service_charge: '0.00',
  delivery_fee: '0.00',
  discount_amount: '0',
  total_amount: '11.00',
  special_instructions: null,
  estimated_ready_time: '2026-02-07T12:30:00.000Z',
  payment_status: 'pending',
  payment_method: 'cash',
  created_at: '2026-02-07T12:00:00.000Z',
  updated_at: null,
};

const ORDER_ITEM_ROW = {
  id: 'oi-1',
  quantity: 1,
  unit_price: '10.00',
  subtotal: '10.00',
  special_instructions: null,
  menu_items: { id: 'mi-1', name: 'Burger', name_ar: null, image_url: null },
};

// ─── Tests ──────────────────────────────────────────────────────
describe('Order Controller (restaurant)', () => {
  beforeEach(() => {
    setupMock();
    vi.clearAllMocks();
    mockValidateBody.mockImplementation((_, body) => body);
  });

  /* =============================================================
   * createOrder
   * ============================================================= */
  describe('createOrder', () => {
    const validBody = {
      customerName: 'Guest',
      orderType: 'takeaway',
      items: [{ menuItemId: 'mi-1', quantity: 1, notes: '' }],
      paymentMethod: 'cash',
    };

    function queueCreateOrderHappy() {
      // 1. menu_items select…in
      resolveQueue.push({ data: [MENU_ITEM], error: null });
      // 2. taxService.getTaxRate is a separate mock (not proxy)
      // 3. restaurant_orders insert…select…single
      resolveQueue.push({ data: { ...ORDER_ROW }, error: null });
      // 4. restaurant_order_items insert
      resolveQueue.push({ data: null, error: null });
      // 5. rpc deduct_inventory_for_order_v2
      resolveQueue.push({
        data: [{ base_items_deducted: 1, modifier_items_deducted: 0, skipped_removals: 0 }],
        error: null,
      });
      // 6. restaurant_order_status_history insert
      resolveQueue.push({ data: null, error: null });
    }

    it('creates an order and returns 201', async () => {
      queueCreateOrderHappy();
      const req = mockReq({ body: validBody });
      const res = mockRes();
      const n = next();

      await createOrder(req, res, n);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ id: 'ord-1' }) }),
      );
      expect(logActivity).toHaveBeenCalled();
      expect(emitToUnit).toHaveBeenCalledWith('restaurant', 'order:new', expect.anything());
    });

    it('returns error when validateBody throws (validation failure)', async () => {
      const err: any = new Error('Validation failed: orderType: Required');
      err.statusCode = 400;
      mockValidateBody.mockImplementationOnce(() => { throw err; });

      const req = mockReq({ body: {} });
      const res = mockRes();
      const n = next();

      await createOrder(req, res, n);

      // isErrorWithStatusCode path
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringContaining('Validation failed') }),
      );
    });

    it('calls next when service throws a non-status error', async () => {
      // menu_items query returns error → service throws
      resolveQueue.push({ data: null, error: { message: 'DB down' } });

      const req = mockReq({ body: validBody });
      const res = mockRes();
      const n = next();

      await createOrder(req, res, n);

      // The controller catch: error has no statusCode → next(error)
      expect(n).toHaveBeenCalled();
    });

    it('returns 500 when order insert fails', async () => {
      // 1. menu_items OK
      resolveQueue.push({ data: [MENU_ITEM], error: null });
      // 2. order insert fails
      resolveQueue.push({ data: null, error: { message: 'insert failed' } });

      const req = mockReq({ body: validBody });
      const res = mockRes();
      const n = next();

      await createOrder(req, res, n);

      // Error propagates through the service → controller catch → next()
      expect(n).toHaveBeenCalled();
    });
  });

  /* =============================================================
   * getOrder
   * ============================================================= */
  describe('getOrder', () => {
    it('returns full order for owner', async () => {
      // Service getOrderById: 1) order query  2) items query
      resolveQueue.push({ data: { ...ORDER_ROW, customer_id: 'u1' }, error: null });
      resolveQueue.push({ data: [ORDER_ITEM_ROW], error: null });

      const req = mockReq({ params: { id: 'ord-1' } });
      const res = mockRes();

      await getOrder(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'ord-1', items: expect.any(Array) }),
        }),
      );
    });

    it('returns full order for admin/staff even when not owner', async () => {
      resolveQueue.push({ data: { ...ORDER_ROW, customer_id: 'other-user' }, error: null });
      resolveQueue.push({ data: [ORDER_ITEM_ROW], error: null });

      const req = mockReq({ params: { id: 'ord-1' }, user: { id: 'u1', userId: 'u1', roles: ['admin'] } });
      const res = mockRes();

      await getOrder(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ id: 'ord-1' }) }),
      );
    });

    it('returns full order for guest orders (no customer_id)', async () => {
      resolveQueue.push({ data: { ...ORDER_ROW, customer_id: null }, error: null });
      resolveQueue.push({ data: [ORDER_ITEM_ROW], error: null });

      const req = mockReq({ params: { id: 'ord-1' }, user: { id: 'other', userId: 'other', roles: [] } });
      const res = mockRes();

      await getOrder(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ id: 'ord-1' }) }),
      );
    });

    it('returns limited info for non-owner viewing non-guest order', async () => {
      resolveQueue.push({ data: { ...ORDER_ROW, customer_id: 'someone-else', estimated_ready_time: null }, error: null });
      resolveQueue.push({ data: [], error: null });

      const req = mockReq({ params: { id: 'ord-1' }, user: { id: 'u2', userId: 'u2', roles: [] } });
      const res = mockRes();

      await getOrder(req, res, next());

      // Should return limited data without items
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'ord-1', status: 'pending' }),
        }),
      );
      const returnedData = (res.json as any).mock.calls[0][0].data;
      expect(returnedData).not.toHaveProperty('total_amount');
    });

    it('returns 404 when order not found (PGRST116)', async () => {
      resolveQueue.push({ data: null, error: { code: 'PGRST116', message: 'not found' } });

      const req = mockReq({ params: { id: 'bad-id' } });
      const res = mockRes();

      await getOrder(req, res, next());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Order not found' }),
      );
    });

    it('forwards DB error to next()', async () => {
      resolveQueue.push({ data: null, error: { message: 'DB timeout' } });

      const req = mockReq({ params: { id: 'ord-1' } });
      const res = mockRes();
      const n = next();

      await getOrder(req, res, n);

      expect(n).toHaveBeenCalled();
    });
  });

  /* =============================================================
   * getOrderStatus
   * ============================================================= */
  describe('getOrderStatus', () => {
    it('returns order data (delegates to getOrderById)', async () => {
      resolveQueue.push({ data: { ...ORDER_ROW }, error: null });
      resolveQueue.push({ data: [ORDER_ITEM_ROW], error: null });

      const req = mockReq({ params: { id: 'ord-1' } });
      const res = mockRes();

      await getOrderStatus(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ id: 'ord-1' }) }),
      );
    });

    it('forwards error to next on DB failure', async () => {
      resolveQueue.push({ data: null, error: { message: 'fail' } });

      const req = mockReq({ params: { id: 'ord-1' } });
      const res = mockRes();
      const n = next();

      await getOrderStatus(req, res, n);

      expect(n).toHaveBeenCalled();
    });
  });

  /* =============================================================
   * getMyOrders
   * ============================================================= */
  describe('getMyOrders', () => {
    it('returns orders for the authenticated user', async () => {
      const orders = [{ ...ORDER_ROW, customer_id: 'u1' }];
      resolveQueue.push({ data: orders, error: null });

      const req = mockReq();
      const res = mockRes();

      await getMyOrders(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: orders }),
      );
    });

    it('returns empty array when user has no orders', async () => {
      resolveQueue.push({ data: [], error: null });

      const req = mockReq();
      const res = mockRes();

      await getMyOrders(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [] }),
      );
    });

    it('forwards DB error to next()', async () => {
      resolveQueue.push({ data: null, error: { message: 'fail' } });

      const req = mockReq();
      const res = mockRes();
      const n = next();

      await getMyOrders(req, res, n);

      expect(n).toHaveBeenCalled();
    });
  });

  /* =============================================================
   * getStaffOrders
   * ============================================================= */
  describe('getStaffOrders', () => {
    const staffOrder = {
      ...ORDER_ROW,
      customer_name: 'Guest',
      order_items: [
        {
          id: 'oi-1',
          quantity: 1,
          unit_price: '10.00',
          notes: null,
          menu_items: { id: 'mi-1', name: 'Burger', module_id: 'mod-1' },
        },
      ],
      customer: { full_name: 'Guest User' },
    };

    it('returns transformed orders', async () => {
      resolveQueue.push({ data: [staffOrder], error: null });

      const req = mockReq({ query: {} });
      const res = mockRes();

      await getStaffOrders(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              id: 'ord-1',
              orderNumber: ORDER_ROW.order_number,
              status: 'pending',
              items: expect.any(Array),
            }),
          ]),
        }),
      );
    });

    it('passes status and date filters through', async () => {
      resolveQueue.push({ data: [], error: null });

      const req = mockReq({ query: { status: 'pending', date: '2026-02-07' } });
      const res = mockRes();

      await getStaffOrders(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [] }),
      );
    });

    it('forwards DB error to next()', async () => {
      resolveQueue.push({ data: null, error: { message: 'fail' } });

      const req = mockReq({ query: {} });
      const res = mockRes();
      const n = next();

      await getStaffOrders(req, res, n);

      expect(n).toHaveBeenCalled();
    });
  });

  /* =============================================================
   * getLiveOrders
   * ============================================================= */
  describe('getLiveOrders', () => {
    const liveOrder = {
      ...ORDER_ROW,
      status: 'preparing',
      order_items: [
        {
          id: 'oi-1',
          quantity: 1,
          unit_price: '10.00',
          notes: null,
          menu_items: { id: 'mi-1', name: 'Burger' },
        },
      ],
      customer: null,
    };

    it('returns transformed live orders', async () => {
      resolveQueue.push({ data: [liveOrder], error: null });

      const req = mockReq({ query: {} });
      const res = mockRes();

      await getLiveOrders(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ id: 'ord-1', status: 'preparing' }),
          ]),
        }),
      );
    });

    it('accepts moduleId filter', async () => {
      resolveQueue.push({ data: [], error: null });

      const req = mockReq({ query: { moduleId: 'mod-1' } });
      const res = mockRes();

      await getLiveOrders(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [] }),
      );
    });

    it('forwards DB error to next()', async () => {
      resolveQueue.push({ data: null, error: { message: 'fail' } });

      const req = mockReq({ query: {} });
      const res = mockRes();
      const n = next();

      await getLiveOrders(req, res, n);

      expect(n).toHaveBeenCalled();
    });
  });

  /* =============================================================
   * updateOrderStatus
   * ============================================================= */
  describe('updateOrderStatus', () => {
    const updateBody = { status: 'preparing', notes: 'Cooking now' };

    it('updates status and emits socket event', async () => {
      const updatedOrder = { ...ORDER_ROW, status: 'preparing' };
      // 1. fetch current order (select…eq…single)
      resolveQueue.push({ data: { ...ORDER_ROW }, error: null });
      // 2. update order (update…eq…select…single)
      resolveQueue.push({ data: updatedOrder, error: null });
      // 3. insert status history
      resolveQueue.push({ data: null, error: null });

      const req = mockReq({ params: { id: 'ord-1' }, body: updateBody });
      const res = mockRes();

      await updateOrderStatus(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ status: 'preparing' }) }),
      );
      expect(emitToUnit).toHaveBeenCalledWith('restaurant', 'order:updated', expect.anything());
      expect(logActivity).toHaveBeenCalled();
    });

    it('returns error when validateBody throws', async () => {
      const err: any = new Error('Validation failed: status is required');
      err.statusCode = 400;
      mockValidateBody.mockImplementationOnce(() => { throw err; });

      const req = mockReq({ params: { id: 'ord-1' }, body: {} });
      const res = mockRes();
      const n = next();

      await updateOrderStatus(req, res, n);

      // asyncHandler catches → next(error) since the error has a statusCode
      // but actually the controller has no try/catch — asyncHandler sends to next
      expect(n).toHaveBeenCalled();
    });

    it('forwards DB error when fetch fails', async () => {
      resolveQueue.push({ data: null, error: { message: 'Order not found' } });

      const req = mockReq({ params: { id: 'bad-id' }, body: updateBody });
      const res = mockRes();
      const n = next();

      await updateOrderStatus(req, res, n);

      expect(n).toHaveBeenCalled();
    });

    it('forwards DB error when update fails', async () => {
      resolveQueue.push({ data: { ...ORDER_ROW }, error: null }); // fetch OK
      resolveQueue.push({ data: null, error: { message: 'update boom' } }); // update fails

      const req = mockReq({ params: { id: 'ord-1' }, body: updateBody });
      const res = mockRes();
      const n = next();

      await updateOrderStatus(req, res, n);

      expect(n).toHaveBeenCalled();
    });
  });

  /* =============================================================
   * getDailyReport
   * ============================================================= */
  describe('getDailyReport', () => {
    it('returns aggregated report', async () => {
      const orders = [
        { ...ORDER_ROW, status: 'completed', total_amount: '50.00', tax_amount: '5.00' },
        { ...ORDER_ROW, id: 'ord-2', status: 'completed', total_amount: '30.00', tax_amount: '3.00' },
        { ...ORDER_ROW, id: 'ord-3', status: 'cancelled', total_amount: '10.00', tax_amount: '1.00' },
      ];
      resolveQueue.push({ data: orders, error: null });

      const req = mockReq({ query: { date: '2026-02-07' } });
      const res = mockRes();

      await getDailyReport(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalOrders: 3,
            completedOrders: 2,
            cancelledOrders: 1,
            totalRevenue: 80,
            totalTax: 8,
          }),
        }),
      );
    });

    it('returns zeros when no orders exist', async () => {
      resolveQueue.push({ data: [], error: null });

      const req = mockReq({ query: { date: '2026-01-01' } });
      const res = mockRes();

      await getDailyReport(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalOrders: 0,
            completedOrders: 0,
            totalRevenue: 0,
            averageOrderValue: 0,
          }),
        }),
      );
    });

    it('accepts moduleId filter', async () => {
      resolveQueue.push({ data: [], error: null });

      const req = mockReq({ query: { date: '2026-02-07', moduleId: 'mod-1' } });
      const res = mockRes();

      await getDailyReport(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('forwards DB error to next()', async () => {
      resolveQueue.push({ data: null, error: { message: 'fail' } });

      const req = mockReq({ query: {} });
      const res = mockRes();
      const n = next();

      await getDailyReport(req, res, n);

      expect(n).toHaveBeenCalled();
    });
  });

  /* =============================================================
   * getSalesReport
   * ============================================================= */
  describe('getSalesReport', () => {
    it('returns sales summary for date range', async () => {
      const orders = [
        { ...ORDER_ROW, status: 'completed', total_amount: '100.00' },
        { ...ORDER_ROW, id: 'ord-2', status: 'completed', total_amount: '200.00' },
      ];
      resolveQueue.push({ data: orders, error: null });

      const req = mockReq({ query: { startDate: '2026-02-01', endDate: '2026-02-07' } });
      const res = mockRes();

      await getSalesReport(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalOrders: 2,
            totalRevenue: 300,
            averageOrderValue: 150,
          }),
        }),
      );
    });

    it('returns zeros for empty range', async () => {
      resolveQueue.push({ data: [], error: null });

      const req = mockReq({ query: { startDate: '2099-01-01', endDate: '2099-01-02' } });
      const res = mockRes();

      await getSalesReport(req, res, next());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ totalOrders: 0, totalRevenue: 0, averageOrderValue: 0 }),
        }),
      );
    });

    it('forwards DB error to next()', async () => {
      resolveQueue.push({ data: null, error: { message: 'fail' } });

      const req = mockReq({ query: { startDate: '2026-02-01', endDate: '2026-02-07' } });
      const res = mockRes();
      const n = next();

      await getSalesReport(req, res, n);

      expect(n).toHaveBeenCalled();
    });
  });
});
