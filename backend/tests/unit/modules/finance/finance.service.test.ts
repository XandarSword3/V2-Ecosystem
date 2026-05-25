
// Mock connection module before importing service
vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn()
}));

import { getSupabase } from '../../../../src/database/connection.js';
import * as financeService from '../../../../src/modules/finance/finance.service.js';

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', ...insertData }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

describe('Finance Service', () => {
  const mockDrawerId = 'drawer-123';
  const mockDeviceId = 'pos-terminal-1';
  const mockUserId = 'user-456';
  const mockTransactionId = 'tx-789';

  const mockDrawer: financeService.CashDrawer = {
    id: mockDrawerId,
    device_id: mockDeviceId,
    opened_by_user_id: mockUserId,
    opened_at: '2026-02-07T08:00:00Z',
    starting_balance: 100,
    current_balance: 250,
    status: 'open',
    notes: 'Morning shift',
    created_at: '2026-02-07T08:00:00Z'
  };

  const mockClosedDrawer: financeService.CashDrawer = {
    ...mockDrawer,
    id: 'drawer-closed',
    status: 'closed',
    closed_at: '2026-02-07T18:00:00Z',
    ending_balance: 275,
    discrepancy: 5
  };

  const mockTransaction: financeService.CashTransaction = {
    id: mockTransactionId,
    drawer_id: mockDrawerId,
    user_id: mockUserId,
    type: 'sale',
    amount: 50,
    reason_code: 'POS_SALE',
    order_id: 'order-123',
    created_at: '2026-02-07T10:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== DRAWER MANAGEMENT TESTS ====================

  describe('openDrawer', () => {
    it('should open a new cash drawer successfully', async () => {
      // First call checks for existing open drawer (returns null)
      // Second call inserts new drawer
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            const checkMock = createQueryMock(() => []);
            checkMock.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
            return checkMock;
          }
          return createQueryMock(() => [mockDrawer]);
        })
      } as any);

      const result = await financeService.openDrawer({
        deviceId: mockDeviceId,
        userId: mockUserId,
        amount: 100,
        notes: 'Morning shift'
      });

      expect(result).toBeDefined();
      expect(getSupabase().from).toHaveBeenCalledWith('cash_drawers');
    });

    it('should throw error if drawer already open for device', async () => {
      const mockQuery = createQueryMock(() => [mockDrawer]);
      mockQuery.maybeSingle = vi.fn().mockResolvedValue({ data: mockDrawer, error: null });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await expect(financeService.openDrawer({
        deviceId: mockDeviceId,
        userId: mockUserId,
        amount: 100
      })).rejects.toThrow('An open drawer already exists for this device');
    });

    it('should open drawer without notes', async () => {
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            const checkMock = createQueryMock(() => []);
            checkMock.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
            return checkMock;
          }
          const insertMock = createQueryMock(() => [{ ...mockDrawer, notes: undefined }]);
          return insertMock;
        })
      } as any);

      const result = await financeService.openDrawer({
        deviceId: mockDeviceId,
        userId: mockUserId,
        amount: 100
      });

      expect(result).toBeDefined();
    });

    it('should handle insert error', async () => {
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            const checkMock = createQueryMock(() => []);
            checkMock.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
            return checkMock;
          }
          const insertMock = createQueryMock(() => []);
          insertMock.insert = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
            })
          });
          return insertMock;
        })
      } as any);

      await expect(financeService.openDrawer({
        deviceId: mockDeviceId,
        userId: mockUserId,
        amount: 100
      })).rejects.toEqual({ message: 'Insert failed' });
    });
  });

  describe('closeDrawer', () => {
    it('should close an open drawer successfully', async () => {
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Fetch drawer
            return createQueryMock(() => [mockDrawer]);
          }
          // Update drawer
          return createQueryMock(() => [mockClosedDrawer]);
        })
      } as any);

      const result = await financeService.closeDrawer({
        drawerId: mockDrawerId,
        actualBalance: 275,
        notes: 'End of shift'
      });

      expect(result).toBeDefined();
      expect(getSupabase().from).toHaveBeenCalledWith('cash_drawers');
    });

    it('should calculate discrepancy correctly', async () => {
      const drawerWithBalance = { ...mockDrawer, current_balance: 250 };
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return createQueryMock(() => [drawerWithBalance]);
          }
          const updateMock = createQueryMock(() => []);
          updateMock.update = vi.fn().mockImplementation((updateData) => {
            expect(updateData.discrepancy).toBe(25); // 275 - 250 = 25
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { ...drawerWithBalance, ...updateData }, error: null })
                })
              })
            };
          });
          return updateMock;
        })
      } as any);

      await financeService.closeDrawer({
        drawerId: mockDrawerId,
        actualBalance: 275
      });
    });

    it('should throw error when drawer not found', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await expect(financeService.closeDrawer({
        drawerId: 'non-existent',
        actualBalance: 100
      })).rejects.toThrow('Drawer not found');
    });

    it('should throw error when drawer already closed', async () => {
      const mockQuery = createQueryMock(() => [mockClosedDrawer]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await expect(financeService.closeDrawer({
        drawerId: mockClosedDrawer.id,
        actualBalance: 100
      })).rejects.toThrow('Drawer is already closed');
    });

    it('should append closing notes to existing notes', async () => {
      const drawerWithNotes = { ...mockDrawer, notes: 'Opening notes' };
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return createQueryMock(() => [drawerWithNotes]);
          }
          const updateMock = createQueryMock(() => []);
          updateMock.update = vi.fn().mockImplementation((updateData) => {
            expect(updateData.notes).toContain('Opening notes');
            expect(updateData.notes).toContain('Closing Note:');
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updateData, error: null })
                })
              })
            };
          });
          return updateMock;
        })
      } as any);

      await financeService.closeDrawer({
        drawerId: mockDrawerId,
        actualBalance: 275,
        notes: 'Closing notes'
      });
    });
  });

  describe('getDrawer', () => {
    it('should return drawer by ID', async () => {
      const mockQuery = createQueryMock(() => [mockDrawer]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getDrawer(mockDrawerId);

      expect(result).toEqual(mockDrawer);
      expect(getSupabase().from).toHaveBeenCalledWith('cash_drawers');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', mockDrawerId);
    });

    it('should return null when drawer not found', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getDrawer('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getDrawers', () => {
    it('should return all drawers', async () => {
      const mockDrawers = [mockDrawer, mockClosedDrawer];
      const mockQuery = createQueryMock(() => mockDrawers);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getDrawers();

      expect(result).toEqual(mockDrawers);
      expect(getSupabase().from).toHaveBeenCalledWith('cash_drawers');
      expect(mockQuery.order).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      const mockQuery = createQueryMock(() => [mockDrawer]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await financeService.getDrawers({ status: 'open' });

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'open');
    });

    it('should filter by deviceId', async () => {
      const mockQuery = createQueryMock(() => [mockDrawer]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await financeService.getDrawers({ deviceId: mockDeviceId });

      expect(mockQuery.eq).toHaveBeenCalledWith('device_id', mockDeviceId);
    });

    it('should filter by userId', async () => {
      const mockQuery = createQueryMock(() => [mockDrawer]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await financeService.getDrawers({ userId: mockUserId });

      expect(mockQuery.eq).toHaveBeenCalledWith('opened_by_user_id', mockUserId);
    });

    it('should limit results', async () => {
      const mockQuery = createQueryMock(() => [mockDrawer]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await financeService.getDrawers({ limit: 10 });

      expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should return empty array when no drawers found', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getDrawers();

      expect(result).toEqual([]);
    });

    it('should apply multiple filters', async () => {
      const mockQuery = createQueryMock(() => [mockDrawer]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await financeService.getDrawers({ 
        status: 'open', 
        deviceId: mockDeviceId, 
        limit: 5 
      });

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'open');
      expect(mockQuery.eq).toHaveBeenCalledWith('device_id', mockDeviceId);
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });
  });

  describe('getOpenDrawerForDevice', () => {
    it('should return open drawer for device', async () => {
      const mockQuery = createQueryMock(() => [mockDrawer]);
      mockQuery.maybeSingle = vi.fn().mockResolvedValue({ data: mockDrawer, error: null });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getOpenDrawerForDevice(mockDeviceId);

      expect(result).toEqual(mockDrawer);
      expect(mockQuery.eq).toHaveBeenCalledWith('device_id', mockDeviceId);
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'open');
    });

    it('should return null when no open drawer for device', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getOpenDrawerForDevice(mockDeviceId);

      expect(result).toBeNull();
    });
  });

  // ==================== TRANSACTION MANAGEMENT TESTS ====================

  describe('recordTransaction', () => {
    it('should record a sale transaction', async () => {
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'cash_drawers' && callCount <= 2) {
            // getDrawer call
            return createQueryMock(() => [mockDrawer]);
          }
          if (table === 'cash_transactions') {
            return createQueryMock(() => [mockTransaction]);
          }
          // Update drawer balance
          return createQueryMock(() => []);
        })
      } as any);

      const result = await financeService.recordTransaction({
        drawerId: mockDrawerId,
        userId: mockUserId,
        type: 'sale',
        amount: 50,
        reason: 'POS_SALE',
        orderId: 'order-123'
      });

      expect(result).toBeDefined();
      expect(getSupabase().from).toHaveBeenCalledWith('cash_transactions');
    });

    it('should record a refund transaction and subtract from balance', async () => {
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'cash_drawers' && callCount <= 2) {
            return createQueryMock(() => [mockDrawer]);
          }
          if (table === 'cash_transactions') {
            return createQueryMock(() => [{ ...mockTransaction, type: 'refund' }]);
          }
          const updateMock = createQueryMock(() => []);
          updateMock.update = vi.fn().mockImplementation((updateData) => {
            // Refund should subtract from balance
            expect(updateData.current_balance).toBeLessThan(mockDrawer.current_balance);
            return {
              eq: vi.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data: null, error: null })
              })
            };
          });
          return updateMock;
        })
      } as any);

      await financeService.recordTransaction({
        drawerId: mockDrawerId,
        userId: mockUserId,
        type: 'refund',
        amount: 25
      });
    });

    it('should record a pay_in transaction and add to balance', async () => {
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'cash_drawers' && callCount <= 2) {
            return createQueryMock(() => [mockDrawer]);
          }
          if (table === 'cash_transactions') {
            return createQueryMock(() => [{ ...mockTransaction, type: 'pay_in' }]);
          }
          const updateMock = createQueryMock(() => []);
          updateMock.update = vi.fn().mockImplementation((updateData) => {
            // Pay in should add to balance
            expect(updateData.current_balance).toBeGreaterThan(mockDrawer.current_balance);
            return {
              eq: vi.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data: null, error: null })
              })
            };
          });
          return updateMock;
        })
      } as any);

      await financeService.recordTransaction({
        drawerId: mockDrawerId,
        userId: mockUserId,
        type: 'pay_in',
        amount: 100
      });
    });

    it('should record a pay_out transaction and subtract from balance', async () => {
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'cash_drawers' && callCount <= 2) {
            return createQueryMock(() => [mockDrawer]);
          }
          if (table === 'cash_transactions') {
            return createQueryMock(() => [{ ...mockTransaction, type: 'pay_out' }]);
          }
          const updateMock = createQueryMock(() => []);
          updateMock.update = vi.fn().mockImplementation((updateData) => {
            // Pay out should subtract from balance
            expect(updateData.current_balance).toBeLessThan(mockDrawer.current_balance);
            return {
              eq: vi.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data: null, error: null })
              })
            };
          });
          return updateMock;
        })
      } as any);

      await financeService.recordTransaction({
        drawerId: mockDrawerId,
        userId: mockUserId,
        type: 'pay_out',
        amount: 50
      });
    });

    it('should throw error when drawer not found', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await expect(financeService.recordTransaction({
        drawerId: 'non-existent',
        userId: mockUserId,
        type: 'sale',
        amount: 50
      })).rejects.toThrow('Drawer not found');
    });

    it('should throw error when drawer is closed', async () => {
      const mockQuery = createQueryMock(() => [mockClosedDrawer]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await expect(financeService.recordTransaction({
        drawerId: mockClosedDrawer.id,
        userId: mockUserId,
        type: 'sale',
        amount: 50
      })).rejects.toThrow('Drawer is not open');
    });
  });

  describe('getTransactions', () => {
    it('should return transactions for a drawer', async () => {
      const mockTransactions = [
        mockTransaction,
        { ...mockTransaction, id: 'tx-2', type: 'refund', amount: 25 }
      ];
      const mockQuery = createQueryMock(() => mockTransactions);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getTransactions(mockDrawerId);

      expect(result).toEqual(mockTransactions);
      expect(getSupabase().from).toHaveBeenCalledWith('cash_transactions');
      expect(mockQuery.eq).toHaveBeenCalledWith('drawer_id', mockDrawerId);
    });

    it('should filter by transaction type', async () => {
      const mockQuery = createQueryMock(() => [mockTransaction]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await financeService.getTransactions(mockDrawerId, { type: 'sale' });

      expect(mockQuery.eq).toHaveBeenCalledWith('type', 'sale');
    });

    it('should limit results', async () => {
      const mockQuery = createQueryMock(() => [mockTransaction]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await financeService.getTransactions(mockDrawerId, { limit: 5 });

      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('should return empty array when no transactions', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getTransactions(mockDrawerId);

      expect(result).toEqual([]);
    });
  });

  describe('getTransaction', () => {
    it('should return transaction by ID', async () => {
      const mockQuery = createQueryMock(() => [mockTransaction]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getTransaction(mockTransactionId);

      expect(result).toEqual(mockTransaction);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', mockTransactionId);
    });

    it('should return null when transaction not found', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getTransaction('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== REPORTING TESTS ====================

  describe('getDrawerSummary', () => {
    it('should return drawer summary with transaction totals', async () => {
      const mockTransactions = [
        { ...mockTransaction, type: 'sale', amount: 100 },
        { ...mockTransaction, id: 'tx-2', type: 'sale', amount: 50 },
        { ...mockTransaction, id: 'tx-3', type: 'refund', amount: 25 },
        { ...mockTransaction, id: 'tx-4', type: 'pay_in', amount: 200 },
        { ...mockTransaction, id: 'tx-5', type: 'pay_out', amount: 75 }
      ];

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'cash_drawers') {
            return createQueryMock(() => [mockDrawer]);
          }
          return createQueryMock(() => mockTransactions);
        })
      } as any);

      const result = await financeService.getDrawerSummary(mockDrawerId);

      expect(result).not.toBeNull();
      expect(result!.drawer).toEqual(mockDrawer);
      expect(result!.transactions).toEqual(mockTransactions);
      expect(result!.summary.totalSales).toBe(150);
      expect(result!.summary.totalRefunds).toBe(25);
      expect(result!.summary.totalPayIns).toBe(200);
      expect(result!.summary.totalPayOuts).toBe(75);
      expect(result!.summary.netCashFlow).toBe(250); // 150 + 200 - 25 - 75
      expect(result!.summary.transactionCount).toBe(5);
    });

    it('should return null when drawer not found', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getDrawerSummary('non-existent');

      expect(result).toBeNull();
    });

    it('should return empty summary when no transactions', async () => {
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'cash_drawers') {
            return createQueryMock(() => [mockDrawer]);
          }
          return createQueryMock(() => []);
        })
      } as any);

      const result = await financeService.getDrawerSummary(mockDrawerId);

      expect(result!.summary.totalSales).toBe(0);
      expect(result!.summary.totalRefunds).toBe(0);
      expect(result!.summary.totalPayIns).toBe(0);
      expect(result!.summary.totalPayOuts).toBe(0);
      expect(result!.summary.netCashFlow).toBe(0);
      expect(result!.summary.transactionCount).toBe(0);
    });
  });

  describe('getDailyReport', () => {
    it('should return daily report with drawer totals', async () => {
      const drawer1 = { ...mockDrawer, starting_balance: 100, ending_balance: 250, discrepancy: 5 };
      const drawer2 = { ...mockDrawer, id: 'drawer-2', starting_balance: 150, ending_balance: 300, discrepancy: -10 };
      const mockDrawers = [drawer1, drawer2];

      const mockQuery = createQueryMock(() => mockDrawers);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getDailyReport('2026-02-07');

      expect(result.date).toBe('2026-02-07');
      expect(result.drawers).toEqual(mockDrawers);
      expect(result.totalStartingBalance).toBe(250); // 100 + 150
      expect(result.totalEndingBalance).toBe(550); // 250 + 300
      expect(result.totalDiscrepancy).toBe(-5); // 5 + (-10)
      expect(result.drawerCount).toBe(2);
    });

    it('should filter drawers by date range', async () => {
      const mockQuery = createQueryMock(() => [mockDrawer]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await financeService.getDailyReport('2026-02-07');

      expect(mockQuery.gte).toHaveBeenCalledWith('opened_at', '2026-02-07T00:00:00.000Z');
      expect(mockQuery.lte).toHaveBeenCalledWith('opened_at', '2026-02-07T23:59:59.999Z');
    });

    it('should return empty report when no drawers for date', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getDailyReport('2026-02-07');

      expect(result.drawers).toEqual([]);
      expect(result.drawerCount).toBe(0);
      expect(result.totalStartingBalance).toBe(0);
      expect(result.totalEndingBalance).toBe(0);
      expect(result.totalDiscrepancy).toBe(0);
    });

    it('should use current_balance when ending_balance is not set', async () => {
      const openDrawer = { ...mockDrawer, starting_balance: 100, current_balance: 200 };
      const mockQuery = createQueryMock(() => [openDrawer]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.getDailyReport('2026-02-07');

      expect(result.totalEndingBalance).toBe(200); // Uses current_balance
    });
  });

  describe('voidTransaction', () => {
    it('should void a sale transaction and reverse balance', async () => {
      const saleTransaction = { ...mockTransaction, type: 'sale' as const, amount: 50 };
      
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'cash_transactions' && callCount === 1) {
            return createQueryMock(() => [saleTransaction]);
          }
          if (table === 'cash_drawers' && callCount <= 3) {
            return createQueryMock(() => [mockDrawer]);
          }
          if (table === 'cash_transactions') {
            const deleteMock = createQueryMock(() => []);
            return deleteMock;
          }
          const updateMock = createQueryMock(() => []);
          updateMock.update = vi.fn().mockImplementation((updateData) => {
            // Voiding a sale should subtract from balance
            expect(updateData.current_balance).toBe(mockDrawer.current_balance - 50);
            return {
              eq: vi.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data: null, error: null })
              })
            };
          });
          return updateMock;
        })
      } as any);

      const result = await financeService.voidTransaction(mockTransactionId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Transaction voided successfully');
    });

    it('should void a refund transaction and restore balance', async () => {
      const refundTransaction = { ...mockTransaction, type: 'refund' as const, amount: 25 };
      
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'cash_transactions' && callCount === 1) {
            return createQueryMock(() => [refundTransaction]);
          }
          if (table === 'cash_drawers' && callCount <= 3) {
            return createQueryMock(() => [mockDrawer]);
          }
          if (table === 'cash_transactions') {
            return createQueryMock(() => []);
          }
          const updateMock = createQueryMock(() => []);
          updateMock.update = vi.fn().mockImplementation((updateData) => {
            // Voiding a refund should add back to balance
            expect(updateData.current_balance).toBe(mockDrawer.current_balance + 25);
            return {
              eq: vi.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data: null, error: null })
              })
            };
          });
          return updateMock;
        })
      } as any);

      const result = await financeService.voidTransaction(mockTransactionId);

      expect(result.success).toBe(true);
    });

    it('should return failure when transaction not found', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await financeService.voidTransaction('non-existent');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Transaction not found');
    });

    it('should return failure when drawer is closed', async () => {
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'cash_transactions') {
            return createQueryMock(() => [mockTransaction]);
          }
          // Return closed drawer
          return createQueryMock(() => [mockClosedDrawer]);
        })
      } as any);

      const result = await financeService.voidTransaction(mockTransactionId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cannot void transaction on a closed drawer');
    });

    it('should void a pay_out transaction and restore balance', async () => {
      const payOutTransaction = { ...mockTransaction, type: 'pay_out' as const, amount: 75 };
      
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'cash_transactions' && callCount === 1) {
            return createQueryMock(() => [payOutTransaction]);
          }
          if (table === 'cash_drawers' && callCount <= 3) {
            return createQueryMock(() => [mockDrawer]);
          }
          if (table === 'cash_transactions') {
            return createQueryMock(() => []);
          }
          const updateMock = createQueryMock(() => []);
          updateMock.update = vi.fn().mockImplementation((updateData) => {
            // Voiding a pay_out should add back to balance
            expect(updateData.current_balance).toBe(mockDrawer.current_balance + 75);
            return {
              eq: vi.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data: null, error: null })
              })
            };
          });
          return updateMock;
        })
      } as any);

      const result = await financeService.voidTransaction(mockTransactionId);

      expect(result.success).toBe(true);
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    it('should handle negative discrepancy on close', async () => {
      const drawerWithBalance = { ...mockDrawer, current_balance: 300 };
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return createQueryMock(() => [drawerWithBalance]);
          }
          const updateMock = createQueryMock(() => []);
          updateMock.update = vi.fn().mockImplementation((updateData) => {
            // Actual balance less than expected = negative discrepancy
            expect(updateData.discrepancy).toBe(-50); // 250 - 300 = -50
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updateData, error: null })
                })
              })
            };
          });
          return updateMock;
        })
      } as any);

      await financeService.closeDrawer({
        drawerId: mockDrawerId,
        actualBalance: 250
      });
    });

    it('should handle zero amount transaction', async () => {
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'cash_drawers' && callCount <= 2) {
            return createQueryMock(() => [mockDrawer]);
          }
          if (table === 'cash_transactions') {
            return createQueryMock(() => [{ ...mockTransaction, amount: 0 }]);
          }
          const updateMock = createQueryMock(() => []);
          updateMock.update = vi.fn().mockImplementation((updateData) => {
            // Zero amount should not change balance
            expect(updateData.current_balance).toBe(mockDrawer.current_balance);
            return {
              eq: vi.fn().mockReturnValue({
                then: (resolve: any) => resolve({ data: null, error: null })
              })
            };
          });
          return updateMock;
        })
      } as any);

      await financeService.recordTransaction({
        drawerId: mockDrawerId,
        userId: mockUserId,
        type: 'sale',
        amount: 0
      });
    });

    it('should handle drawer with null notes on close', async () => {
      const drawerNoNotes = { ...mockDrawer, notes: null };
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return createQueryMock(() => [drawerNoNotes]);
          }
          const updateMock = createQueryMock(() => []);
          updateMock.update = vi.fn().mockImplementation((updateData) => {
            expect(updateData.notes).toContain('Closing Note:');
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updateData, error: null })
                })
              })
            };
          });
          return updateMock;
        })
      } as any);

      await financeService.closeDrawer({
        drawerId: mockDrawerId,
        actualBalance: 250,
        notes: 'End of day'
      });
    });
  });
});
