/**
 * Housekeeping Service Tests
 *
 * Unit tests using Vitest mocks for the HousekeepingService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHousekeepingService, HousekeepingServiceError } from '../../../../src/lib/services/housekeeping.service';
import type {
  Container,
  HousekeepingRepository,
  RoomCleaningTask,
  CleaningSupply,
  LoggerService,
} from '../../../../src/lib/container/types';

// ============================================
// TEST DATA
// ============================================

const ROOM_1 = '11111111-1111-1111-1111-111111111111';
const ROOM_2 = '22222222-2222-2222-2222-222222222222';
const TASK_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TASK_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const HOUSEKEEPER_1 = '33333333-3333-3333-3333-333333333333';
const INSPECTOR_1 = '44444444-4444-4444-4444-444444444444';
const SUPPLY_1 = '55555555-5555-5555-5555-555555555555';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockTask(overrides: Partial<RoomCleaningTask> = {}): RoomCleaningTask {
  return {
    id: TASK_1,
    roomId: ROOM_1,
    roomNumber: '101',
    floor: 1,
    assignedTo: null,
    status: 'dirty',
    priority: 'medium',
    checkoutDate: null,
    checkinDate: null,
    notes: null,
    startedAt: null,
    completedAt: null,
    inspectedBy: null,
    inspectedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    ...overrides,
  };
}

function createMockSupply(overrides: Partial<CleaningSupply> = {}): CleaningSupply {
  return {
    id: SUPPLY_1,
    name: 'Cleaning Solution',
    quantity: 50,
    minQuantity: 10,
    unit: 'liters',
    lastRestocked: null,
    ...overrides,
  };
}

// ============================================
// MOCK FACTORY
// ============================================

function createMockRepository(): HousekeepingRepository {
  return {
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    getTaskById: vi.fn(),
    getTaskByRoomId: vi.fn(),
    listTasks: vi.fn(),
    getTasksByAssignee: vi.fn(),
    getTasksByFloor: vi.fn(),
    createSupply: vi.fn(),
    updateSupply: vi.fn(),
    deleteSupply: vi.fn(),
    getSupplyById: vi.fn(),
    listSupplies: vi.fn(),
    getLowSupplies: vi.fn(),
  };
}

function createMockLogger(): LoggerService {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function createMockContainer(repository: HousekeepingRepository): Container {
  return {
    housekeepingRepository: repository,
    logger: createMockLogger(),
  } as unknown as Container;
}

// ============================================
// TESTS
// ============================================

describe('HousekeepingService', () => {
  let mockRepository: HousekeepingRepository;
  let container: Container;
  let service: ReturnType<typeof createHousekeepingService>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    container = createMockContainer(mockRepository);
    service = createHousekeepingService(container);
  });

  // ============================================
  // TASK OPERATIONS
  // ============================================

  describe('createTask', () => {
    it('should create a cleaning task with default values', async () => {
      const mockTask = createMockTask();
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(null);
      vi.mocked(mockRepository.createTask).mockResolvedValue(mockTask);

      const result = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });

      expect(result).toEqual(mockTask);
      expect(mockRepository.createTask).toHaveBeenCalledWith({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
        assignedTo: null,
        status: 'dirty',
        priority: 'medium',
        checkoutDate: null,
        checkinDate: null,
        notes: null,
        startedAt: null,
        completedAt: null,
        inspectedBy: null,
        inspectedAt: null,
      });
    });

    it('should create task with custom priority', async () => {
      const mockTask = createMockTask({ priority: 'urgent' });
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(null);
      vi.mocked(mockRepository.createTask).mockResolvedValue(mockTask);

      const result = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
        priority: 'urgent',
      });

      expect(result.priority).toBe('urgent');
    });

    it('should create task with checkout/checkin dates', async () => {
      const mockTask = createMockTask({ checkoutDate: '2024-07-15', checkinDate: '2024-07-16' });
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(null);
      vi.mocked(mockRepository.createTask).mockResolvedValue(mockTask);

      const result = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
        checkoutDate: '2024-07-15',
        checkinDate: '2024-07-16',
      });

      expect(result.checkoutDate).toBe('2024-07-15');
      expect(result.checkinDate).toBe('2024-07-16');
    });

    it('should allow creating task when existing task is clean', async () => {
      const existingTask = createMockTask({ status: 'clean' });
      const newTask = createMockTask({ id: TASK_2 });
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(existingTask);
      vi.mocked(mockRepository.createTask).mockResolvedValue(newTask);

      const result = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });

      expect(result).toEqual(newTask);
    });

    it('should reject when active task exists', async () => {
      const existingTask = createMockTask({ status: 'dirty' });
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(existingTask);

      await expect(
        service.createTask({ roomId: ROOM_1, roomNumber: '101', floor: 1 })
      ).rejects.toMatchObject({ code: 'TASK_ALREADY_EXISTS' });
    });

    it('should reject invalid room ID', async () => {
      await expect(
        service.createTask({ roomId: INVALID_UUID, roomNumber: '101', floor: 1 })
      ).rejects.toMatchObject({ code: 'INVALID_ROOM_ID' });
    });

    it('should reject empty room number', async () => {
      await expect(
        service.createTask({ roomId: ROOM_1, roomNumber: '', floor: 1 })
      ).rejects.toMatchObject({ code: 'INVALID_ROOM_NUMBER' });
    });

    it('should reject whitespace-only room number', async () => {
      await expect(
        service.createTask({ roomId: ROOM_1, roomNumber: '   ', floor: 1 })
      ).rejects.toMatchObject({ code: 'INVALID_ROOM_NUMBER' });
    });

    it('should reject negative floor', async () => {
      await expect(
        service.createTask({ roomId: ROOM_1, roomNumber: '101', floor: -1 })
      ).rejects.toMatchObject({ code: 'INVALID_FLOOR' });
    });

    it('should reject non-integer floor', async () => {
      await expect(
        service.createTask({ roomId: ROOM_1, roomNumber: '101', floor: 1.5 })
      ).rejects.toMatchObject({ code: 'INVALID_FLOOR' });
    });

    it('should reject invalid priority', async () => {
      await expect(
        service.createTask({ roomId: ROOM_1, roomNumber: '101', floor: 1, priority: 'super' as any })
      ).rejects.toMatchObject({ code: 'INVALID_PRIORITY' });
    });

    it('should trim room number', async () => {
      const mockTask = createMockTask();
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(null);
      vi.mocked(mockRepository.createTask).mockResolvedValue(mockTask);

      await service.createTask({ roomId: ROOM_1, roomNumber: '  101  ', floor: 1 });

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ roomNumber: '101' })
      );
    });

    it('should trim notes', async () => {
      const mockTask = createMockTask({ notes: 'Deep cleaning' });
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(null);
      vi.mocked(mockRepository.createTask).mockResolvedValue(mockTask);

      await service.createTask({ roomId: ROOM_1, roomNumber: '101', floor: 1, notes: '  Deep cleaning  ' });

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'Deep cleaning' })
      );
    });
  });

  describe('getTask', () => {
    it('should retrieve task by ID', async () => {
      const mockTask = createMockTask();
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      const result = await service.getTask(TASK_1);

      expect(result).toEqual(mockTask);
      expect(mockRepository.getTaskById).toHaveBeenCalledWith(TASK_1);
    });

    it('should return null for non-existent task', async () => {
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(null);

      const result = await service.getTask(TASK_1);

      expect(result).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getTask(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_TASK_ID',
      });
    });
  });

  describe('getTaskByRoom', () => {
    it('should retrieve task by room ID', async () => {
      const mockTask = createMockTask();
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(mockTask);

      const result = await service.getTaskByRoom(ROOM_1);

      expect(result).toEqual(mockTask);
      expect(mockRepository.getTaskByRoomId).toHaveBeenCalledWith(ROOM_1);
    });

    it('should return null for room without task', async () => {
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(null);

      const result = await service.getTaskByRoom(ROOM_1);

      expect(result).toBeNull();
    });

    it('should reject invalid room ID', async () => {
      await expect(service.getTaskByRoom(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_ROOM_ID',
      });
    });
  });

  describe('updateTask', () => {
    it('should update task priority', async () => {
      const mockTask = createMockTask();
      const updatedTask = createMockTask({ priority: 'high' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(updatedTask);

      const result = await service.updateTask(TASK_1, { priority: 'high' });

      expect(result.priority).toBe('high');
    });

    it('should update task notes', async () => {
      const mockTask = createMockTask();
      const updatedTask = createMockTask({ notes: 'Updated notes' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(updatedTask);

      const result = await service.updateTask(TASK_1, { notes: 'Updated notes' });

      expect(result.notes).toBe('Updated notes');
    });

    it('should allow clearing notes', async () => {
      const mockTask = createMockTask({ notes: 'Old notes' });
      const updatedTask = createMockTask({ notes: null });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(updatedTask);

      await service.updateTask(TASK_1, { notes: null as any });

      expect(mockRepository.updateTask).toHaveBeenCalledWith(TASK_1, expect.objectContaining({ notes: null }));
    });

    it('should update checkout/checkin dates', async () => {
      const mockTask = createMockTask();
      const updatedTask = createMockTask({ checkoutDate: '2024-08-01', checkinDate: '2024-08-02' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(updatedTask);

      const result = await service.updateTask(TASK_1, { checkoutDate: '2024-08-01', checkinDate: '2024-08-02' });

      expect(result.checkoutDate).toBe('2024-08-01');
      expect(result.checkinDate).toBe('2024-08-02');
    });

    it('should reject non-existent task', async () => {
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(null);

      await expect(
        service.updateTask(TASK_1, { priority: 'high' })
      ).rejects.toMatchObject({ code: 'TASK_NOT_FOUND', statusCode: 404 });
    });

    it('should reject invalid task ID', async () => {
      await expect(
        service.updateTask(INVALID_UUID, { priority: 'high' })
      ).rejects.toMatchObject({ code: 'INVALID_TASK_ID' });
    });

    it('should reject invalid priority', async () => {
      const mockTask = createMockTask();
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      await expect(
        service.updateTask(TASK_1, { priority: 'invalid' as any })
      ).rejects.toMatchObject({ code: 'INVALID_PRIORITY' });
    });
  });

  describe('deleteTask', () => {
    it('should delete existing task', async () => {
      const mockTask = createMockTask();
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.deleteTask).mockResolvedValue(undefined);

      await service.deleteTask(TASK_1);

      expect(mockRepository.deleteTask).toHaveBeenCalledWith(TASK_1);
    });

    it('should reject non-existent task', async () => {
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(null);

      await expect(service.deleteTask(TASK_1)).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should reject invalid task ID', async () => {
      await expect(service.deleteTask(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_TASK_ID',
      });
    });
  });

  describe('listTasks', () => {
    it('should list all tasks without filters', async () => {
      const tasks = [createMockTask(), createMockTask({ id: TASK_2, roomNumber: '102' })];
      vi.mocked(mockRepository.listTasks).mockResolvedValue(tasks);

      const result = await service.listTasks();

      expect(result).toEqual(tasks);
      expect(mockRepository.listTasks).toHaveBeenCalledWith(undefined);
    });

    it('should list tasks with status filter', async () => {
      const tasks = [createMockTask({ status: 'dirty' })];
      vi.mocked(mockRepository.listTasks).mockResolvedValue(tasks);

      const result = await service.listTasks({ status: 'dirty' });

      expect(result).toEqual(tasks);
      expect(mockRepository.listTasks).toHaveBeenCalledWith({ status: 'dirty' });
    });

    it('should list tasks with multiple filters', async () => {
      const tasks = [createMockTask({ status: 'dirty', priority: 'high', floor: 2 })];
      vi.mocked(mockRepository.listTasks).mockResolvedValue(tasks);

      const result = await service.listTasks({ status: 'dirty', priority: 'high', floor: 2 });

      expect(result).toEqual(tasks);
    });

    it('should return empty array when no tasks match', async () => {
      vi.mocked(mockRepository.listTasks).mockResolvedValue([]);

      const result = await service.listTasks({ status: 'inspected' });

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // WORKFLOW
  // ============================================

  describe('assignTask', () => {
    it('should assign task to housekeeper', async () => {
      const mockTask = createMockTask({ status: 'dirty' });
      const assignedTask = createMockTask({ status: 'dirty', assignedTo: HOUSEKEEPER_1 });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(assignedTask);

      const result = await service.assignTask(TASK_1, HOUSEKEEPER_1);

      expect(result.assignedTo).toBe(HOUSEKEEPER_1);
      expect(mockRepository.updateTask).toHaveBeenCalledWith(TASK_1, { assignedTo: HOUSEKEEPER_1 });
    });

    it('should allow reassigning in-progress task', async () => {
      const mockTask = createMockTask({ status: 'in_progress', assignedTo: HOUSEKEEPER_1 });
      const reassignedTask = createMockTask({ status: 'in_progress', assignedTo: INSPECTOR_1 });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(reassignedTask);

      const result = await service.assignTask(TASK_1, INSPECTOR_1);

      expect(result.assignedTo).toBe(INSPECTOR_1);
    });

    it('should reject assigning clean task', async () => {
      const mockTask = createMockTask({ status: 'clean' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      await expect(
        service.assignTask(TASK_1, HOUSEKEEPER_1)
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject assigning inspected task', async () => {
      const mockTask = createMockTask({ status: 'inspected' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      await expect(
        service.assignTask(TASK_1, HOUSEKEEPER_1)
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject non-existent task', async () => {
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(null);

      await expect(
        service.assignTask(TASK_1, HOUSEKEEPER_1)
      ).rejects.toMatchObject({ code: 'TASK_NOT_FOUND', statusCode: 404 });
    });

    it('should reject invalid task ID', async () => {
      await expect(
        service.assignTask(INVALID_UUID, HOUSEKEEPER_1)
      ).rejects.toMatchObject({ code: 'INVALID_TASK_ID' });
    });

    it('should reject invalid assignee ID', async () => {
      await expect(
        service.assignTask(TASK_1, INVALID_UUID)
      ).rejects.toMatchObject({ code: 'INVALID_ASSIGNEE_ID' });
    });
  });

  describe('unassignTask', () => {
    it('should unassign task', async () => {
      const mockTask = createMockTask({ status: 'dirty', assignedTo: HOUSEKEEPER_1 });
      const unassignedTask = createMockTask({ status: 'dirty', assignedTo: null });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(unassignedTask);

      const result = await service.unassignTask(TASK_1);

      expect(result.assignedTo).toBeNull();
    });

    it('should reject unassigning unassigned task', async () => {
      const mockTask = createMockTask({ assignedTo: null });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      await expect(service.unassignTask(TASK_1)).rejects.toMatchObject({
        code: 'NOT_ASSIGNED',
      });
    });

    it('should reject unassigning in-progress task', async () => {
      const mockTask = createMockTask({ status: 'in_progress', assignedTo: HOUSEKEEPER_1 });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      await expect(service.unassignTask(TASK_1)).rejects.toMatchObject({
        code: 'TASK_IN_PROGRESS',
      });
    });

    it('should reject non-existent task', async () => {
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(null);

      await expect(service.unassignTask(TASK_1)).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should reject invalid task ID', async () => {
      await expect(service.unassignTask(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_TASK_ID',
      });
    });
  });

  describe('startCleaning', () => {
    it('should start cleaning for dirty task', async () => {
      const mockTask = createMockTask({ status: 'dirty' });
      const startedTask = createMockTask({ status: 'in_progress', startedAt: '2024-01-01T10:00:00Z' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(startedTask);

      const result = await service.startCleaning(TASK_1);

      expect(result.status).toBe('in_progress');
      expect(result.startedAt).toBeDefined();
    });

    it('should reject starting already in-progress task', async () => {
      const mockTask = createMockTask({ status: 'in_progress' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      await expect(service.startCleaning(TASK_1)).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });

    it('should reject starting clean task', async () => {
      const mockTask = createMockTask({ status: 'clean' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      await expect(service.startCleaning(TASK_1)).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });

    it('should reject non-existent task', async () => {
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(null);

      await expect(service.startCleaning(TASK_1)).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should reject invalid task ID', async () => {
      await expect(service.startCleaning(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_TASK_ID',
      });
    });
  });

  describe('completeCleaning', () => {
    it('should complete in-progress cleaning', async () => {
      const mockTask = createMockTask({ status: 'in_progress', startedAt: '2024-01-01T10:00:00Z' });
      const completedTask = createMockTask({
        status: 'clean',
        startedAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T11:00:00Z',
      });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(completedTask);

      const result = await service.completeCleaning(TASK_1);

      expect(result.status).toBe('clean');
      expect(result.completedAt).toBeDefined();
    });

    it('should reject completing dirty task', async () => {
      const mockTask = createMockTask({ status: 'dirty' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      await expect(service.completeCleaning(TASK_1)).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });

    it('should reject completing already clean task', async () => {
      const mockTask = createMockTask({ status: 'clean' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      await expect(service.completeCleaning(TASK_1)).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });

    it('should reject non-existent task', async () => {
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(null);

      await expect(service.completeCleaning(TASK_1)).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should reject invalid task ID', async () => {
      await expect(service.completeCleaning(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_TASK_ID',
      });
    });
  });

  describe('inspectRoom', () => {
    it('should pass inspection for clean room', async () => {
      const mockTask = createMockTask({
        status: 'clean',
        startedAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T11:00:00Z',
      });
      const inspectedTask = createMockTask({
        status: 'inspected',
        startedAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T11:00:00Z',
        inspectedBy: INSPECTOR_1,
        inspectedAt: '2024-01-01T12:00:00Z',
      });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(inspectedTask);

      const result = await service.inspectRoom(TASK_1, INSPECTOR_1, true);

      expect(result.status).toBe('inspected');
      expect(result.inspectedBy).toBe(INSPECTOR_1);
    });

    it('should fail inspection and mark room dirty', async () => {
      const mockTask = createMockTask({
        status: 'clean',
        startedAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T11:00:00Z',
      });
      const failedTask = createMockTask({
        status: 'dirty',
        startedAt: null,
        completedAt: null,
        inspectedBy: INSPECTOR_1,
        inspectedAt: '2024-01-01T12:00:00Z',
      });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(failedTask);

      const result = await service.inspectRoom(TASK_1, INSPECTOR_1, false);

      expect(result.status).toBe('dirty');
    });

    it('should reject inspecting dirty room', async () => {
      const mockTask = createMockTask({ status: 'dirty' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      await expect(
        service.inspectRoom(TASK_1, INSPECTOR_1, true)
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject inspecting in-progress room', async () => {
      const mockTask = createMockTask({ status: 'in_progress' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);

      await expect(
        service.inspectRoom(TASK_1, INSPECTOR_1, true)
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });

    it('should reject non-existent task', async () => {
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(null);

      await expect(
        service.inspectRoom(TASK_1, INSPECTOR_1, true)
      ).rejects.toMatchObject({ code: 'TASK_NOT_FOUND', statusCode: 404 });
    });

    it('should reject invalid task ID', async () => {
      await expect(
        service.inspectRoom(INVALID_UUID, INSPECTOR_1, true)
      ).rejects.toMatchObject({ code: 'INVALID_TASK_ID' });
    });

    it('should reject invalid inspector ID', async () => {
      await expect(
        service.inspectRoom(TASK_1, INVALID_UUID, true)
      ).rejects.toMatchObject({ code: 'INVALID_INSPECTOR_ID' });
    });
  });

  describe('markOutOfOrder', () => {
    it('should mark room out of order with reason', async () => {
      const mockTask = createMockTask({ status: 'dirty' });
      const outOfOrderTask = createMockTask({
        status: 'out_of_order',
        notes: 'Out of order: Plumbing issue',
      });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(outOfOrderTask);

      const result = await service.markOutOfOrder(TASK_1, 'Plumbing issue');

      expect(result.status).toBe('out_of_order');
    });

    it('should append reason to existing notes', async () => {
      const mockTask = createMockTask({ notes: 'Existing notes' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(
        createMockTask({ status: 'out_of_order', notes: 'Existing notes\n\nOut of order: Leak' })
      );

      await service.markOutOfOrder(TASK_1, 'Leak');

      expect(mockRepository.updateTask).toHaveBeenCalledWith(TASK_1, {
        status: 'out_of_order',
        notes: 'Existing notes\n\nOut of order: Leak',
      });
    });

    it('should handle empty reason', async () => {
      const mockTask = createMockTask({ notes: 'Existing notes' });
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(
        createMockTask({ status: 'out_of_order', notes: 'Existing notes' })
      );

      await service.markOutOfOrder(TASK_1, '');

      expect(mockRepository.updateTask).toHaveBeenCalledWith(TASK_1, {
        status: 'out_of_order',
        notes: 'Existing notes',
      });
    });

    it('should reject non-existent task', async () => {
      vi.mocked(mockRepository.getTaskById).mockResolvedValue(null);

      await expect(service.markOutOfOrder(TASK_1, 'reason')).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should reject invalid task ID', async () => {
      await expect(service.markOutOfOrder(INVALID_UUID, 'reason')).rejects.toMatchObject({
        code: 'INVALID_TASK_ID',
      });
    });
  });

  describe('markDirty', () => {
    it('should mark room dirty by room ID', async () => {
      const mockTask = createMockTask({ status: 'clean' });
      const dirtyTask = createMockTask({
        status: 'dirty',
        startedAt: null,
        completedAt: null,
        inspectedBy: null,
        inspectedAt: null,
      });
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(dirtyTask);

      const result = await service.markDirty(ROOM_1);

      expect(result.status).toBe('dirty');
    });

    it('should reset timestamps when marking dirty', async () => {
      const mockTask = createMockTask({
        status: 'inspected',
        startedAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T11:00:00Z',
        inspectedBy: INSPECTOR_1,
        inspectedAt: '2024-01-01T12:00:00Z',
      });
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(mockTask);
      vi.mocked(mockRepository.updateTask).mockResolvedValue(createMockTask({ status: 'dirty' }));

      await service.markDirty(ROOM_1);

      expect(mockRepository.updateTask).toHaveBeenCalledWith(TASK_1, {
        status: 'dirty',
        startedAt: null,
        completedAt: null,
        inspectedBy: null,
        inspectedAt: null,
      });
    });

    it('should reject when no task exists for room', async () => {
      vi.mocked(mockRepository.getTaskByRoomId).mockResolvedValue(null);

      await expect(service.markDirty(ROOM_1)).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should reject invalid room ID', async () => {
      await expect(service.markDirty(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_ROOM_ID',
      });
    });
  });

  // ============================================
  // SUPPLY OPERATIONS
  // ============================================

  describe('createSupply', () => {
    it('should create a supply', async () => {
      const mockSupply = createMockSupply();
      vi.mocked(mockRepository.createSupply).mockResolvedValue(mockSupply);

      const result = await service.createSupply({
        name: 'Cleaning Solution',
        quantity: 50,
        minQuantity: 10,
        unit: 'liters',
      });

      expect(result).toEqual(mockSupply);
    });

    it('should trim supply name and unit', async () => {
      const mockSupply = createMockSupply();
      vi.mocked(mockRepository.createSupply).mockResolvedValue(mockSupply);

      await service.createSupply({
        name: '  Cleaning Solution  ',
        quantity: 50,
        minQuantity: 10,
        unit: '  liters  ',
      });

      expect(mockRepository.createSupply).toHaveBeenCalledWith({
        name: 'Cleaning Solution',
        quantity: 50,
        minQuantity: 10,
        unit: 'liters',
        lastRestocked: null,
      });
    });

    it('should reject empty supply name', async () => {
      await expect(
        service.createSupply({ name: '', quantity: 50, minQuantity: 10, unit: 'liters' })
      ).rejects.toMatchObject({ code: 'INVALID_SUPPLY_NAME' });
    });

    it('should reject whitespace-only name', async () => {
      await expect(
        service.createSupply({ name: '   ', quantity: 50, minQuantity: 10, unit: 'liters' })
      ).rejects.toMatchObject({ code: 'INVALID_SUPPLY_NAME' });
    });

    it('should reject negative quantity', async () => {
      await expect(
        service.createSupply({ name: 'Supply', quantity: -1, minQuantity: 10, unit: 'liters' })
      ).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
    });

    it('should reject non-integer quantity', async () => {
      await expect(
        service.createSupply({ name: 'Supply', quantity: 5.5, minQuantity: 10, unit: 'liters' })
      ).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
    });

    it('should reject negative minQuantity', async () => {
      await expect(
        service.createSupply({ name: 'Supply', quantity: 50, minQuantity: -5, unit: 'liters' })
      ).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
    });

    it('should reject empty unit', async () => {
      await expect(
        service.createSupply({ name: 'Supply', quantity: 50, minQuantity: 10, unit: '' })
      ).rejects.toMatchObject({ code: 'INVALID_UNIT' });
    });

    it('should accept zero quantity', async () => {
      const mockSupply = createMockSupply({ quantity: 0 });
      vi.mocked(mockRepository.createSupply).mockResolvedValue(mockSupply);

      const result = await service.createSupply({
        name: 'Supply',
        quantity: 0,
        minQuantity: 10,
        unit: 'liters',
      });

      expect(result.quantity).toBe(0);
    });
  });

  describe('getSupply', () => {
    it('should retrieve supply by ID', async () => {
      const mockSupply = createMockSupply();
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);

      const result = await service.getSupply(SUPPLY_1);

      expect(result).toEqual(mockSupply);
    });

    it('should return null for non-existent supply', async () => {
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(null);

      const result = await service.getSupply(SUPPLY_1);

      expect(result).toBeNull();
    });

    it('should reject invalid supply ID', async () => {
      await expect(service.getSupply(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_SUPPLY_ID',
      });
    });
  });

  describe('updateSupply', () => {
    it('should update supply name', async () => {
      const mockSupply = createMockSupply();
      const updatedSupply = createMockSupply({ name: 'New Cleaner' });
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);
      vi.mocked(mockRepository.updateSupply).mockResolvedValue(updatedSupply);

      const result = await service.updateSupply(SUPPLY_1, { name: 'New Cleaner' });

      expect(result.name).toBe('New Cleaner');
    });

    it('should update supply quantity', async () => {
      const mockSupply = createMockSupply();
      const updatedSupply = createMockSupply({ quantity: 100 });
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);
      vi.mocked(mockRepository.updateSupply).mockResolvedValue(updatedSupply);

      const result = await service.updateSupply(SUPPLY_1, { quantity: 100 });

      expect(result.quantity).toBe(100);
    });

    it('should update supply minQuantity', async () => {
      const mockSupply = createMockSupply();
      const updatedSupply = createMockSupply({ minQuantity: 20 });
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);
      vi.mocked(mockRepository.updateSupply).mockResolvedValue(updatedSupply);

      const result = await service.updateSupply(SUPPLY_1, { minQuantity: 20 });

      expect(result.minQuantity).toBe(20);
    });

    it('should update supply unit', async () => {
      const mockSupply = createMockSupply();
      const updatedSupply = createMockSupply({ unit: 'gallons' });
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);
      vi.mocked(mockRepository.updateSupply).mockResolvedValue(updatedSupply);

      const result = await service.updateSupply(SUPPLY_1, { unit: 'gallons' });

      expect(result.unit).toBe('gallons');
    });

    it('should reject non-existent supply', async () => {
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(null);

      await expect(
        service.updateSupply(SUPPLY_1, { name: 'New Name' })
      ).rejects.toMatchObject({ code: 'SUPPLY_NOT_FOUND', statusCode: 404 });
    });

    it('should reject invalid supply ID', async () => {
      await expect(
        service.updateSupply(INVALID_UUID, { name: 'New Name' })
      ).rejects.toMatchObject({ code: 'INVALID_SUPPLY_ID' });
    });

    it('should reject negative quantity', async () => {
      const mockSupply = createMockSupply();
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);

      await expect(
        service.updateSupply(SUPPLY_1, { quantity: -1 })
      ).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
    });

    it('should reject non-integer quantity', async () => {
      const mockSupply = createMockSupply();
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);

      await expect(
        service.updateSupply(SUPPLY_1, { quantity: 10.5 })
      ).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
    });
  });

  describe('deleteSupply', () => {
    it('should delete existing supply', async () => {
      const mockSupply = createMockSupply();
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);
      vi.mocked(mockRepository.deleteSupply).mockResolvedValue(undefined);

      await service.deleteSupply(SUPPLY_1);

      expect(mockRepository.deleteSupply).toHaveBeenCalledWith(SUPPLY_1);
    });

    it('should reject non-existent supply', async () => {
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(null);

      await expect(service.deleteSupply(SUPPLY_1)).rejects.toMatchObject({
        code: 'SUPPLY_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should reject invalid supply ID', async () => {
      await expect(service.deleteSupply(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_SUPPLY_ID',
      });
    });
  });

  describe('listSupplies', () => {
    it('should list all supplies', async () => {
      const supplies = [createMockSupply(), createMockSupply({ id: 'supply-2', name: 'Towels' })];
      vi.mocked(mockRepository.listSupplies).mockResolvedValue(supplies);

      const result = await service.listSupplies();

      expect(result).toEqual(supplies);
    });

    it('should return empty array when no supplies', async () => {
      vi.mocked(mockRepository.listSupplies).mockResolvedValue([]);

      const result = await service.listSupplies();

      expect(result).toEqual([]);
    });
  });

  describe('getLowSupplies', () => {
    it('should return supplies below minimum quantity', async () => {
      const lowSupplies = [createMockSupply({ quantity: 5, minQuantity: 10 })];
      vi.mocked(mockRepository.getLowSupplies).mockResolvedValue(lowSupplies);

      const result = await service.getLowSupplies();

      expect(result).toEqual(lowSupplies);
    });

    it('should return empty array when no low supplies', async () => {
      vi.mocked(mockRepository.getLowSupplies).mockResolvedValue([]);

      const result = await service.getLowSupplies();

      expect(result).toEqual([]);
    });
  });

  describe('restockSupply', () => {
    it('should add quantity to supply', async () => {
      const mockSupply = createMockSupply({ quantity: 50 });
      const restockedSupply = createMockSupply({ quantity: 70, lastRestocked: '2024-01-01T00:00:00Z' });
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);
      vi.mocked(mockRepository.updateSupply).mockResolvedValue(restockedSupply);

      const result = await service.restockSupply(SUPPLY_1, 20);

      expect(result.quantity).toBe(70);
      expect(mockRepository.updateSupply).toHaveBeenCalledWith(
        SUPPLY_1,
        expect.objectContaining({ quantity: 70 })
      );
    });

    it('should update lastRestocked timestamp', async () => {
      const mockSupply = createMockSupply();
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);
      vi.mocked(mockRepository.updateSupply).mockResolvedValue(createMockSupply());

      await service.restockSupply(SUPPLY_1, 10);

      expect(mockRepository.updateSupply).toHaveBeenCalledWith(
        SUPPLY_1,
        expect.objectContaining({ lastRestocked: expect.any(String) })
      );
    });

    it('should reject zero quantity', async () => {
      await expect(service.restockSupply(SUPPLY_1, 0)).rejects.toMatchObject({
        code: 'INVALID_QUANTITY',
      });
    });

    it('should reject negative quantity', async () => {
      await expect(service.restockSupply(SUPPLY_1, -5)).rejects.toMatchObject({
        code: 'INVALID_QUANTITY',
      });
    });

    it('should reject non-integer quantity', async () => {
      await expect(service.restockSupply(SUPPLY_1, 5.5)).rejects.toMatchObject({
        code: 'INVALID_QUANTITY',
      });
    });

    it('should reject non-existent supply', async () => {
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(null);

      await expect(service.restockSupply(SUPPLY_1, 10)).rejects.toMatchObject({
        code: 'SUPPLY_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should reject invalid supply ID', async () => {
      await expect(service.restockSupply(INVALID_UUID, 10)).rejects.toMatchObject({
        code: 'INVALID_SUPPLY_ID',
      });
    });
  });

  describe('useSupply', () => {
    it('should subtract quantity from supply', async () => {
      const mockSupply = createMockSupply({ quantity: 50 });
      const usedSupply = createMockSupply({ quantity: 40 });
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);
      vi.mocked(mockRepository.updateSupply).mockResolvedValue(usedSupply);

      const result = await service.useSupply(SUPPLY_1, 10);

      expect(result.quantity).toBe(40);
      expect(mockRepository.updateSupply).toHaveBeenCalledWith(SUPPLY_1, { quantity: 40 });
    });

    it('should allow using all remaining supply', async () => {
      const mockSupply = createMockSupply({ quantity: 10 });
      const emptySupply = createMockSupply({ quantity: 0 });
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);
      vi.mocked(mockRepository.updateSupply).mockResolvedValue(emptySupply);

      const result = await service.useSupply(SUPPLY_1, 10);

      expect(result.quantity).toBe(0);
    });

    it('should reject using more than available', async () => {
      const mockSupply = createMockSupply({ quantity: 5 });
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(mockSupply);

      await expect(service.useSupply(SUPPLY_1, 10)).rejects.toMatchObject({
        code: 'INSUFFICIENT_QUANTITY',
      });
    });

    it('should reject zero usage quantity', async () => {
      await expect(service.useSupply(SUPPLY_1, 0)).rejects.toMatchObject({
        code: 'INVALID_QUANTITY',
      });
    });

    it('should reject negative quantity', async () => {
      await expect(service.useSupply(SUPPLY_1, -5)).rejects.toMatchObject({
        code: 'INVALID_QUANTITY',
      });
    });

    it('should reject non-integer quantity', async () => {
      await expect(service.useSupply(SUPPLY_1, 5.5)).rejects.toMatchObject({
        code: 'INVALID_QUANTITY',
      });
    });

    it('should reject non-existent supply', async () => {
      vi.mocked(mockRepository.getSupplyById).mockResolvedValue(null);

      await expect(service.useSupply(SUPPLY_1, 5)).rejects.toMatchObject({
        code: 'SUPPLY_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should reject invalid supply ID', async () => {
      await expect(service.useSupply(INVALID_UUID, 5)).rejects.toMatchObject({
        code: 'INVALID_SUPPLY_ID',
      });
    });
  });

  // ============================================
  // REPORTING
  // ============================================

  describe('getByAssignee', () => {
    it('should return tasks assigned to a user', async () => {
      const tasks = [createMockTask({ assignedTo: HOUSEKEEPER_1 })];
      vi.mocked(mockRepository.getTasksByAssignee).mockResolvedValue(tasks);

      const result = await service.getByAssignee(HOUSEKEEPER_1);

      expect(result).toEqual(tasks);
      expect(mockRepository.getTasksByAssignee).toHaveBeenCalledWith(HOUSEKEEPER_1);
    });

    it('should return empty array when no tasks assigned', async () => {
      vi.mocked(mockRepository.getTasksByAssignee).mockResolvedValue([]);

      const result = await service.getByAssignee(HOUSEKEEPER_1);

      expect(result).toEqual([]);
    });

    it('should reject invalid assignee ID', async () => {
      await expect(service.getByAssignee(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_ASSIGNEE_ID',
      });
    });
  });

  describe('getByFloor', () => {
    it('should return tasks by floor', async () => {
      const tasks = [createMockTask({ floor: 2 })];
      vi.mocked(mockRepository.getTasksByFloor).mockResolvedValue(tasks);

      const result = await service.getByFloor(2);

      expect(result).toEqual(tasks);
      expect(mockRepository.getTasksByFloor).toHaveBeenCalledWith(2);
    });

    it('should return empty array when no tasks on floor', async () => {
      vi.mocked(mockRepository.getTasksByFloor).mockResolvedValue([]);

      const result = await service.getByFloor(99);

      expect(result).toEqual([]);
    });

    it('should reject negative floor', async () => {
      await expect(service.getByFloor(-1)).rejects.toMatchObject({
        code: 'INVALID_FLOOR',
      });
    });

    it('should reject non-integer floor', async () => {
      await expect(service.getByFloor(1.5)).rejects.toMatchObject({
        code: 'INVALID_FLOOR',
      });
    });
  });

  describe('getPendingTasks', () => {
    it('should return dirty and in-progress tasks', async () => {
      const allTasks = [
        createMockTask({ status: 'dirty' }),
        createMockTask({ id: TASK_2, status: 'in_progress' }),
        createMockTask({ id: 'task-3', status: 'clean' }),
        createMockTask({ id: 'task-4', status: 'inspected' }),
      ];
      vi.mocked(mockRepository.listTasks).mockResolvedValue(allTasks);

      const result = await service.getPendingTasks();

      expect(result).toHaveLength(2);
      expect(result.every(t => ['dirty', 'in_progress'].includes(t.status))).toBe(true);
    });

    it('should return empty array when no pending tasks', async () => {
      vi.mocked(mockRepository.listTasks).mockResolvedValue([
        createMockTask({ status: 'clean' }),
        createMockTask({ id: TASK_2, status: 'inspected' }),
      ]);

      const result = await service.getPendingTasks();

      expect(result).toEqual([]);
    });
  });

  describe('getUrgentTasks', () => {
    it('should return urgent tasks not clean or inspected', async () => {
      const urgentTasks = [
        createMockTask({ status: 'dirty', priority: 'urgent' }),
        createMockTask({ id: TASK_2, status: 'in_progress', priority: 'urgent' }),
      ];
      vi.mocked(mockRepository.listTasks).mockResolvedValue([
        ...urgentTasks,
        createMockTask({ id: 'task-3', status: 'clean', priority: 'urgent' }),
      ]);

      const result = await service.getUrgentTasks();

      expect(result).toHaveLength(2);
      expect(result.every(t => t.priority === 'urgent')).toBe(true);
      expect(result.every(t => !['clean', 'inspected'].includes(t.status))).toBe(true);
    });

    it('should return empty array when no urgent incomplete tasks', async () => {
      vi.mocked(mockRepository.listTasks).mockResolvedValue([
        createMockTask({ status: 'clean', priority: 'urgent' }),
        createMockTask({ id: TASK_2, status: 'inspected', priority: 'urgent' }),
      ]);

      const result = await service.getUrgentTasks();

      expect(result).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should calculate correct statistics', async () => {
      const tasks = [
        createMockTask({ status: 'dirty', priority: 'low', floor: 1 }),
        createMockTask({
          id: TASK_2,
          status: 'clean',
          priority: 'medium',
          floor: 1,
          startedAt: '2024-01-01T10:00:00Z',
          completedAt: '2024-01-01T10:30:00Z',
        }),
        createMockTask({
          id: 'task-3',
          status: 'in_progress',
          priority: 'high',
          floor: 2,
          startedAt: '2024-01-01T11:00:00Z',
        }),
        createMockTask({ id: 'task-4', status: 'inspected', priority: 'urgent', floor: 2 }),
      ];
      const lowSupplies = [createMockSupply({ quantity: 5, minQuantity: 10 })];
      vi.mocked(mockRepository.listTasks).mockResolvedValue(tasks);
      vi.mocked(mockRepository.getLowSupplies).mockResolvedValue(lowSupplies);

      const result = await service.getStats();

      expect(result.totalTasks).toBe(4);
      expect(result.byStatus.dirty).toBe(1);
      expect(result.byStatus.clean).toBe(1);
      expect(result.byStatus.in_progress).toBe(1);
      expect(result.byStatus.inspected).toBe(1);
      expect(result.byStatus.out_of_order).toBe(0);
      expect(result.byPriority.low).toBe(1);
      expect(result.byPriority.medium).toBe(1);
      expect(result.byPriority.high).toBe(1);
      expect(result.byPriority.urgent).toBe(1);
      expect(result.byFloor[1]).toBe(2);
      expect(result.byFloor[2]).toBe(2);
      expect(result.avgCleaningTimeMinutes).toBe(30);
      expect(result.lowSuppliesCount).toBe(1);
    });

    it('should return zero average when no completed tasks', async () => {
      vi.mocked(mockRepository.listTasks).mockResolvedValue([createMockTask({ status: 'dirty' })]);
      vi.mocked(mockRepository.getLowSupplies).mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.avgCleaningTimeMinutes).toBe(0);
    });

    it('should handle empty tasks list', async () => {
      vi.mocked(mockRepository.listTasks).mockResolvedValue([]);
      vi.mocked(mockRepository.getLowSupplies).mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.totalTasks).toBe(0);
      expect(result.avgCleaningTimeMinutes).toBe(0);
    });

    it('should calculate average from multiple completed tasks', async () => {
      const tasks = [
        createMockTask({
          startedAt: '2024-01-01T10:00:00Z',
          completedAt: '2024-01-01T10:30:00Z', // 30 min
        }),
        createMockTask({
          id: TASK_2,
          startedAt: '2024-01-01T11:00:00Z',
          completedAt: '2024-01-01T12:00:00Z', // 60 min
        }),
      ];
      vi.mocked(mockRepository.listTasks).mockResolvedValue(tasks);
      vi.mocked(mockRepository.getLowSupplies).mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.avgCleaningTimeMinutes).toBe(45); // (30 + 60) / 2
    });
  });

  // ============================================
  // UTILITY
  // ============================================

  describe('getRoomStatuses', () => {
    it('should return all room statuses', () => {
      const statuses = service.getRoomStatuses();

      expect(statuses).toEqual(['clean', 'dirty', 'in_progress', 'inspected', 'out_of_order']);
    });

    it('should return a copy (not mutate original)', () => {
      const statuses1 = service.getRoomStatuses();
      statuses1.push('test' as any);
      const statuses2 = service.getRoomStatuses();

      expect(statuses2).toHaveLength(5);
    });
  });

  describe('getPriorities', () => {
    it('should return all priorities', () => {
      const priorities = service.getPriorities();

      expect(priorities).toEqual(['low', 'medium', 'high', 'urgent']);
    });

    it('should return a copy (not mutate original)', () => {
      const priorities1 = service.getPriorities();
      priorities1.push('critical' as any);
      const priorities2 = service.getPriorities();

      expect(priorities2).toHaveLength(4);
    });
  });

  // ============================================
  // ERROR CLASS TEST
  // ============================================

  describe('HousekeepingServiceError', () => {
    it('should have correct properties', () => {
      const error = new HousekeepingServiceError('Test error', 'TEST_CODE', 500);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('HousekeepingServiceError');
    });

    it('should default to 400 status code', () => {
      const error = new HousekeepingServiceError('Test error', 'TEST_CODE');

      expect(error.statusCode).toBe(400);
    });
  });
});
