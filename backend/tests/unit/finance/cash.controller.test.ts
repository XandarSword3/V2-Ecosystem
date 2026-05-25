import { createMockReqRes, createChainableMock } from '../utils';

// Mock dependencies
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn()
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn()
}));

import { cashController } from '../../../src/modules/finance/cash.controller';
import { getSupabase } from '../../../src/database/connection.js';
import { logActivity } from '../../../src/utils/activityLogger.js';

describe('Cash Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('openDrawer', () => {
    it('should open a new cash drawer', async () => {
      const mockDrawer = {
        id: 'drawer-1',
        device_id: 'pos-1',
        opened_by_user_id: 'user-1',
        starting_balance: 200,
        current_balance: 200,
        status: 'open'
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockDrawer, error: null })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);
      vi.mocked(logActivity).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        body: { amount: 200, notes: 'Opening shift' },
        user: { id: 'user-1', role: 'cashier', userId: 'user-1' }
      });
      req.headers['x-device-id'] = 'pos-1';

      await cashController.openDrawer(req, res, next);

      expect(mockSupabase.from).toHaveBeenCalledWith('cash_drawers');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockDrawer });
      expect(logActivity).toHaveBeenCalledWith({
        user_id: 'user-1',
        action: 'OPEN_DRAWER',
        resource: 'finance',
        details: { drawer_id: 'drawer-1', amount: 200 }
      });
    });

    it('should call next on database error', async () => {
      const error = { message: 'DB error', code: '500' };
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { amount: 200 },
        user: { id: 'user-1', role: 'cashier', userId: 'user-1' }
      });

      await cashController.openDrawer(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('closeDrawer', () => {
    it('should close a cash drawer with discrepancy calculation', async () => {
      const existingDrawer = {
        id: 'drawer-1',
        current_balance: 500,
        notes: 'Morning shift'
      };

      const closedDrawer = {
        ...existingDrawer,
        status: 'closed',
        ending_balance: 495,
        discrepancy: -5
      };

      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (table === 'cash_drawers') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: existingDrawer, error: null })
                })
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: closedDrawer, error: null })
                  })
                })
              })
            };
          }
          return createChainableMock();
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);
      vi.mocked(logActivity).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        body: { drawerId: 'drawer-1', actualBalance: 495, notes: 'Short $5' },
        user: { id: 'user-1', role: 'cashier', userId: 'user-1' }
      });

      await cashController.closeDrawer(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: closedDrawer });
      expect(logActivity).toHaveBeenCalledWith({
        user_id: 'user-1',
        action: 'CLOSE_DRAWER',
        resource: 'finance',
        details: { drawer_id: 'drawer-1', discrepancy: -5 }
      });
    });

    it('should throw error for non-existent drawer', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
            })
          })
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { drawerId: 'invalid', actualBalance: 100 },
        user: { id: 'user-1', role: 'cashier', userId: 'user-1' }
      });

      await cashController.closeDrawer(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('recordTransaction', () => {
    it('should record a pay_in transaction and update balance', async () => {
      const drawerData = { current_balance: 100 };
      const tableMocks: Record<string, any> = {};
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (!tableMocks[table]) {
            tableMocks[table] = createChainableMock();
            if (table === 'cash_drawers') {
              tableMocks[table].single = vi.fn().mockResolvedValue({ data: drawerData, error: null });
            }
          }
          return tableMocks[table];
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { drawerId: 'drawer-1', type: 'pay_in', amount: 50, reason: 'Add float' },
        user: { id: 'user-1', role: 'manager', userId: 'user-1' }
      });

      await cashController.recordTransaction(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      // Verify balance update was called with 150 (100 + 50)
      const drawersMock = tableMocks['cash_drawers'];
      expect(drawersMock.update).toHaveBeenCalledWith(expect.objectContaining({
        current_balance: 150
      }));
    });

    it('should record a pay_out transaction and update balance correctly', async () => {
      const drawerData = { current_balance: 100 };
      const tableMocks: Record<string, any> = {};
      const mockSupabase = {
        from: vi.fn().mockImplementation((table) => {
          if (!tableMocks[table]) {
            tableMocks[table] = createChainableMock();
            if (table === 'cash_drawers') {
              tableMocks[table].single = vi.fn().mockResolvedValue({ data: drawerData, error: null });
            }
          }
          return tableMocks[table];
        })
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        body: { drawerId: 'drawer-1', type: 'pay_out', amount: 30, reason: 'Buy supplies' },
        user: { id: 'user-1', role: 'manager', userId: 'user-1' }
      });

      await cashController.recordTransaction(req, res, next);

      // Verify balance update was called with 70 (100 - 30)
      const drawersMock = tableMocks['cash_drawers'];
      expect(drawersMock.update).toHaveBeenCalledWith(expect.objectContaining({
        current_balance: 70
      }));
    });
  });

  describe('getDrawers', () => {
    it('should fetch all cash drawers', async () => {
      const mockDrawers = [{ id: 'drawer-1' }, { id: 'drawer-2' }];
      const mockSupabase = {
        from: vi.fn().mockReturnValue(createChainableMock(mockDrawers))
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await cashController.getDrawers(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockDrawers });
    });

    it('should filter drawers by status', async () => {
      const mockDrawers = [{ id: 'drawer-1', status: 'open' }];
      const queryMock = createChainableMock(mockDrawers);
      const mockSupabase = {
        from: vi.fn().mockReturnValue(queryMock)
      };
      vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);

      const { req, res, next } = createMockReqRes({
        query: { status: 'open' }
      });

      await cashController.getDrawers(req, res, next);

      expect(queryMock.eq).toHaveBeenCalledWith('status', 'open');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockDrawers });
    });
  });
});
