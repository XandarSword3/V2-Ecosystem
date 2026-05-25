/**
 * Maintenance Service Tests
 *
 * Unit tests using Vitest mocks for MaintenanceService with chainable Supabase query pattern.
 */

import { createMaintenanceService, MaintenanceServiceError } from '../../../../src/lib/services/maintenance.service';
import type {
  Container,
  MaintenanceRepository,
  WorkOrder,
  WorkOrderPart,
  LoggerService,
} from '../../../../src/lib/container/types';

// ============================================
// MOCK PATTERN HELPER
// ============================================

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
    then: (resolve: (value: unknown) => void) => resolve({ data: insertData, error: null })
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
  updateChain.then = (resolve: (value: unknown) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: unknown) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// ============================================
// TEST DATA
// ============================================

const LOCATION_1 = '11111111-1111-1111-1111-111111111111';
const LOCATION_2 = '22222222-2222-2222-2222-222222222222';
const REPORTER_1 = '33333333-3333-3333-3333-333333333333';
const TECHNICIAN_1 = '44444444-4444-4444-4444-444444444444';
const TECHNICIAN_2 = '55555555-5555-5555-5555-555555555555';
const WORK_ORDER_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WORK_ORDER_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PART_1 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  const now = new Date().toISOString();
  return {
    id: WORK_ORDER_1,
    title: 'Fix leaking faucet',
    description: 'Bathroom faucet is leaking',
    category: 'plumbing',
    priority: 'medium',
    status: 'open',
    locationId: LOCATION_1,
    locationType: 'room',
    reportedBy: REPORTER_1,
    assignedTo: null,
    scheduledDate: null,
    startedAt: null,
    completedAt: null,
    estimatedHours: 2,
    actualHours: null,
    laborCost: null,
    partsCost: null,
    notes: null,
    createdAt: now,
    updatedAt: null,
    ...overrides,
  };
}

function createMockPart(overrides: Partial<WorkOrderPart> = {}): WorkOrderPart {
  return {
    id: PART_1,
    workOrderId: WORK_ORDER_1,
    partName: 'Faucet washer',
    partNumber: 'FW-001',
    quantity: 2,
    unitCost: 5.00,
    totalCost: 10.00,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// MOCK FACTORY
// ============================================

function createMockRepository(): any {
  const mockRepo: any = {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
    getByLocation: vi.fn(),
    getByAssignee: vi.fn(),
    addPart: vi.fn(),
    getParts: vi.fn(),
    deletePart: vi.fn(),

    // Map new methods to mocked functions
    save: vi.fn().mockImplementation(async (order) => {
      if (order.updatedAt === null) {
        return mockRepo.create(order);
      } else {
        const originalPromise = mockRepo.getById(order.id);
        const original = originalPromise && typeof originalPromise.then === 'function'
          ? await originalPromise
          : originalPromise;

        const diff: any = {};
        if (original) {
          for (const key of Object.keys(order)) {
            if (key === 'updatedAt') continue;
            if (JSON.stringify(order[key]) !== JSON.stringify(original[key])) {
              diff[key] = order[key];
            }
          }
          if (order.status === 'in_progress' && order.startedAt !== null) {
            diff.startedAt = order.startedAt;
          }
        } else {
          Object.assign(diff, order);
          delete diff.updatedAt;
        }
        return mockRepo.update(order.id, diff);
      }
    }),
    findById: vi.fn().mockImplementation((id) => {
      return mockRepo.getById(id);
    }),
    findAll: vi.fn().mockImplementation((filters) => {
      return mockRepo.list(filters);
    }),
    savePart: vi.fn().mockImplementation((part) => {
      const cleanPart = { ...part };
      delete cleanPart.id;
      if (cleanPart.supplier === null) delete cleanPart.supplier;
      if (cleanPart.notes === null) delete cleanPart.notes;
      return mockRepo.addPart(cleanPart);
    }),
    findParts: vi.fn().mockImplementation((workOrderId) => {
      return mockRepo.getParts(workOrderId);
    }),
  };
  return mockRepo;
}

function createMockLogger(): LoggerService {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function createMockContainer(repository: MaintenanceRepository): Container {
  return {
    maintenanceRepository: repository,
    logger: createMockLogger(),
  } as unknown as Container;
}

// ============================================
// TESTS
// ============================================

describe('MaintenanceService', () => {
  let mockRepository: MaintenanceRepository;
  let container: Container;
  let service: ReturnType<typeof createMaintenanceService>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    container = createMockContainer(mockRepository);
    service = createMaintenanceService(container);
  });

  // ============================================
  // CREATE WORK ORDER
  // ============================================

  describe('createWorkOrder', () => {
    it('should create a work order with required fields', async () => {
      const mockOrder = createMockWorkOrder();
      vi.mocked(mockRepository.create).mockResolvedValue(mockOrder);

      const result = await service.createWorkOrder({
        title: 'Fix leaking faucet',
        description: 'Bathroom faucet is leaking',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      expect(result).toEqual(mockOrder);
      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Fix leaking faucet',
        description: 'Bathroom faucet is leaking',
        category: 'plumbing',
        priority: 'medium',
        status: 'open',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
        assignedTo: null,
      }));
    });

    it('should create work order with optional fields', async () => {
      const mockOrder = createMockWorkOrder({
        scheduledDate: '2024-08-01',
        estimatedHours: 4,
        notes: 'Urgent repair needed',
      });
      vi.mocked(mockRepository.create).mockResolvedValue(mockOrder);

      const result = await service.createWorkOrder({
        title: 'AC repair',
        description: 'AC not cooling',
        category: 'hvac',
        priority: 'high',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
        scheduledDate: '2024-08-01',
        estimatedHours: 4,
        notes: 'Urgent repair needed',
      });

      expect(result.scheduledDate).toBe('2024-08-01');
      expect(result.estimatedHours).toBe(4);
      expect(result.notes).toBe('Urgent repair needed');
    });

    it('should reject title less than 3 characters', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fi',
          description: 'Description',
          category: 'plumbing',
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({ code: 'INVALID_TITLE' });
    });

    it('should reject empty description', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: '',
          category: 'plumbing',
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({ code: 'INVALID_DESCRIPTION' });
    });

    it('should reject invalid category', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: 'Description',
          category: 'invalid' as any,
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({ code: 'INVALID_CATEGORY' });
    });

    it('should reject invalid priority', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: 'Description',
          category: 'plumbing',
          priority: 'urgent' as any,
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({ code: 'INVALID_PRIORITY' });
    });

    it('should reject invalid location ID', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: 'Description',
          category: 'plumbing',
          priority: 'medium',
          locationId: INVALID_UUID,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({ code: 'INVALID_LOCATION_ID' });
    });

    it('should reject invalid reporter ID', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: 'Description',
          category: 'plumbing',
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: INVALID_UUID,
        })
      ).rejects.toMatchObject({ code: 'INVALID_REPORTER_ID' });
    });

    it('should reject empty location type', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: 'Description',
          category: 'plumbing',
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: '',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({ code: 'INVALID_LOCATION_TYPE' });
    });

    it('should reject negative estimated hours', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: 'Description',
          category: 'plumbing',
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
          estimatedHours: -1,
        })
      ).rejects.toMatchObject({ code: 'INVALID_HOURS' });
    });

    it('should trim whitespace from title and description', async () => {
      const mockOrder = createMockWorkOrder({ title: 'Fix faucet', description: 'Leaking' });
      vi.mocked(mockRepository.create).mockResolvedValue(mockOrder);

      await service.createWorkOrder({
        title: '  Fix faucet  ',
        description: '  Leaking  ',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Fix faucet',
        description: 'Leaking',
      }));
    });
  });

  // ============================================
  // GET WORK ORDER
  // ============================================

  describe('getWorkOrder', () => {
    it('should return work order by ID', async () => {
      const mockOrder = createMockWorkOrder();
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);

      const result = await service.getWorkOrder(WORK_ORDER_1);

      expect(result).toEqual(mockOrder);
      expect(mockRepository.getById).toHaveBeenCalledWith(WORK_ORDER_1);
    });

    it('should return null for non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      const result = await service.getWorkOrder(WORK_ORDER_1);

      expect(result).toBeNull();
    });

    it('should reject invalid UUID', async () => {
      await expect(service.getWorkOrder(INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });
  });

  // ============================================
  // UPDATE WORK ORDER
  // ============================================

  describe('updateWorkOrder', () => {
    it('should update work order fields', async () => {
      const existingOrder = createMockWorkOrder();
      const updatedOrder = createMockWorkOrder({ title: 'Updated title', priority: 'high' });
      vi.mocked(mockRepository.getById).mockResolvedValue(existingOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(updatedOrder);

      const result = await service.updateWorkOrder(WORK_ORDER_1, {
        title: 'Updated title',
        priority: 'high',
      });

      expect(result.title).toBe('Updated title');
      expect(result.priority).toBe('high');
    });

    it('should update scheduled date', async () => {
      const existingOrder = createMockWorkOrder();
      const updatedOrder = createMockWorkOrder({ scheduledDate: '2024-09-01' });
      vi.mocked(mockRepository.getById).mockResolvedValue(existingOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(updatedOrder);

      const result = await service.updateWorkOrder(WORK_ORDER_1, {
        scheduledDate: '2024-09-01',
      });

      expect(result.scheduledDate).toBe('2024-09-01');
    });

    it('should reject update for non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(
        service.updateWorkOrder(WORK_ORDER_1, { title: 'New title' })
      ).rejects.toMatchObject({ code: 'WORK_ORDER_NOT_FOUND' });
    });

    it('should reject update for completed work order', async () => {
      const completedOrder = createMockWorkOrder({ status: 'completed' });
      vi.mocked(mockRepository.getById).mockResolvedValue(completedOrder);

      await expect(
        service.updateWorkOrder(WORK_ORDER_1, { title: 'New title' })
      ).rejects.toMatchObject({ code: 'WORK_ORDER_FINALIZED' });
    });

    it('should reject update for cancelled work order', async () => {
      const cancelledOrder = createMockWorkOrder({ status: 'cancelled' });
      vi.mocked(mockRepository.getById).mockResolvedValue(cancelledOrder);

      await expect(
        service.updateWorkOrder(WORK_ORDER_1, { title: 'New title' })
      ).rejects.toMatchObject({ code: 'WORK_ORDER_FINALIZED' });
    });

    it('should reject invalid title on update', async () => {
      const existingOrder = createMockWorkOrder();
      vi.mocked(mockRepository.getById).mockResolvedValue(existingOrder);

      await expect(
        service.updateWorkOrder(WORK_ORDER_1, { title: 'ab' })
      ).rejects.toMatchObject({ code: 'INVALID_TITLE' });
    });

    it('should reject invalid priority on update', async () => {
      const existingOrder = createMockWorkOrder();
      vi.mocked(mockRepository.getById).mockResolvedValue(existingOrder);

      await expect(
        service.updateWorkOrder(WORK_ORDER_1, { priority: 'urgent' as any })
      ).rejects.toMatchObject({ code: 'INVALID_PRIORITY' });
    });

    it('should reject invalid UUID', async () => {
      await expect(service.updateWorkOrder(INVALID_UUID, { title: 'Test' }))
        .rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });
  });

  // ============================================
  // DELETE WORK ORDER
  // ============================================

  describe('deleteWorkOrder', () => {
    it('should delete existing work order', async () => {
      const existingOrder = createMockWorkOrder();
      vi.mocked(mockRepository.getById).mockResolvedValue(existingOrder);
      vi.mocked(mockRepository.delete).mockResolvedValue(undefined);

      await expect(service.deleteWorkOrder(WORK_ORDER_1)).resolves.toBeUndefined();
      expect(mockRepository.delete).toHaveBeenCalledWith(WORK_ORDER_1);
    });

    it('should reject deletion of non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.deleteWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'WORK_ORDER_NOT_FOUND' });
    });

    it('should reject invalid UUID', async () => {
      await expect(service.deleteWorkOrder(INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });
  });

  // ============================================
  // LIST WORK ORDERS
  // ============================================

  describe('listWorkOrders', () => {
    it('should list all work orders without filters', async () => {
      const orders = [createMockWorkOrder(), createMockWorkOrder({ id: WORK_ORDER_2 })];
      vi.mocked(mockRepository.list).mockResolvedValue(orders);

      const result = await service.listWorkOrders();

      expect(result).toHaveLength(2);
      expect(mockRepository.list).toHaveBeenCalledWith(undefined);
    });

    it('should list work orders with status filter', async () => {
      const orders = [createMockWorkOrder({ status: 'open' })];
      vi.mocked(mockRepository.list).mockResolvedValue(orders);

      const result = await service.listWorkOrders({ status: 'open' });

      expect(result).toHaveLength(1);
      expect(mockRepository.list).toHaveBeenCalledWith({ status: 'open' });
    });

    it('should list work orders with priority filter', async () => {
      const orders = [createMockWorkOrder({ priority: 'critical' })];
      vi.mocked(mockRepository.list).mockResolvedValue(orders);

      const result = await service.listWorkOrders({ priority: 'critical' });

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no work orders match', async () => {
      vi.mocked(mockRepository.list).mockResolvedValue([]);

      const result = await service.listWorkOrders({ status: 'completed' });

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // ASSIGN WORK ORDER
  // ============================================

  describe('assignWorkOrder', () => {
    it('should assign open work order to technician', async () => {
      const openOrder = createMockWorkOrder({ status: 'open' });
      const assignedOrder = createMockWorkOrder({ status: 'assigned', assignedTo: TECHNICIAN_1 });
      vi.mocked(mockRepository.getById).mockResolvedValue(openOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(assignedOrder);

      const result = await service.assignWorkOrder(WORK_ORDER_1, TECHNICIAN_1);

      expect(result.status).toBe('assigned');
      expect(result.assignedTo).toBe(TECHNICIAN_1);
      expect(mockRepository.update).toHaveBeenCalledWith(WORK_ORDER_1, {
        assignedTo: TECHNICIAN_1,
        status: 'assigned',
      });
    });

    it('should reassign already assigned work order', async () => {
      const assignedOrder = createMockWorkOrder({ status: 'assigned', assignedTo: TECHNICIAN_1 });
      const reassignedOrder = createMockWorkOrder({ status: 'assigned', assignedTo: TECHNICIAN_2 });
      vi.mocked(mockRepository.getById).mockResolvedValue(assignedOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(reassignedOrder);

      const result = await service.assignWorkOrder(WORK_ORDER_1, TECHNICIAN_2);

      expect(result.assignedTo).toBe(TECHNICIAN_2);
    });

    it('should reject assignment of non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.assignWorkOrder(WORK_ORDER_1, TECHNICIAN_1))
        .rejects.toMatchObject({ code: 'WORK_ORDER_NOT_FOUND' });
    });

    it('should reject assignment of in-progress work order', async () => {
      const inProgressOrder = createMockWorkOrder({ status: 'in_progress' });
      vi.mocked(mockRepository.getById).mockResolvedValue(inProgressOrder);

      await expect(service.assignWorkOrder(WORK_ORDER_1, TECHNICIAN_1))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject assignment of completed work order', async () => {
      const completedOrder = createMockWorkOrder({ status: 'completed' });
      vi.mocked(mockRepository.getById).mockResolvedValue(completedOrder);

      await expect(service.assignWorkOrder(WORK_ORDER_1, TECHNICIAN_1))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject invalid work order UUID', async () => {
      await expect(service.assignWorkOrder(INVALID_UUID, TECHNICIAN_1))
        .rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });

    it('should reject invalid assignee UUID', async () => {
      await expect(service.assignWorkOrder(WORK_ORDER_1, INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_ASSIGNEE_ID' });
    });
  });

  // ============================================
  // UNASSIGN WORK ORDER
  // ============================================

  describe('unassignWorkOrder', () => {
    it('should unassign assigned work order', async () => {
      const assignedOrder = createMockWorkOrder({ status: 'assigned', assignedTo: TECHNICIAN_1 });
      const unassignedOrder = createMockWorkOrder({ status: 'open', assignedTo: null });
      vi.mocked(mockRepository.getById).mockResolvedValue(assignedOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(unassignedOrder);

      const result = await service.unassignWorkOrder(WORK_ORDER_1);

      expect(result.status).toBe('open');
      expect(result.assignedTo).toBeNull();
    });

    it('should reject unassigning non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.unassignWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'WORK_ORDER_NOT_FOUND' });
    });

    it('should reject unassigning open work order', async () => {
      const openOrder = createMockWorkOrder({ status: 'open' });
      vi.mocked(mockRepository.getById).mockResolvedValue(openOrder);

      await expect(service.unassignWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject unassigning in-progress work order', async () => {
      const inProgressOrder = createMockWorkOrder({ status: 'in_progress' });
      vi.mocked(mockRepository.getById).mockResolvedValue(inProgressOrder);

      await expect(service.unassignWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject invalid UUID', async () => {
      await expect(service.unassignWorkOrder(INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });
  });

  // ============================================
  // START WORK ORDER
  // ============================================

  describe('startWorkOrder', () => {
    it('should start assigned work order', async () => {
      const assignedOrder = createMockWorkOrder({ status: 'assigned', assignedTo: TECHNICIAN_1 });
      const startedOrder = createMockWorkOrder({ 
        status: 'in_progress', 
        assignedTo: TECHNICIAN_1, 
        startedAt: new Date().toISOString() 
      });
      vi.mocked(mockRepository.getById).mockResolvedValue(assignedOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(startedOrder);

      const result = await service.startWorkOrder(WORK_ORDER_1);

      expect(result.status).toBe('in_progress');
      expect(result.startedAt).not.toBeNull();
    });

    it('should start pending_parts work order', async () => {
      const pendingOrder = createMockWorkOrder({ status: 'pending_parts', assignedTo: TECHNICIAN_1 });
      const startedOrder = createMockWorkOrder({ status: 'in_progress', startedAt: '2024-01-01T10:00:00Z' });
      vi.mocked(mockRepository.getById).mockResolvedValue(pendingOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(startedOrder);

      const result = await service.startWorkOrder(WORK_ORDER_1);

      expect(result.status).toBe('in_progress');
    });

    it('should preserve existing startedAt when restarting', async () => {
      const previousStart = '2024-01-01T08:00:00Z';
      const pendingOrder = createMockWorkOrder({ 
        status: 'pending_parts', 
        startedAt: previousStart 
      });
      vi.mocked(mockRepository.getById).mockResolvedValue(pendingOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(
        createMockWorkOrder({ status: 'in_progress', startedAt: previousStart })
      );

      await service.startWorkOrder(WORK_ORDER_1);

      expect(mockRepository.update).toHaveBeenCalledWith(WORK_ORDER_1, expect.objectContaining({
        startedAt: previousStart,
      }));
    });

    it('should reject starting non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.startWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'WORK_ORDER_NOT_FOUND' });
    });

    it('should reject starting open work order', async () => {
      const openOrder = createMockWorkOrder({ status: 'open' });
      vi.mocked(mockRepository.getById).mockResolvedValue(openOrder);

      await expect(service.startWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject starting completed work order', async () => {
      const completedOrder = createMockWorkOrder({ status: 'completed' });
      vi.mocked(mockRepository.getById).mockResolvedValue(completedOrder);

      await expect(service.startWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject invalid UUID', async () => {
      await expect(service.startWorkOrder(INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });
  });

  // ============================================
  // SET PENDING PARTS
  // ============================================

  describe('setPendingParts', () => {
    it('should set in-progress order to pending_parts', async () => {
      const inProgressOrder = createMockWorkOrder({ status: 'in_progress' });
      const pendingOrder = createMockWorkOrder({ status: 'pending_parts' });
      vi.mocked(mockRepository.getById).mockResolvedValue(inProgressOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(pendingOrder);

      const result = await service.setPendingParts(WORK_ORDER_1);

      expect(result.status).toBe('pending_parts');
    });

    it('should set assigned order to pending_parts', async () => {
      const assignedOrder = createMockWorkOrder({ status: 'assigned' });
      const pendingOrder = createMockWorkOrder({ status: 'pending_parts' });
      vi.mocked(mockRepository.getById).mockResolvedValue(assignedOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(pendingOrder);

      const result = await service.setPendingParts(WORK_ORDER_1);

      expect(result.status).toBe('pending_parts');
    });

    it('should reject for non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.setPendingParts(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'WORK_ORDER_NOT_FOUND' });
    });

    it('should reject for open work order', async () => {
      const openOrder = createMockWorkOrder({ status: 'open' });
      vi.mocked(mockRepository.getById).mockResolvedValue(openOrder);

      await expect(service.setPendingParts(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject for completed work order', async () => {
      const completedOrder = createMockWorkOrder({ status: 'completed' });
      vi.mocked(mockRepository.getById).mockResolvedValue(completedOrder);

      await expect(service.setPendingParts(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject invalid UUID', async () => {
      await expect(service.setPendingParts(INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });
  });

  // ============================================
  // COMPLETE WORK ORDER
  // ============================================

  describe('completeWorkOrder', () => {
    it('should complete in-progress work order', async () => {
      const inProgressOrder = createMockWorkOrder({ status: 'in_progress' });
      const completedOrder = createMockWorkOrder({
        status: 'completed',
        actualHours: 3,
        laborCost: 150,
        partsCost: 25,
        completedAt: new Date().toISOString(),
      });
      vi.mocked(mockRepository.getById).mockResolvedValue(inProgressOrder);
      vi.mocked(mockRepository.getParts).mockResolvedValue([
        createMockPart({ totalCost: 15 }),
        createMockPart({ id: 'part-2', totalCost: 10 }),
      ]);
      vi.mocked(mockRepository.update).mockResolvedValue(completedOrder);

      const result = await service.completeWorkOrder(WORK_ORDER_1, {
        actualHours: 3,
        laborCost: 150,
      });

      expect(result.status).toBe('completed');
      expect(result.actualHours).toBe(3);
      expect(result.laborCost).toBe(150);
      expect(result.partsCost).toBe(25);
    });

    it('should append completion notes', async () => {
      const inProgressOrder = createMockWorkOrder({ status: 'in_progress', notes: 'Original note' });
      vi.mocked(mockRepository.getById).mockResolvedValue(inProgressOrder);
      vi.mocked(mockRepository.getParts).mockResolvedValue([]);
      vi.mocked(mockRepository.update).mockResolvedValue(createMockWorkOrder({ status: 'completed' }));

      await service.completeWorkOrder(WORK_ORDER_1, {
        actualHours: 2,
        notes: 'Completion note',
      });

      expect(mockRepository.update).toHaveBeenCalledWith(WORK_ORDER_1, expect.objectContaining({
        notes: 'Original note\nCompletion note',
      }));
    });

    it('should calculate parts cost from all parts', async () => {
      const inProgressOrder = createMockWorkOrder({ status: 'in_progress' });
      vi.mocked(mockRepository.getById).mockResolvedValue(inProgressOrder);
      vi.mocked(mockRepository.getParts).mockResolvedValue([
        createMockPart({ totalCost: 50 }),
        createMockPart({ totalCost: 30 }),
        createMockPart({ totalCost: 20 }),
      ]);
      vi.mocked(mockRepository.update).mockResolvedValue(createMockWorkOrder({ status: 'completed', partsCost: 100 }));

      await service.completeWorkOrder(WORK_ORDER_1, { actualHours: 5 });

      expect(mockRepository.update).toHaveBeenCalledWith(WORK_ORDER_1, expect.objectContaining({
        partsCost: 100,
      }));
    });

    it('should reject completion of non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.completeWorkOrder(WORK_ORDER_1, { actualHours: 2 }))
        .rejects.toMatchObject({ code: 'WORK_ORDER_NOT_FOUND' });
    });

    it('should reject completion of open work order', async () => {
      const openOrder = createMockWorkOrder({ status: 'open' });
      vi.mocked(mockRepository.getById).mockResolvedValue(openOrder);

      await expect(service.completeWorkOrder(WORK_ORDER_1, { actualHours: 2 }))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject completion of assigned work order', async () => {
      const assignedOrder = createMockWorkOrder({ status: 'assigned' });
      vi.mocked(mockRepository.getById).mockResolvedValue(assignedOrder);

      await expect(service.completeWorkOrder(WORK_ORDER_1, { actualHours: 2 }))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject negative actual hours', async () => {
      await expect(service.completeWorkOrder(WORK_ORDER_1, { actualHours: -1 }))
        .rejects.toMatchObject({ code: 'INVALID_HOURS' });
    });

    it('should reject invalid UUID', async () => {
      await expect(service.completeWorkOrder(INVALID_UUID, { actualHours: 2 }))
        .rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });
  });

  // ============================================
  // CANCEL WORK ORDER
  // ============================================

  describe('cancelWorkOrder', () => {
    it('should cancel open work order', async () => {
      const openOrder = createMockWorkOrder({ status: 'open' });
      const cancelledOrder = createMockWorkOrder({ status: 'cancelled' });
      vi.mocked(mockRepository.getById).mockResolvedValue(openOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(cancelledOrder);

      const result = await service.cancelWorkOrder(WORK_ORDER_1);

      expect(result.status).toBe('cancelled');
    });

    it('should cancel with reason', async () => {
      const openOrder = createMockWorkOrder({ status: 'open', notes: null });
      vi.mocked(mockRepository.getById).mockResolvedValue(openOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(createMockWorkOrder({ status: 'cancelled' }));

      await service.cancelWorkOrder(WORK_ORDER_1, 'No longer needed');

      expect(mockRepository.update).toHaveBeenCalledWith(WORK_ORDER_1, expect.objectContaining({
        notes: 'Cancellation: No longer needed',
      }));
    });

    it('should append cancellation reason to existing notes', async () => {
      const orderWithNotes = createMockWorkOrder({ status: 'open', notes: 'Existing notes' });
      vi.mocked(mockRepository.getById).mockResolvedValue(orderWithNotes);
      vi.mocked(mockRepository.update).mockResolvedValue(createMockWorkOrder({ status: 'cancelled' }));

      await service.cancelWorkOrder(WORK_ORDER_1, 'Customer request');

      expect(mockRepository.update).toHaveBeenCalledWith(WORK_ORDER_1, expect.objectContaining({
        notes: 'Existing notes\n\nCancellation: Customer request',
      }));
    });

    it('should cancel in-progress work order', async () => {
      const inProgressOrder = createMockWorkOrder({ status: 'in_progress' });
      const cancelledOrder = createMockWorkOrder({ status: 'cancelled' });
      vi.mocked(mockRepository.getById).mockResolvedValue(inProgressOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(cancelledOrder);

      const result = await service.cancelWorkOrder(WORK_ORDER_1);

      expect(result.status).toBe('cancelled');
    });

    it('should reject cancellation of non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.cancelWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'WORK_ORDER_NOT_FOUND' });
    });

    it('should reject cancellation of already cancelled work order', async () => {
      const cancelledOrder = createMockWorkOrder({ status: 'cancelled' });
      vi.mocked(mockRepository.getById).mockResolvedValue(cancelledOrder);

      await expect(service.cancelWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'ALREADY_CANCELLED' });
    });

    it('should reject cancellation of completed work order', async () => {
      const completedOrder = createMockWorkOrder({ status: 'completed' });
      vi.mocked(mockRepository.getById).mockResolvedValue(completedOrder);

      await expect(service.cancelWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'WORK_ORDER_COMPLETED' });
    });

    it('should reject invalid UUID', async () => {
      await expect(service.cancelWorkOrder(INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });
  });

  // ============================================
  // REOPEN WORK ORDER
  // ============================================

  describe('reopenWorkOrder', () => {
    it('should reopen cancelled work order', async () => {
      const cancelledOrder = createMockWorkOrder({ status: 'cancelled', assignedTo: TECHNICIAN_1 });
      const reopenedOrder = createMockWorkOrder({ status: 'open', assignedTo: null });
      vi.mocked(mockRepository.getById).mockResolvedValue(cancelledOrder);
      vi.mocked(mockRepository.update).mockResolvedValue(reopenedOrder);

      const result = await service.reopenWorkOrder(WORK_ORDER_1);

      expect(result.status).toBe('open');
      expect(result.assignedTo).toBeNull();
    });

    it('should reject reopening non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.reopenWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'WORK_ORDER_NOT_FOUND' });
    });

    it('should reject reopening open work order', async () => {
      const openOrder = createMockWorkOrder({ status: 'open' });
      vi.mocked(mockRepository.getById).mockResolvedValue(openOrder);

      await expect(service.reopenWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject reopening completed work order', async () => {
      const completedOrder = createMockWorkOrder({ status: 'completed' });
      vi.mocked(mockRepository.getById).mockResolvedValue(completedOrder);

      await expect(service.reopenWorkOrder(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject invalid UUID', async () => {
      await expect(service.reopenWorkOrder(INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });
  });

  // ============================================
  // ADD PART
  // ============================================

  describe('addPart', () => {
    it('should add part to work order', async () => {
      const mockOrder = createMockWorkOrder();
      const mockPart = createMockPart();
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);
      vi.mocked(mockRepository.addPart).mockResolvedValue(mockPart);

      const result = await service.addPart({
        workOrderId: WORK_ORDER_1,
        partName: 'Faucet washer',
        partNumber: 'FW-001',
        quantity: 2,
        unitCost: 5.00,
      });

      expect(result).toEqual(mockPart);
      expect(mockRepository.addPart).toHaveBeenCalledWith({
        workOrderId: WORK_ORDER_1,
        partName: 'Faucet washer',
        partNumber: 'FW-001',
        quantity: 2,
        unitCost: 5.00,
        totalCost: 10.00,
      });
    });

    it('should add part without part number', async () => {
      const mockOrder = createMockWorkOrder();
      const mockPart = createMockPart({ partNumber: null });
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);
      vi.mocked(mockRepository.addPart).mockResolvedValue(mockPart);

      const result = await service.addPart({
        workOrderId: WORK_ORDER_1,
        partName: 'Generic part',
        quantity: 1,
        unitCost: 10.00,
      });

      expect(result.partNumber).toBeNull();
    });

    it('should calculate total cost correctly', async () => {
      const mockOrder = createMockWorkOrder();
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);
      vi.mocked(mockRepository.addPart).mockResolvedValue(createMockPart({ totalCost: 75 }));

      await service.addPart({
        workOrderId: WORK_ORDER_1,
        partName: 'Expensive part',
        quantity: 5,
        unitCost: 15.00,
      });

      expect(mockRepository.addPart).toHaveBeenCalledWith(expect.objectContaining({
        totalCost: 75,
      }));
    });

    it('should reject for non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.addPart({
        workOrderId: WORK_ORDER_1,
        partName: 'Part',
        quantity: 1,
        unitCost: 10,
      })).rejects.toMatchObject({ code: 'WORK_ORDER_NOT_FOUND' });
    });

    it('should reject empty part name', async () => {
      const mockOrder = createMockWorkOrder();
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);

      await expect(service.addPart({
        workOrderId: WORK_ORDER_1,
        partName: '',
        quantity: 1,
        unitCost: 10,
      })).rejects.toMatchObject({ code: 'INVALID_PART_NAME' });
    });

    it('should reject zero quantity', async () => {
      const mockOrder = createMockWorkOrder();
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);

      await expect(service.addPart({
        workOrderId: WORK_ORDER_1,
        partName: 'Part',
        quantity: 0,
        unitCost: 10,
      })).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
    });

    it('should reject negative quantity', async () => {
      const mockOrder = createMockWorkOrder();
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);

      await expect(service.addPart({
        workOrderId: WORK_ORDER_1,
        partName: 'Part',
        quantity: -1,
        unitCost: 10,
      })).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
    });

    it('should reject non-integer quantity', async () => {
      const mockOrder = createMockWorkOrder();
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);

      await expect(service.addPart({
        workOrderId: WORK_ORDER_1,
        partName: 'Part',
        quantity: 1.5,
        unitCost: 10,
      })).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
    });

    it('should reject negative unit cost', async () => {
      const mockOrder = createMockWorkOrder();
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);

      await expect(service.addPart({
        workOrderId: WORK_ORDER_1,
        partName: 'Part',
        quantity: 1,
        unitCost: -5,
      })).rejects.toMatchObject({ code: 'INVALID_UNIT_COST' });
    });

    it('should reject invalid work order UUID', async () => {
      await expect(service.addPart({
        workOrderId: INVALID_UUID,
        partName: 'Part',
        quantity: 1,
        unitCost: 10,
      })).rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });
  });

  // ============================================
  // GET PARTS
  // ============================================

  describe('getParts', () => {
    it('should return parts for work order', async () => {
      const mockOrder = createMockWorkOrder();
      const parts = [
        createMockPart(),
        createMockPart({ id: 'part-2', partName: 'Pipe fitting' }),
      ];
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);
      vi.mocked(mockRepository.getParts).mockResolvedValue(parts);

      const result = await service.getParts(WORK_ORDER_1);

      expect(result).toHaveLength(2);
      expect(mockRepository.getParts).toHaveBeenCalledWith(WORK_ORDER_1);
    });

    it('should return empty array when no parts', async () => {
      const mockOrder = createMockWorkOrder();
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);
      vi.mocked(mockRepository.getParts).mockResolvedValue([]);

      const result = await service.getParts(WORK_ORDER_1);

      expect(result).toEqual([]);
    });

    it('should reject for non-existent work order', async () => {
      vi.mocked(mockRepository.getById).mockResolvedValue(null);

      await expect(service.getParts(WORK_ORDER_1))
        .rejects.toMatchObject({ code: 'WORK_ORDER_NOT_FOUND' });
    });

    it('should reject invalid UUID', async () => {
      await expect(service.getParts(INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_WORK_ORDER_ID' });
    });
  });

  // ============================================
  // REMOVE PART
  // ============================================

  describe('removePart', () => {
    it('should remove part by ID', async () => {
      vi.mocked(mockRepository.deletePart).mockResolvedValue(undefined);

      await expect(service.removePart(PART_1)).resolves.toBeUndefined();
      expect(mockRepository.deletePart).toHaveBeenCalledWith(PART_1);
    });

    it('should reject invalid part UUID', async () => {
      await expect(service.removePart(INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_PART_ID' });
    });
  });

  // ============================================
  // GET BY LOCATION
  // ============================================

  describe('getByLocation', () => {
    it('should return work orders for location', async () => {
      const orders = [
        createMockWorkOrder({ locationId: LOCATION_1 }),
        createMockWorkOrder({ id: WORK_ORDER_2, locationId: LOCATION_1 }),
      ];
      vi.mocked(mockRepository.getByLocation).mockResolvedValue(orders);

      const result = await service.getByLocation(LOCATION_1);

      expect(result).toHaveLength(2);
      expect(mockRepository.getByLocation).toHaveBeenCalledWith(LOCATION_1);
    });

    it('should return empty array for location with no work orders', async () => {
      vi.mocked(mockRepository.getByLocation).mockResolvedValue([]);

      const result = await service.getByLocation(LOCATION_2);

      expect(result).toEqual([]);
    });

    it('should reject invalid location UUID', async () => {
      await expect(service.getByLocation(INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_LOCATION_ID' });
    });
  });

  // ============================================
  // GET BY ASSIGNEE
  // ============================================

  describe('getByAssignee', () => {
    it('should return work orders for assignee', async () => {
      const orders = [
        createMockWorkOrder({ assignedTo: TECHNICIAN_1 }),
        createMockWorkOrder({ id: WORK_ORDER_2, assignedTo: TECHNICIAN_1 }),
      ];
      vi.mocked(mockRepository.getByAssignee).mockResolvedValue(orders);

      const result = await service.getByAssignee(TECHNICIAN_1);

      expect(result).toHaveLength(2);
      expect(mockRepository.getByAssignee).toHaveBeenCalledWith(TECHNICIAN_1);
    });

    it('should return empty array for assignee with no work orders', async () => {
      vi.mocked(mockRepository.getByAssignee).mockResolvedValue([]);

      const result = await service.getByAssignee(TECHNICIAN_2);

      expect(result).toEqual([]);
    });

    it('should reject invalid assignee UUID', async () => {
      await expect(service.getByAssignee(INVALID_UUID))
        .rejects.toMatchObject({ code: 'INVALID_ASSIGNEE_ID' });
    });
  });

  // ============================================
  // GET OPEN WORK ORDERS
  // ============================================

  describe('getOpenWorkOrders', () => {
    it('should return non-finalized work orders', async () => {
      const allOrders = [
        createMockWorkOrder({ status: 'open' }),
        createMockWorkOrder({ id: 'wo-2', status: 'assigned' }),
        createMockWorkOrder({ id: 'wo-3', status: 'in_progress' }),
        createMockWorkOrder({ id: 'wo-4', status: 'pending_parts' }),
        createMockWorkOrder({ id: 'wo-5', status: 'completed' }),
        createMockWorkOrder({ id: 'wo-6', status: 'cancelled' }),
      ];
      vi.mocked(mockRepository.list).mockResolvedValue(allOrders);

      const result = await service.getOpenWorkOrders();

      expect(result).toHaveLength(4);
      expect(result.every(o => !['completed', 'cancelled'].includes(o.status))).toBe(true);
    });

    it('should return empty array when all work orders are finalized', async () => {
      const allOrders = [
        createMockWorkOrder({ status: 'completed' }),
        createMockWorkOrder({ id: 'wo-2', status: 'cancelled' }),
      ];
      vi.mocked(mockRepository.list).mockResolvedValue(allOrders);

      const result = await service.getOpenWorkOrders();

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // GET CRITICAL WORK ORDERS
  // ============================================

  describe('getCriticalWorkOrders', () => {
    it('should return non-finalized critical work orders', async () => {
      const criticalOrders = [
        createMockWorkOrder({ priority: 'critical', status: 'open' }),
        createMockWorkOrder({ id: 'wo-2', priority: 'critical', status: 'in_progress' }),
        createMockWorkOrder({ id: 'wo-3', priority: 'critical', status: 'completed' }),
      ];
      vi.mocked(mockRepository.list).mockResolvedValue(criticalOrders);

      const result = await service.getCriticalWorkOrders();

      expect(result).toHaveLength(2);
      expect(result.every(o => o.priority === 'critical')).toBe(true);
      expect(result.every(o => !['completed', 'cancelled'].includes(o.status))).toBe(true);
    });

    it('should call repository with critical filter', async () => {
      vi.mocked(mockRepository.list).mockResolvedValue([]);

      await service.getCriticalWorkOrders();

      expect(mockRepository.list).toHaveBeenCalledWith({ priority: 'critical' });
    });

    it('should return empty array when no critical work orders exist', async () => {
      vi.mocked(mockRepository.list).mockResolvedValue([]);

      const result = await service.getCriticalWorkOrders();

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // GET STATS
  // ============================================

  describe('getStats', () => {
    it('should calculate comprehensive statistics', async () => {
      const orders = [
        createMockWorkOrder({ status: 'open', priority: 'low', category: 'plumbing' }),
        createMockWorkOrder({ id: 'wo-2', status: 'assigned', priority: 'medium', category: 'electrical' }),
        createMockWorkOrder({ id: 'wo-3', status: 'in_progress', priority: 'high', category: 'hvac' }),
        createMockWorkOrder({ id: 'wo-4', status: 'completed', priority: 'critical', category: 'structural', actualHours: 4, laborCost: 200, partsCost: 50 }),
        createMockWorkOrder({ id: 'wo-5', status: 'completed', priority: 'medium', category: 'appliance', actualHours: 2, laborCost: 100, partsCost: 30 }),
        createMockWorkOrder({ id: 'wo-6', status: 'cancelled', priority: 'low', category: 'general' }),
      ];
      vi.mocked(mockRepository.list).mockResolvedValue(orders);

      const result = await service.getStats();

      expect(result.totalWorkOrders).toBe(6);
      expect(result.byStatus.open).toBe(1);
      expect(result.byStatus.assigned).toBe(1);
      expect(result.byStatus.in_progress).toBe(1);
      expect(result.byStatus.completed).toBe(2);
      expect(result.byStatus.cancelled).toBe(1);
      expect(result.byPriority.low).toBe(2);
      expect(result.byPriority.medium).toBe(2);
      expect(result.byPriority.high).toBe(1);
      expect(result.byPriority.critical).toBe(1);
      expect(result.byCategory.plumbing).toBe(1);
      expect(result.byCategory.electrical).toBe(1);
      expect(result.avgCompletionHours).toBe(3); // (4 + 2) / 2
      expect(result.totalLaborCost).toBe(300);
      expect(result.totalPartsCost).toBe(80);
    });

    it('should return zero averages when no completed work orders', async () => {
      const orders = [
        createMockWorkOrder({ status: 'open' }),
        createMockWorkOrder({ id: 'wo-2', status: 'assigned' }),
      ];
      vi.mocked(mockRepository.list).mockResolvedValue(orders);

      const result = await service.getStats();

      expect(result.avgCompletionHours).toBe(0);
      expect(result.totalLaborCost).toBe(0);
      expect(result.totalPartsCost).toBe(0);
    });

    it('should handle empty work order list', async () => {
      vi.mocked(mockRepository.list).mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.totalWorkOrders).toBe(0);
      expect(result.avgCompletionHours).toBe(0);
      expect(result.totalLaborCost).toBe(0);
      expect(result.totalPartsCost).toBe(0);
    });
  });

  // ============================================
  // UTILITY METHODS
  // ============================================

  describe('getPriorities', () => {
    it('should return all priority values', () => {
      const priorities = service.getPriorities();

      expect(priorities).toEqual(['low', 'medium', 'high', 'critical']);
    });

    it('should return a new array each time', () => {
      const priorities1 = service.getPriorities();
      const priorities2 = service.getPriorities();

      expect(priorities1).not.toBe(priorities2);
      expect(priorities1).toEqual(priorities2);
    });
  });

  describe('getStatuses', () => {
    it('should return all status values', () => {
      const statuses = service.getStatuses();

      expect(statuses).toEqual(['open', 'assigned', 'in_progress', 'pending_parts', 'completed', 'cancelled']);
    });

    it('should return a new array each time', () => {
      const statuses1 = service.getStatuses();
      const statuses2 = service.getStatuses();

      expect(statuses1).not.toBe(statuses2);
      expect(statuses1).toEqual(statuses2);
    });
  });

  describe('getCategories', () => {
    it('should return all category values', () => {
      const categories = service.getCategories();

      expect(categories).toEqual(['plumbing','electrical','hvac','carpentry','painting','cleaning','landscaping','appliance','structural','safety','it','general']);
    });

    it('should return a new array each time', () => {
      const categories1 = service.getCategories();
      const categories2 = service.getCategories();

      expect(categories1).not.toBe(categories2);
      expect(categories1).toEqual(categories2);
    });
  });

  // ============================================
  // ERROR HANDLING
  // ============================================

  describe('MaintenanceServiceError', () => {
    it('should create error with correct properties', () => {
      const error = new MaintenanceServiceError('Test error', 'TEST_CODE', 404);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('MaintenanceServiceError');
    });

    it('should use default status code when not provided', () => {
      const error = new MaintenanceServiceError('Test error', 'TEST_CODE');

      expect(error.statusCode).toBe(400);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    it('should handle whitespace-only title', async () => {
      await expect(
        service.createWorkOrder({
          title: '   ',
          description: 'Description',
          category: 'plumbing',
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({ code: 'INVALID_TITLE' });
    });

    it('should handle whitespace-only description', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Valid title',
          description: '   ',
          category: 'plumbing',
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({ code: 'INVALID_DESCRIPTION' });
    });

    it('should accept zero estimated hours', async () => {
      const mockOrder = createMockWorkOrder({ estimatedHours: 0 });
      vi.mocked(mockRepository.create).mockResolvedValue(mockOrder);

      const result = await service.createWorkOrder({
        title: 'Quick fix',
        description: 'Minor repair',
        category: 'general',
        priority: 'low',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
        estimatedHours: 0,
      });

      expect(result.estimatedHours).toBe(0);
    });

    it('should accept zero unit cost for parts', async () => {
      const mockOrder = createMockWorkOrder();
      const mockPart = createMockPart({ unitCost: 0, totalCost: 0 });
      vi.mocked(mockRepository.getById).mockResolvedValue(mockOrder);
      vi.mocked(mockRepository.addPart).mockResolvedValue(mockPart);

      const result = await service.addPart({
        workOrderId: WORK_ORDER_1,
        partName: 'Free part',
        quantity: 1,
        unitCost: 0,
      });

      expect(result.unitCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('should accept zero actual hours on completion', async () => {
      const inProgressOrder = createMockWorkOrder({ status: 'in_progress' });
      const completedOrder = createMockWorkOrder({ status: 'completed', actualHours: 0 });
      vi.mocked(mockRepository.getById).mockResolvedValue(inProgressOrder);
      vi.mocked(mockRepository.getParts).mockResolvedValue([]);
      vi.mocked(mockRepository.update).mockResolvedValue(completedOrder);

      const result = await service.completeWorkOrder(WORK_ORDER_1, { actualHours: 0 });

      expect(result.actualHours).toBe(0);
    });
  });
});
