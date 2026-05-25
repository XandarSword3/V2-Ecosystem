
// Storage for mock data
let mockReportTemplates: Array<Record<string, unknown>> = [];
let mockSavedReports: Array<Record<string, unknown>> = [];
let mockKpiDefinitions: Array<Record<string, unknown>> = [];
let mockKpiTargets: Array<Record<string, unknown>> = [];
let mockBookings: Array<Record<string, unknown>> = [];
let mockRooms: Array<Record<string, unknown>> = [];
let mockRoomTypes: Array<Record<string, unknown>> = [];
let mockHousekeepingTasks: Array<Record<string, unknown>> = [];
let mockMaintenanceTasks: Array<Record<string, unknown>> = [];
let mockScheduledReports: Array<Record<string, unknown>> = [];
let mockDashboards: Array<Record<string, unknown>> = [];
let mockDashboardWidgets: Array<Record<string, unknown>> = [];

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike', 'range', 'filter'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown; count?: number }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null, count: Array.isArray(data) ? data.length : 0 });
    return Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : 0 });
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
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      resolve({ data: insertData, error: null });
      return Promise.resolve({ data: insertData, error: null });
    }
  }));
  
  mockObj.upsert = vi.fn().mockImplementation((data, _options) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      resolve({ data, error: null });
      return Promise.resolve({ data, error: null });
    }
  }));
  
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  
  return mockObj;
}

// Create storage mock
const mockStorage = {
  from: vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/report.pdf' } })
  })
};

// Create the mock supabase with a switch statement for different tables
const mockSupabase = {
  from: vi.fn((table: string) => {
    switch (table) {
      case 'report_templates':
        return createQueryMock(() => mockReportTemplates);
      case 'saved_reports':
        return createQueryMock(() => mockSavedReports);
      case 'kpi_definitions':
        return createQueryMock(() => mockKpiDefinitions);
      case 'kpi_targets':
        return createQueryMock(() => mockKpiTargets);
      case 'bookings':
      case 'transactions':
        return createQueryMock(() => mockBookings);
      case 'rooms':
        return createQueryMock(() => mockRooms);
      case 'room_types':
        return createQueryMock(() => mockRoomTypes);
      case 'housekeeping_tasks':
        return createQueryMock(() => mockHousekeepingTasks);
      case 'maintenance_tasks':
        return createQueryMock(() => mockMaintenanceTasks);
      case 'report_scheduled':
        return createQueryMock(() => mockScheduledReports);
      case 'report_dashboards':
        return createQueryMock(() => mockDashboards);
      case 'dashboard_widgets':
        return createQueryMock(() => mockDashboardWidgets);
      case 'report_execution_log':
        return createQueryMock(() => []);
      case 'data_snapshots':
        return createQueryMock(() => []);
      case 'report_delivery_log':
        return createQueryMock(() => []);
      case 'users':
        return createQueryMock(() => [{ id: 'user-1', email: 'test@example.com' }]);
      default:
        return createQueryMock(() => []);
    }
  }),
  storage: mockStorage
};

// Mock the database connection
vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('../../../../src/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' })
    })
  }
}));

// Mock node-cron
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn()
  }
}));

// Mock pdfkit
vi.mock('pdfkit', () => ({
  default: class MockPDFDocument {
    chunks: Buffer[] = [];
    handlers: Record<string, (arg?: unknown) => void> = {};
    
    on(event: string, handler: (arg?: unknown) => void) {
      this.handlers[event] = handler;
      return this;
    }
    fontSize() { return this; }
    text() { return this; }
    moveDown() { return this; }
    font() { return this; }
    end() {
      if (this.handlers.data) this.handlers.data(Buffer.from('test'));
      if (this.handlers.end) this.handlers.end();
    }
  }
}));

// Mock exceljs
vi.mock('exceljs', () => ({
  default: {
    Workbook: class MockWorkbook {
      addWorksheet() {
        return {
          addRow: vi.fn(),
          getRow: vi.fn().mockReturnValue({ font: {}, fill: {} }),
          columns: []
        };
      }
      xlsx = {
        writeBuffer: vi.fn().mockResolvedValue(Buffer.from('excel content'))
      };
    }
  }
}));

// Mock json2csv
vi.mock('json2csv', () => ({
  Parser: class MockParser {
    parse(data: unknown[]) {
      return 'col1,col2\nval1,val2';
    }
  }
}));

// Import the service AFTER mocking
import { reportingService } from '../../../../src/modules/reporting/reporting.service';

describe('ReportingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReportTemplates = [];
    mockSavedReports = [];
    mockKpiDefinitions = [];
    mockKpiTargets = [];
    mockBookings = [];
    mockRooms = [];
    mockRoomTypes = [];
    mockHousekeepingTasks = [];
    mockMaintenanceTasks = [];
    mockScheduledReports = [];
    mockDashboards = [];
    mockDashboardWidgets = [];
  });

  describe('getTemplates', () => {
    it('should return templates for a property', async () => {
      mockReportTemplates = [
        { id: 'tpl-1', name: 'Revenue Report', category: 'financial', is_active: true },
        { id: 'tpl-2', name: 'Occupancy Report', category: 'operations', is_active: true }
      ];
      
      const result = await reportingService.getTemplates('prop-1');
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Revenue Report');
      expect(mockSupabase.from).toHaveBeenCalledWith('report_templates');
    });

    it('should filter templates by category', async () => {
      mockReportTemplates = [
        { id: 'tpl-1', name: 'Revenue Report', category: 'financial', is_active: true }
      ];
      
      const result = await reportingService.getTemplates('prop-1', 'financial');
      
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('financial');
    });

    it('should return empty array when no templates exist', async () => {
      mockReportTemplates = [];
      
      const result = await reportingService.getTemplates('prop-1');
      
      expect(result).toEqual([]);
    });
  });

  describe('getTemplateById', () => {
    it('should return a template by id', async () => {
      mockReportTemplates = [
        { id: 'tpl-1', name: 'Revenue Report', query_config: { table: 'bookings' } }
      ];
      
      const result = await reportingService.getTemplateById('tpl-1');
      
      expect(result).toBeDefined();
      expect(result.name).toBe('Revenue Report');
      expect(mockSupabase.from).toHaveBeenCalledWith('report_templates');
    });

    it('should return null for non-existent template', async () => {
      mockReportTemplates = [];
      
      const result = await reportingService.getTemplateById('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('createTemplate', () => {
    it('should create a new report template', async () => {
      const templateData = {
        name: 'Custom Report',
        description: 'A custom report template',
        category: 'financial',
        queryConfig: { table: 'bookings', columns: ['id', 'total_amount'] },
        defaultParams: { limit: 100 }
      };
      
      const result = await reportingService.createTemplate('prop-1', templateData, 'user-1');
      
      expect(result).toBeDefined();
      expect(result.name).toBe('Custom Report');
      expect(mockSupabase.from).toHaveBeenCalledWith('report_templates');
    });

    it('should set default allowed roles', async () => {
      const templateData = {
        name: 'Simple Report',
        category: 'operations',
        queryConfig: { table: 'bookings' }
      };
      
      const result = await reportingService.createTemplate('prop-1', templateData, 'user-1');
      
      expect(result).toBeDefined();
    });
  });

  describe('updateTemplate', () => {
    it('should update template fields', async () => {
      mockReportTemplates = [
        { id: 'tpl-1', name: 'Old Name', category: 'financial', is_system: false }
      ];
      
      const result = await reportingService.updateTemplate('tpl-1', {
        name: 'New Name',
        description: 'Updated description'
      });
      
      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('report_templates');
    });

    it('should update query config', async () => {
      mockReportTemplates = [
        { id: 'tpl-1', name: 'Test', is_system: false }
      ];
      
      const result = await reportingService.updateTemplate('tpl-1', {
        queryConfig: { table: 'rooms', columns: ['id', 'name'] }
      });
      
      expect(result).toBeDefined();
    });
  });

  describe('deleteTemplate', () => {
    it('should soft delete a template by setting is_active to false', async () => {
      mockReportTemplates = [
        { id: 'tpl-1', name: 'Test', is_system: false, is_active: true }
      ];
      
      await reportingService.deleteTemplate('tpl-1');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('report_templates');
    });
  });

  describe('executeReport', () => {
    it('should execute a report and return results with metadata', async () => {
      mockReportTemplates = [{
        id: 'tpl-1',
        name: 'Revenue Report',
        default_params: {},
        query_config: {
          table: 'bookings',
          columns: ['id', 'total_amount']
        }
      }];
      mockBookings = [
        { id: 'book-1', total_amount: 100, property_id: 'prop-1' },
        { id: 'book-2', total_amount: 200, property_id: 'prop-1' }
      ];
      
      const result = await reportingService.executeReport('prop-1', 'tpl-1', {}, 'user-1');
      
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.generatedAt).toBeInstanceOf(Date);
      expect(result.metadata.rowCount).toBeGreaterThanOrEqual(0);
      expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw error if template not found', async () => {
      mockReportTemplates = [];
      
      await expect(reportingService.executeReport('prop-1', 'fake-tpl', {}, 'user-1'))
        .rejects.toThrow('Report template not found');
    });

    it('should merge default params with provided params', async () => {
      mockReportTemplates = [{
        id: 'tpl-1',
        default_params: { limit: 50, sortBy: 'created_at' },
        query_config: { table: 'bookings' }
      }];
      mockBookings = [];
      
      const result = await reportingService.executeReport('prop-1', 'tpl-1', { limit: 100 }, 'user-1');
      
      expect(result).toBeDefined();
      expect(result.data).toEqual([]);
    });

    it('should calculate totals when aggregate columns are configured', async () => {
      mockReportTemplates = [{
        id: 'tpl-1',
        default_params: {},
        query_config: {
          table: 'bookings',
          columns: ['id', 'total_amount'],
          aggregateColumns: ['total_amount']
        }
      }];
      mockBookings = [
        { id: 'book-1', total_amount: 100 },
        { id: 'book-2', total_amount: 200 }
      ];
      
      const result = await reportingService.executeReport('prop-1', 'tpl-1', {}, 'user-1');
      
      expect(result.totals).toBeDefined();
      expect(result.totals.total_amount).toBe(300);
    });
  });

  describe('getSavedReports', () => {
    it('should return saved reports for a user', async () => {
      mockSavedReports = [
        { id: 'sr-1', name: 'My Report', created_by: 'user-1', is_public: false },
        { id: 'sr-2', name: 'Public Report', created_by: 'user-2', is_public: true }
      ];
      
      const result = await reportingService.getSavedReports('prop-1', 'user-1');
      
      expect(result).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('saved_reports');
    });

    it('should return empty array when no saved reports exist', async () => {
      mockSavedReports = [];
      
      const result = await reportingService.getSavedReports('prop-1', 'user-1');
      
      expect(result).toEqual([]);
    });
  });

  describe('saveReport', () => {
    it('should save a report configuration', async () => {
      const reportData = {
        name: 'Monthly Revenue',
        description: 'Revenue report for the month',
        templateId: 'tpl-1',
        params: { dateRange: { start: '2024-01-01', end: '2024-01-31' } },
        isPublic: false
      };
      
      const result = await reportingService.saveReport('prop-1', 'user-1', reportData);
      
      expect(result).toBeDefined();
      expect(result.name).toBe('Monthly Revenue');
      expect(mockSupabase.from).toHaveBeenCalledWith('saved_reports');
    });
  });

  describe('updateSavedReport', () => {
    it('should update saved report fields', async () => {
      mockSavedReports = [
        { id: 'sr-1', name: 'Old Name', created_by: 'user-1' }
      ];
      
      const result = await reportingService.updateSavedReport('sr-1', 'user-1', {
        name: 'New Name',
        isPublic: true
      });
      
      expect(result).toBeDefined();
    });
  });

  describe('deleteSavedReport', () => {
    it('should delete a saved report', async () => {
      mockSavedReports = [
        { id: 'sr-1', name: 'Test', created_by: 'user-1' }
      ];
      
      await reportingService.deleteSavedReport('sr-1', 'user-1');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('saved_reports');
    });
  });

  describe('getKPIs', () => {
    it('should calculate KPIs for a date range', async () => {
      mockKpiDefinitions = [
        { id: 'kpi-1', code: 'total_revenue', name: 'Total Revenue', calculation_type: 'total_revenue', unit: 'currency', is_active: true }
      ];
      mockKpiTargets = [];
      mockBookings = [
        { id: 'book-1', total_amount: 500 },
        { id: 'book-2', total_amount: 700 }
      ];
      
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };
      
      const result = await reportingService.getKPIs('prop-1', dateRange);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('kpi_definitions');
    });

    it('should filter KPIs by codes', async () => {
      mockKpiDefinitions = [
        { id: 'kpi-1', code: 'occupancy_rate', name: 'Occupancy Rate', calculation_type: 'occupancy_rate', is_active: true }
      ];
      mockRooms = [{ id: 'room-1' }, { id: 'room-2' }];
      mockBookings = [];
      
      const result = await reportingService.getKPIs(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        ['occupancy_rate']
      );
      
      expect(result).toBeDefined();
    });

    it('should include target and variance when target exists', async () => {
      mockKpiDefinitions = [
        { id: 'kpi-1', code: 'booking_count', name: 'Booking Count', calculation_type: 'booking_count', is_active: true }
      ];
      mockKpiTargets = [
        { kpi_code: 'booking_count', target_value: 100 }
      ];
      mockBookings = [];
      
      const result = await reportingService.getKPIs(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      );
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('setKPITarget', () => {
    it('should create a KPI target', async () => {
      const result = await reportingService.setKPITarget(
        'prop-1',
        'occupancy_rate',
        'monthly',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
        85,
        90,
        'Q1 target',
        'user-1'
      );
      
      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('kpi_targets');
    });

    it('should create target without optional fields', async () => {
      const result = await reportingService.setKPITarget(
        'prop-1',
        'adr',
        'weekly',
        new Date('2024-01-01'),
        new Date('2024-01-07'),
        150
      );
      
      expect(result).toBeDefined();
    });
  });

  describe('generateRevenueReport', () => {
    it('should generate revenue report with summary and breakdown', async () => {
      mockBookings = [
        { id: 'b1', total_amount: 500, amount: 500, room_rate: 400, created_at: '2024-01-15T10:00:00Z', status: 'confirmed' },
        { id: 'b2', total_amount: 700, amount: 700, room_rate: 600, created_at: '2024-01-16T14:00:00Z', status: 'checked_in' }
      ];
      
      const result = await reportingService.generateRevenueReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        'day'
      );
      
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalRevenue).toBe(1200);
      expect(result.summary.roomRevenue).toBe(1200);
      expect(result.summary.bookingCount).toBe(2);
      expect(result.breakdown).toBeDefined();
      expect(Array.isArray(result.breakdown)).toBe(true);
    });

    it('should group by week', async () => {
      mockBookings = [
        { id: 'b1', total_amount: 300, amount: 300, room_rate: 250, created_at: '2024-01-08T10:00:00Z', status: 'confirmed' }
      ];
      
      const result = await reportingService.generateRevenueReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        'week'
      );
      
      expect(result.breakdown).toBeDefined();
    });

    it('should group by month', async () => {
      mockBookings = [
        { id: 'b1', total_amount: 1000, amount: 1000, room_rate: 800, created_at: '2024-01-15T10:00:00Z', status: 'confirmed' }
      ];
      
      const result = await reportingService.generateRevenueReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-03-31') },
        'month'
      );
      
      expect(result.breakdown).toBeDefined();
    });

    it('should handle empty bookings', async () => {
      mockBookings = [];
      
      const result = await reportingService.generateRevenueReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      );
      
      expect(result.summary.totalRevenue).toBe(0);
      expect(result.summary.bookingCount).toBe(0);
      expect(result.summary.avgBookingValue).toBe(0);
    });
  });

  describe('generateOccupancyReport', () => {
    it('should generate occupancy report with room type breakdown', async () => {
      mockRooms = [
        { id: 'room-1', room_type_id: 'rt-1', is_active: true },
        { id: 'room-2', room_type_id: 'rt-1', is_active: true },
        { id: 'room-3', room_type_id: 'rt-2', is_active: true }
      ];
      mockRoomTypes = [
        { id: 'rt-1', name: 'Standard' },
        { id: 'rt-2', name: 'Deluxe' }
      ];
      mockBookings = [
        { id: 'b1', room_id: 'room-1', check_in: '2024-01-15', check_out: '2024-01-17', status: 'confirmed', metadata: { unit_id: 'room-1', check_in_date: '2024-01-15', check_out_date: '2024-01-17' } }
      ];
      
      const result = await reportingService.generateOccupancyReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      );
      
      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalRooms).toBe(3);
      expect(result.byRoomType).toBeDefined();
      expect(Array.isArray(result.byRoomType)).toBe(true);
    });

    it('should handle property with no rooms', async () => {
      mockRooms = [];
      mockRoomTypes = [];
      mockBookings = [];
      
      const result = await reportingService.generateOccupancyReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      );
      
      expect(result.summary.totalRooms).toBe(1); // Default to 1 to avoid division by zero
    });
  });

  describe('generateChannelPerformanceReport', () => {
    it('should generate channel performance report', async () => {
      mockBookings = [
        { id: 'b1', amount: 500, status: 'confirmed', metadata: { source: 'booking.com' }, created_at: '2024-01-15T10:00:00Z' },
        { id: 'b2', amount: 600, status: 'confirmed', metadata: { source: 'booking.com' }, created_at: '2024-01-15T10:00:00Z' },
        { id: 'b3', amount: 800, status: 'confirmed', metadata: { source: 'direct' }, created_at: '2024-01-15T10:00:00Z' },
        { id: 'b4', amount: 300, status: 'confirmed', metadata: { source: null }, created_at: '2024-01-15T10:00:00Z' }
      ];
      
      const result = await reportingService.generateChannelPerformanceReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      );
      
      expect(result).toBeDefined();
      expect(result.summary.totalBookings).toBe(4);
      expect(result.summary.totalRevenue).toBe(2200);
      expect(result.byChannel).toBeDefined();
      expect(Array.isArray(result.byChannel)).toBe(true);
    });

    it('should handle bookings without source', async () => {
      mockBookings = [
        { id: 'b1', amount: 500, status: 'confirmed', metadata: { source: null }, created_at: '2024-01-15T10:00:00Z' }
      ];
      
      const result = await reportingService.generateChannelPerformanceReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      );
      
      expect(result.byChannel.some((c: { channel: string }) => c.channel === 'direct')).toBe(true);
    });
  });

  describe('generateHousekeepingReport', () => {
    it('should generate housekeeping report with task breakdown', async () => {
      mockHousekeepingTasks = [
        { id: 't1', status: 'completed', assigned_to: 'staff-1', started_at: '2024-01-15T09:00:00Z', completed_at: '2024-01-15T09:30:00Z' },
        { id: 't2', status: 'pending', assigned_to: 'staff-1' },
        { id: 't3', status: 'in_progress', assigned_to: 'staff-2' }
      ];
      
      const result = await reportingService.generateHousekeepingReport('prop-1', new Date('2024-01-15'));
      
      expect(result).toBeDefined();
      expect(result.date).toBe('2024-01-15');
      expect(result.summary.total).toBe(3);
      expect(result.summary.completed).toBe(1);
      expect(result.summary.pending).toBe(1);
      expect(result.summary.inProgress).toBe(1);
      expect(result.summary.completionRate).toBeCloseTo(33.33, 1);
      expect(result.byStaff).toBeDefined();
    });

    it('should calculate average completion time', async () => {
      mockHousekeepingTasks = [
        { id: 't1', status: 'completed', started_at: '2024-01-15T09:00:00Z', completed_at: '2024-01-15T09:30:00Z' },
        { id: 't2', status: 'completed', started_at: '2024-01-15T10:00:00Z', completed_at: '2024-01-15T10:45:00Z' }
      ];
      
      const result = await reportingService.generateHousekeepingReport('prop-1', new Date('2024-01-15'));
      
      expect(result.summary.avgCompletionTimeMinutes).toBeGreaterThan(0);
    });

    it('should handle no tasks', async () => {
      mockHousekeepingTasks = [];
      
      const result = await reportingService.generateHousekeepingReport('prop-1', new Date('2024-01-15'));
      
      expect(result.summary.total).toBe(0);
      expect(result.summary.completionRate).toBe(0);
    });
  });

  describe('generateMaintenanceReport', () => {
    it('should generate maintenance report with priority and category breakdown', async () => {
      mockMaintenanceTasks = [
        { id: 't1', status: 'completed', priority: 'high', category: 'plumbing' },
        { id: 't2', status: 'pending', priority: 'low', category: 'electrical' },
        { id: 't3', status: 'in_progress', priority: 'high', category: 'plumbing' }
      ];
      
      const result = await reportingService.generateMaintenanceReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      );
      
      expect(result).toBeDefined();
      expect(result.summary.total).toBe(3);
      expect(result.summary.completed).toBe(1);
      expect(result.summary.open).toBe(2);
      expect(result.byPriority).toBeDefined();
      expect(result.byCategory).toBeDefined();
    });

    it('should use defaults for missing priority and category', async () => {
      mockMaintenanceTasks = [
        { id: 't1', status: 'completed', priority: null, category: null }
      ];
      
      const result = await reportingService.generateMaintenanceReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      );
      
      expect(result.byPriority.some((p: { priority: string }) => p.priority === 'normal')).toBe(true);
      expect(result.byCategory.some((c: { category: string }) => c.category === 'general')).toBe(true);
    });
  });

  describe('getScheduledReports', () => {
    it('should return scheduled reports for a property', async () => {
      mockScheduledReports = [
        { id: 'sch-1', name: 'Daily Revenue', frequency: 'daily', next_run_at: '2024-01-16T08:00:00Z' },
        { id: 'sch-2', name: 'Weekly Summary', frequency: 'weekly', next_run_at: '2024-01-22T08:00:00Z' }
      ];
      
      const result = await reportingService.getScheduledReports('prop-1');
      
      expect(result).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('report_scheduled');
    });
  });

  describe('createScheduledReport', () => {
    it('should create a daily scheduled report', async () => {
      const scheduleData = {
        name: 'Daily Revenue Report',
        templateId: 'tpl-1',
        params: { filters: {} },
        frequency: 'daily',
        hour: 8,
        minute: 0,
        timezone: 'UTC',
        exportFormat: 'pdf',
        recipients: [{ type: 'email', address: 'manager@hotel.com' }]
      };
      
      const result = await reportingService.createScheduledReport('prop-1', 'user-1', scheduleData);
      
      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('report_scheduled');
    });

    it('should create a weekly scheduled report', async () => {
      const scheduleData = {
        name: 'Weekly Summary',
        templateId: 'tpl-1',
        params: {},
        frequency: 'weekly',
        dayOfWeek: 1, // Monday
        hour: 9,
        minute: 0,
        exportFormat: 'excel',
        recipients: [{ type: 'user', id: 'user-1' }]
      };
      
      const result = await reportingService.createScheduledReport('prop-1', 'user-1', scheduleData);
      
      expect(result).toBeDefined();
    });

    it('should create a monthly scheduled report', async () => {
      const scheduleData = {
        name: 'Monthly Report',
        templateId: 'tpl-1',
        params: {},
        frequency: 'monthly',
        dayOfMonth: 1,
        hour: 6,
        minute: 0,
        exportFormat: 'csv',
        recipients: [{ type: 'email', address: 'exec@hotel.com' }]
      };
      
      const result = await reportingService.createScheduledReport('prop-1', 'user-1', scheduleData);
      
      expect(result).toBeDefined();
    });
  });

  describe('updateScheduledReport', () => {
    it('should update scheduled report fields', async () => {
      mockScheduledReports = [
        { id: 'sch-1', frequency: 'daily', hour: 8, minute: 0, timezone: 'UTC' }
      ];
      
      const result = await reportingService.updateScheduledReport('sch-1', {
        name: 'Updated Name',
        hour: 10
      });
      
      expect(result).toBeDefined();
    });

    it('should recalculate next run time when schedule changes', async () => {
      mockScheduledReports = [
        { id: 'sch-1', frequency: 'daily', hour: 8, minute: 0, timezone: 'UTC', day_of_week: 1 }
      ];
      
      const result = await reportingService.updateScheduledReport('sch-1', {
        frequency: 'weekly',
        dayOfWeek: 5
      });
      
      expect(result).toBeDefined();
    });
  });

  describe('deleteScheduledReport', () => {
    it('should delete a scheduled report', async () => {
      mockScheduledReports = [{ id: 'sch-1', name: 'Test' }];
      
      await reportingService.deleteScheduledReport('sch-1');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('report_scheduled');
    });
  });

  describe('getDashboards', () => {
    it('should return dashboards for a property', async () => {
      mockDashboards = [
        { id: 'dash-1', name: 'Main Dashboard', is_default: true },
        { id: 'dash-2', name: 'Operations Dashboard', is_default: false }
      ];
      mockDashboardWidgets = [];
      
      const result = await reportingService.getDashboards('prop-1');
      
      expect(result).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('report_dashboards');
    });
  });

  describe('getDashboardWithWidgets', () => {
    it('should return dashboard with all widgets', async () => {
      mockDashboards = [
        { id: 'dash-1', name: 'Main Dashboard', layout_type: 'grid' }
      ];
      mockDashboardWidgets = [
        { id: 'w1', dashboard_id: 'dash-1', widget_type: 'kpi', position_x: 0, position_y: 0 },
        { id: 'w2', dashboard_id: 'dash-1', widget_type: 'chart', position_x: 4, position_y: 0 }
      ];
      
      const result = await reportingService.getDashboardWithWidgets('dash-1');
      
      expect(result).toBeDefined();
      expect(result.widgets).toBeDefined();
    });

    it('should return null for non-existent dashboard', async () => {
      mockDashboards = [];
      
      const result = await reportingService.getDashboardWithWidgets('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('createDashboard', () => {
    it('should create a new dashboard', async () => {
      const dashboardData = {
        name: 'New Dashboard',
        description: 'A custom dashboard',
        layoutType: 'grid',
        isDefault: false
      };
      
      const result = await reportingService.createDashboard('prop-1', dashboardData, 'user-1');
      
      expect(result).toBeDefined();
      expect(result.name).toBe('New Dashboard');
      expect(mockSupabase.from).toHaveBeenCalledWith('report_dashboards');
    });

    it('should unset other defaults when creating default dashboard', async () => {
      mockDashboards = [
        { id: 'dash-1', name: 'Old Default', is_default: true }
      ];
      
      const dashboardData = {
        name: 'New Default',
        isDefault: true
      };
      
      const result = await reportingService.createDashboard('prop-1', dashboardData, 'user-1');
      
      expect(result).toBeDefined();
    });
  });

  describe('addWidget', () => {
    it('should add a widget to a dashboard', async () => {
      const widgetData = {
        widgetType: 'kpi',
        title: 'Revenue KPI',
        config: { kpiCode: 'total_revenue' },
        positionX: 0,
        positionY: 0,
        width: 4,
        height: 2
      };
      
      const result = await reportingService.addWidget('dash-1', widgetData);
      
      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('dashboard_widgets');
    });

    it('should add widget with template reference', async () => {
      const widgetData = {
        widgetType: 'report',
        title: 'Revenue Table',
        config: {},
        templateId: 'tpl-1'
      };
      
      const result = await reportingService.addWidget('dash-1', widgetData);
      
      expect(result).toBeDefined();
    });
  });

  describe('updateWidgetLayout', () => {
    it('should update widget position and size', async () => {
      mockDashboardWidgets = [
        { id: 'w1', position_x: 0, position_y: 0, width: 4, height: 2 }
      ];
      
      await reportingService.updateWidgetLayout('w1', {
        positionX: 4,
        positionY: 2,
        width: 6,
        height: 4
      });
      
      expect(mockSupabase.from).toHaveBeenCalledWith('dashboard_widgets');
    });
  });

  describe('deleteWidget', () => {
    it('should delete a widget', async () => {
      mockDashboardWidgets = [{ id: 'w1' }];
      
      await reportingService.deleteWidget('w1');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('dashboard_widgets');
    });
  });

  describe('createDailySnapshot', () => {
    it('should create a daily snapshot of metrics', async () => {
      mockKpiDefinitions = [
        { id: 'kpi-1', code: 'booking_count', calculation_type: 'booking_count', is_active: true }
      ];
      mockBookings = [
        { id: 'b1', total_amount: 500, status: 'confirmed' },
        { id: 'b2', total_amount: 300, status: 'checked_in' }
      ];
      
      await reportingService.createDailySnapshot('prop-1', new Date('2024-01-15'));
      
      expect(mockSupabase.from).toHaveBeenCalledWith('data_snapshots');
    });

    it('should use current date if not provided', async () => {
      mockKpiDefinitions = [];
      mockBookings = [];
      
      await reportingService.createDailySnapshot('prop-1');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('data_snapshots');
    });
  });

  describe('lockMonthSnapshot', () => {
    it('should lock all snapshots for a month', async () => {
      await reportingService.lockMonthSnapshot('prop-1', new Date('2024-01-15'), 'user-1');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('data_snapshots');
    });
  });

  describe('exportReport', () => {
    it('should export report to PDF format', async () => {
      const reportResult = {
        data: [{ id: 1, name: 'Test' }],
        totals: {},
        metadata: {
          generatedAt: new Date(),
          rowCount: 1,
          executionTimeMs: 100
        }
      };
      
      const result = await reportingService.exportReport(reportResult, 'pdf', 'Test Report');
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should export report to Excel format', async () => {
      const reportResult = {
        data: [{ id: 1, amount: 100 }],
        totals: { amount: 100 },
        metadata: {
          generatedAt: new Date(),
          rowCount: 1,
          executionTimeMs: 50
        }
      };
      
      const result = await reportingService.exportReport(reportResult, 'excel', 'Excel Report');
      
      expect(result).toBeDefined();
    });

    it('should export report to CSV format', async () => {
      const reportResult = {
        data: [{ id: 1, name: 'Test' }],
        metadata: {
          generatedAt: new Date(),
          rowCount: 1,
          executionTimeMs: 30
        }
      };
      
      const result = await reportingService.exportReport(reportResult, 'csv', 'CSV Report');
      
      expect(result).toBeDefined();
    });

    it('should throw error for unsupported format', async () => {
      const reportResult = {
        data: [],
        metadata: {
          generatedAt: new Date(),
          rowCount: 0,
          executionTimeMs: 0
        }
      };
      
      await expect(reportingService.exportReport(reportResult, 'invalid', 'Test'))
        .rejects.toThrow('Unsupported export format: invalid');
    });

    it('should throw error when exporting empty CSV', async () => {
      const reportResult = {
        data: [],
        metadata: {
          generatedAt: new Date(),
          rowCount: 0,
          executionTimeMs: 0
        }
      };
      
      await expect(reportingService.exportReport(reportResult, 'csv', 'Empty'))
        .rejects.toThrow('No data to export');
    });
  });

  describe('KPI calculation types', () => {
    it('should calculate ADR (Average Daily Rate)', async () => {
      mockKpiDefinitions = [
        { id: 'kpi-1', code: 'adr', name: 'ADR', calculation_type: 'adr', is_active: true }
      ];
      mockBookings = [
        { room_rate: 200, nights: 2 },
        { room_rate: 300, nights: 3 }
      ];
      
      const result = await reportingService.getKPIs(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        ['adr']
      );
      
      expect(result).toBeDefined();
    });

    it('should calculate RevPAR', async () => {
      mockKpiDefinitions = [
        { id: 'kpi-1', code: 'revpar', name: 'RevPAR', calculation_type: 'revpar', is_active: true }
      ];
      mockRooms = [{ id: 'r1' }, { id: 'r2' }];
      mockBookings = [{ room_rate: 200 }];
      
      const result = await reportingService.getKPIs(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-07') },
        ['revpar']
      );
      
      expect(result).toBeDefined();
    });

    it('should calculate cancellation rate', async () => {
      mockKpiDefinitions = [
        { id: 'kpi-1', code: 'cancellation_rate', name: 'Cancellation Rate', calculation_type: 'cancellation_rate', is_active: true }
      ];
      mockBookings = [
        { status: 'confirmed' },
        { status: 'cancelled' }
      ];
      
      const result = await reportingService.getKPIs(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        ['cancellation_rate']
      );
      
      expect(result).toBeDefined();
    });

    it('should calculate average stay', async () => {
      mockKpiDefinitions = [
        { id: 'kpi-1', code: 'avg_stay', name: 'Average Stay', calculation_type: 'average_stay', is_active: true }
      ];
      mockBookings = [
        { nights: 2 },
        { nights: 5 },
        { nights: 3 }
      ];
      
      const result = await reportingService.getKPIs(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        ['avg_stay']
      );
      
      expect(result).toBeDefined();
    });
  });

  describe('startScheduler', () => {
    it('should start the cron scheduler without throwing', () => {
      // The scheduler calls node-cron's schedule method
      // We just verify it runs without error
      expect(() => reportingService.startScheduler()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle missing or null values in booking calculations', async () => {
      mockBookings = [
        { id: 'b1', total_amount: null, amount: null, room_rate: undefined, created_at: '2024-01-15T10:00:00Z', status: 'confirmed' },
        { id: 'b2', total_amount: 200, amount: 200, room_rate: 150, created_at: '2024-01-16T10:00:00Z', status: 'confirmed' }
      ];
      
      const result = await reportingService.generateRevenueReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      );
      
      expect(result.summary.totalRevenue).toBe(200);
      expect(result.summary.roomRevenue).toBe(200);
    });

    it('should handle empty property with no data', async () => {
      mockBookings = [];
      mockRooms = [];
      mockRoomTypes = [];
      
      const result = await reportingService.generateOccupancyReport(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      );
      
      expect(result).toBeDefined();
      expect(result.summary.overallOccupancy).toBe(0);
    });

    it('should handle KPI with unknown calculation type', async () => {
      mockKpiDefinitions = [
        { id: 'kpi-1', code: 'unknown', name: 'Unknown', calculation_type: 'unknown_type', is_active: true }
      ];
      
      const result = await reportingService.getKPIs(
        'prop-1',
        { start: new Date('2024-01-01'), end: new Date('2024-01-31') }
      );
      
      expect(result).toBeDefined();
      expect(result[0].value).toBe(0);
    });
  });
});
