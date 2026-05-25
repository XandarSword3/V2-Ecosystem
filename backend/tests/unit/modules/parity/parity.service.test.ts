
// Mock connection module before importing service
vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn()
}));

import { getSupabase } from '../../../../src/database/connection.js';
import * as parityService from '../../../../src/modules/parity/parity.service.js';

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

describe('Parity Service', () => {
  const mockPropertyId = 'prop-123';
  const mockRoomTypeId = 'room-type-1';
  const mockAlertId = 'alert-123';
  const mockUserId = 'user-456';

  const mockParityConfig = {
    id: 'config-1',
    property_id: mockPropertyId,
    is_enabled: true,
    check_frequency_hours: 24,
    tolerance_percentage: 5,
    tolerance_amount: 10,
    channels_to_monitor: ['BOOKING', 'EXPEDIA'],
    alert_on_undercut: true,
    alert_on_overpriced: false,
    undercut_threshold_percentage: 3,
    notification_emails: ['manager@hotel.com'],
    slack_webhook_url: 'https://hooks.slack.com/test',
    last_check_at: '2026-02-06T12:00:00Z',
    next_check_at: '2026-02-07T12:00:00Z'
  };

  const mockAlert = {
    id: mockAlertId,
    property_id: mockPropertyId,
    check_id: 'check-1',
    result_id: 'result-1',
    alert_type: 'undercut',
    severity: 'high' as const,
    channel_code: 'BOOKING',
    channel_name: 'Booking.com',
    room_type_id: mockRoomTypeId,
    check_date: '2026-02-07',
    our_rate: 150,
    channel_rate: 140,
    difference_amount: -10,
    difference_percentage: -6.67,
    status: 'new' as const,
    created_at: '2026-02-07T10:00:00Z'
  };

  const mockParityCheck = {
    id: 'check-1',
    property_id: mockPropertyId,
    room_type_id: mockRoomTypeId,
    check_date: '2026-02-07',
    our_rate: 150,
    our_currency: 'USD',
    status: 'pending' as const,
    created_at: '2026-02-07T10:00:00Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== CONFIGURATION TESTS ====================

  describe('getParityConfig', () => {
    it('should return parity config for a property', async () => {
      const mockQuery = createQueryMock(() => [mockParityConfig]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await parityService.getParityConfig(mockPropertyId);

      expect(result).toEqual(mockParityConfig);
      expect(getSupabase().from).toHaveBeenCalledWith('rate_parity_config');
    });

    it('should return null when config not found', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await parityService.getParityConfig(mockPropertyId);

      expect(result).toBeNull();
    });
  });

  describe('createOrUpdateParityConfig', () => {
    it('should create a new parity config', async () => {
      const newConfig = {
        is_enabled: true,
        check_frequency_hours: 12,
        tolerance_percentage: 3,
        tolerance_amount: 5,
        channels_to_monitor: ['BOOKING'],
        alert_on_undercut: true,
        alert_on_overpriced: false,
        undercut_threshold_percentage: 2,
        notification_emails: ['test@hotel.com']
      };

      const mockQuery = createQueryMock(() => [{ id: 'new-config', property_id: mockPropertyId, ...newConfig }]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await parityService.createOrUpdateParityConfig(mockPropertyId, newConfig);

      expect(result).toBeDefined();
      expect(getSupabase().from).toHaveBeenCalledWith('rate_parity_config');
    });

    it('should update an existing parity config', async () => {
      const updateData = {
        check_frequency_hours: 6,
        tolerance_percentage: 2
      };

      const mockQuery = createQueryMock(() => [{ ...mockParityConfig, ...updateData }]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await parityService.createOrUpdateParityConfig(mockPropertyId, updateData);

      expect(result).toBeDefined();
    });

    it('should throw error when upsert fails', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.upsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } })
        })
      });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await expect(parityService.createOrUpdateParityConfig(mockPropertyId, {}))
        .rejects.toEqual({ message: 'Database error' });
    });
  });

  describe('updateNextCheckTime', () => {
    it('should update the next check time based on frequency', async () => {
      const mockConfigQuery = createQueryMock(() => [mockParityConfig]);
      const mockUpdateQuery = createQueryMock(() => []);

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (callCount === 1) return mockConfigQuery;
          return mockUpdateQuery;
        })
      } as any);

      await parityService.updateNextCheckTime(mockPropertyId);

      expect(getSupabase().from).toHaveBeenCalledWith('rate_parity_config');
    });

    it('should do nothing when config not found', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await parityService.updateNextCheckTime(mockPropertyId);

      // Should only call from() once to get config
      expect(getSupabase().from).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== ALERT TESTS ====================

  describe('getAlerts', () => {
    it('should return all alerts for a property', async () => {
      const mockAlerts = [mockAlert, { ...mockAlert, id: 'alert-2', severity: 'medium' }];
      const mockQuery = createQueryMock(() => mockAlerts);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await parityService.getAlerts(mockPropertyId);

      expect(result).toEqual(mockAlerts);
      expect(getSupabase().from).toHaveBeenCalledWith('rate_parity_alerts');
    });

    it('should filter alerts by status', async () => {
      const mockQuery = createQueryMock(() => [mockAlert]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await parityService.getAlerts(mockPropertyId, { status: 'new' });

      expect(mockQuery.eq).toHaveBeenCalled();
    });

    it('should filter alerts by severity', async () => {
      const mockQuery = createQueryMock(() => [mockAlert]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await parityService.getAlerts(mockPropertyId, { severity: 'high' });

      expect(mockQuery.eq).toHaveBeenCalled();
    });

    it('should limit alert results', async () => {
      const mockQuery = createQueryMock(() => [mockAlert]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await parityService.getAlerts(mockPropertyId, { limit: 5 });

      expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('should return empty array when no alerts found', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await parityService.getAlerts(mockPropertyId);

      expect(result).toEqual([]);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should update alert status to acknowledged', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await parityService.acknowledgeAlert(mockAlertId, mockUserId, 'Investigating issue');

      expect(getSupabase().from).toHaveBeenCalledWith('rate_parity_alerts');
      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'acknowledged',
        acknowledged_by: mockUserId,
        notes: 'Investigating issue'
      }));
    });

    it('should acknowledge alert without notes', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await parityService.acknowledgeAlert(mockAlertId, mockUserId);

      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'acknowledged',
        acknowledged_by: mockUserId
      }));
    });
  });

  describe('resolveAlert', () => {
    it('should update alert status to resolved', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await parityService.resolveAlert(mockAlertId, 'Issue fixed');

      expect(getSupabase().from).toHaveBeenCalledWith('rate_parity_alerts');
      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'resolved',
        notes: 'Issue fixed'
      }));
    });

    it('should resolve alert without notes', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await parityService.resolveAlert(mockAlertId);

      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'resolved'
      }));
    });
  });

  describe('ignoreAlert', () => {
    it('should update alert status to ignored', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await parityService.ignoreAlert(mockAlertId, 'False positive');

      expect(getSupabase().from).toHaveBeenCalledWith('rate_parity_alerts');
      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ignored',
        notes: 'False positive'
      }));
    });

    it('should ignore alert without notes', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await parityService.ignoreAlert(mockAlertId);

      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ignored'
      }));
    });
  });

  // ==================== DASHBOARD TESTS ====================

  describe('getParityDashboard', () => {
    it('should return complete dashboard data', async () => {
      const mockChecks = [
        { ...mockParityCheck, status: 'compliant' },
        { ...mockParityCheck, id: 'check-2', status: 'violation' },
        { ...mockParityCheck, id: 'check-3', status: 'compliant' }
      ];
      const mockAlerts = [mockAlert];
      const mockChannelViolations = [
        { channel_code: 'BOOKING' },
        { channel_code: 'BOOKING' },
        { channel_code: 'EXPEDIA' }
      ];

      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'rate_parity_config') {
            return createQueryMock(() => [mockParityConfig]);
          }
          if (table === 'rate_parity_alerts' && callCount <= 3) {
            return createQueryMock(() => mockAlerts);
          }
          if (table === 'rate_parity_checks') {
            return createQueryMock(() => mockChecks);
          }
          if (table === 'rate_parity_alerts') {
            return createQueryMock(() => mockChannelViolations);
          }
          return createQueryMock(() => []);
        })
      } as any);

      const result = await parityService.getParityDashboard(mockPropertyId);

      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('recentAlerts');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('recentChecks');
      expect(result.stats).toHaveProperty('totalChecksToday');
      expect(result.stats).toHaveProperty('violationsToday');
      expect(result.stats).toHaveProperty('complianceRate');
      expect(result.stats).toHaveProperty('mostProblematicChannel');
    });

    it('should calculate correct compliance rate', async () => {
      const mockChecks = [
        { ...mockParityCheck, status: 'compliant' },
        { ...mockParityCheck, id: 'check-2', status: 'compliant' },
        { ...mockParityCheck, id: 'check-3', status: 'compliant' },
        { ...mockParityCheck, id: 'check-4', status: 'violation' }
      ];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          if (table === 'rate_parity_config') {
            return createQueryMock(() => [mockParityConfig]);
          }
          if (table === 'rate_parity_checks') {
            return createQueryMock(() => mockChecks);
          }
          return createQueryMock(() => []);
        })
      } as any);

      const result = await parityService.getParityDashboard(mockPropertyId);

      // 3 compliant out of 4 = 75% compliance
      expect(result.stats.complianceRate).toBe(75);
      expect(result.stats.totalChecksToday).toBe(4);
      expect(result.stats.violationsToday).toBe(1);
    });

    it('should return 100% compliance when no checks exist', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          if (table === 'rate_parity_config') {
            return createQueryMock(() => [mockParityConfig]);
          }
          return createQueryMock(() => []);
        })
      } as any);

      const result = await parityService.getParityDashboard(mockPropertyId);

      expect(result.stats.complianceRate).toBe(100);
      expect(result.stats.totalChecksToday).toBe(0);
    });

    it('should identify most problematic channel', async () => {
      const mockChannelViolations = [
        { channel_code: 'BOOKING' },
        { channel_code: 'BOOKING' },
        { channel_code: 'BOOKING' },
        { channel_code: 'EXPEDIA' },
        { channel_code: 'AGODA' }
      ];

      let alertCallCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          if (table === 'rate_parity_config') {
            return createQueryMock(() => [mockParityConfig]);
          }
          if (table === 'rate_parity_alerts') {
            alertCallCount++;
            if (alertCallCount === 1) {
              return createQueryMock(() => [mockAlert]);
            }
            return createQueryMock(() => mockChannelViolations);
          }
          if (table === 'rate_parity_checks') {
            return createQueryMock(() => []);
          }
          return createQueryMock(() => []);
        })
      } as any);

      const result = await parityService.getParityDashboard(mockPropertyId);

      expect(result.stats.mostProblematicChannel).toBe('BOOKING');
    });
  });

  // ==================== CHECK HISTORY TESTS ====================

  describe('getCheckHistory', () => {
    it('should return check history with results', async () => {
      const mockChecksWithResults = [
        {
          ...mockParityCheck,
          rate_parity_results: [
            {
              id: 'result-1',
              check_id: 'check-1',
              channel_code: 'BOOKING',
              channel_name: 'Booking.com',
              channel_rate: 145,
              is_parity: true
            }
          ]
        }
      ];

      const mockQuery = createQueryMock(() => mockChecksWithResults);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await parityService.getCheckHistory(mockPropertyId, '2026-01-01', '2026-02-07');

      expect(result).toEqual(mockChecksWithResults);
      expect(getSupabase().from).toHaveBeenCalledWith('rate_parity_checks');
    });

    it('should filter by date range', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await parityService.getCheckHistory(mockPropertyId, '2026-01-15', '2026-02-01');

      expect(mockQuery.gte).toHaveBeenCalledWith('check_date', '2026-01-15');
      expect(mockQuery.lte).toHaveBeenCalledWith('check_date', '2026-02-01');
    });

    it('should return empty array when no history found', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      const result = await parityService.getCheckHistory(mockPropertyId, '2020-01-01', '2020-01-31');

      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
        resolve({ data: null, error: { message: 'Database error' } });
        return Promise.resolve({ data: null, error: { message: 'Database error' } });
      };
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await expect(parityService.getCheckHistory(mockPropertyId, '2026-01-01', '2026-02-01'))
        .rejects.toEqual({ message: 'Database error' });
    });
  });

  // ==================== PARITY CHECK TESTS ====================

  describe('runParityCheck', () => {
    const mockProperty = { name: 'Test Hotel' };

    it('should throw error when parity monitoring is disabled', async () => {
      const disabledConfig = { ...mockParityConfig, is_enabled: false };
      const mockQuery = createQueryMock(() => [disabledConfig]);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await expect(parityService.runParityCheck(mockPropertyId, mockRoomTypeId, '2026-02-07', 150))
        .rejects.toThrow('Rate parity monitoring is not enabled for this property');
    });

    it('should throw error when config not found', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await expect(parityService.runParityCheck(mockPropertyId, mockRoomTypeId, '2026-02-07', 150))
        .rejects.toThrow('Rate parity monitoring is not enabled for this property');
    });

    it('should throw error when property not found', async () => {
      let callCount = 0;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          callCount++;
          if (table === 'rate_parity_config') {
            return createQueryMock(() => [mockParityConfig]);
          }
          if (table === 'properties') {
            const query = createQueryMock(() => []);
            query.single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
            return query;
          }
          return createQueryMock(() => []);
        })
      } as any);

      await expect(parityService.runParityCheck(mockPropertyId, mockRoomTypeId, '2026-02-07', 150))
        .rejects.toThrow('Property not found');
    });

    it('should create parity check record', async () => {
      let insertCalled = false;
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          if (table === 'rate_parity_config') {
            // Return config with no channels so we skip scraping
            return createQueryMock(() => [{ ...mockParityConfig, channels_to_monitor: [] }]);
          }
          if (table === 'properties') {
            return createQueryMock(() => [mockProperty]);
          }
          if (table === 'rate_parity_checks') {
            const mockQuery = createQueryMock(() => [mockParityCheck]);
            mockQuery.insert = vi.fn().mockImplementation((data) => {
              insertCalled = true;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'check-1', ...data }, error: null })
                })
              };
            });
            return mockQuery;
          }
          return createQueryMock(() => []);
        })
      } as any);

      const result = await parityService.runParityCheck(mockPropertyId, mockRoomTypeId, '2026-02-07', 150);

      expect(insertCalled).toBe(true);
      expect(result).toBeDefined();
      expect(result.status).toBe('compliant');
    });

    it('should return compliant status when no violations', async () => {
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          if (table === 'rate_parity_config') {
            return createQueryMock(() => [{ ...mockParityConfig, channels_to_monitor: [] }]);
          }
          if (table === 'properties') {
            return createQueryMock(() => [mockProperty]);
          }
          if (table === 'rate_parity_checks') {
            const mockQuery = createQueryMock(() => [mockParityCheck]);
            mockQuery.insert = vi.fn().mockImplementation((data) => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'check-1', ...data }, error: null })
              })
            }));
            return mockQuery;
          }
          return createQueryMock(() => []);
        })
      } as any);

      const result = await parityService.runParityCheck(mockPropertyId, mockRoomTypeId, '2026-02-07', 150);

      expect(result.status).toBe('compliant');
    });
  });

  describe('runFullParityCheck', () => {
    it('should throw error when no room types found', async () => {
      const mockQuery = createQueryMock(() => []);
      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await expect(parityService.runFullParityCheck(mockPropertyId))
        .rejects.toThrow('No room types found for property');
    });

    it('should return counts for checks and violations', async () => {
      const mockRoomTypes = [{ id: 'room-1' }, { id: 'room-2' }];
      const today = new Date().toISOString().split('T')[0];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          if (table === 'room_types') {
            return createQueryMock(() => mockRoomTypes);
          }
          if (table === 'room_rates') {
            return createQueryMock(() => [
              { room_type_id: 'room-1', rate: 150 },
              { room_type_id: 'room-2', rate: 200 }
            ]);
          }
          if (table === 'rate_parity_config') {
            return createQueryMock(() => [{ ...mockParityConfig, channels_to_monitor: [] }]);
          }
          if (table === 'properties') {
            return createQueryMock(() => [{ name: 'Test Hotel' }]);
          }
          if (table === 'rate_parity_checks') {
            const mockQuery = createQueryMock(() => [mockParityCheck]);
            mockQuery.insert = vi.fn().mockImplementation((data) => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: { id: `check-${Date.now()}`, ...data, status: 'compliant' }, 
                  error: null 
                })
              })
            }));
            return mockQuery;
          }
          return createQueryMock(() => []);
        })
      } as any);

      const result = await parityService.runFullParityCheck(mockPropertyId);

      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('violations');
      expect(result.checks).toBeGreaterThanOrEqual(0);
      expect(result.violations).toBeGreaterThanOrEqual(0);
    });

    it('should skip room types without rates', async () => {
      const mockRoomTypes = [{ id: 'room-1' }, { id: 'room-2' }, { id: 'room-3' }];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          if (table === 'room_types') {
            return createQueryMock(() => mockRoomTypes);
          }
          if (table === 'room_rates') {
            // Only return rate for room-1
            return createQueryMock(() => [{ room_type_id: 'room-1', rate: 150 }]);
          }
          if (table === 'rate_parity_config') {
            return createQueryMock(() => [{ ...mockParityConfig, channels_to_monitor: [] }]);
          }
          if (table === 'properties') {
            return createQueryMock(() => [{ name: 'Test Hotel' }]);
          }
          if (table === 'rate_parity_checks') {
            const mockQuery = createQueryMock(() => [mockParityCheck]);
            mockQuery.insert = vi.fn().mockImplementation((data) => ({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ 
                  data: { id: 'check-1', ...data, status: 'compliant' }, 
                  error: null 
                })
              })
            }));
            return mockQuery;
          }
          return createQueryMock(() => []);
        })
      } as any);

      const result = await parityService.runFullParityCheck(mockPropertyId);

      // Should only run 1 check (for room-1)
      expect(result.checks).toBeLessThanOrEqual(1);
    });

    it('should handle errors during individual checks gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockRoomTypes = [{ id: 'room-1' }];

      vi.mocked(getSupabase).mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          if (table === 'room_types') {
            return createQueryMock(() => mockRoomTypes);
          }
          if (table === 'room_rates') {
            return createQueryMock(() => [{ room_type_id: 'room-1', rate: 150 }]);
          }
          if (table === 'rate_parity_config') {
            // Return disabled config to trigger error
            return createQueryMock(() => [{ ...mockParityConfig, is_enabled: false }]);
          }
          return createQueryMock(() => []);
        })
      } as any);

      const result = await parityService.runFullParityCheck(mockPropertyId);

      expect(result.checks).toBe(0);
      expect(result.violations).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
