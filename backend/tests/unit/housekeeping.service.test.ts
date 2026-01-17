/**
 * Housekeeping Service Tests
 *
 * Unit tests for the Housekeeping Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createHousekeepingService, HousekeepingServiceError } from '../../src/lib/services/housekeeping.service';
import { InMemoryHousekeepingRepository } from '../../src/lib/repositories/housekeeping.repository.memory';
import type { Container, RoomCleaningTask } from '../../src/lib/container/types';

// Test UUIDs
const ROOM_1 = '11111111-1111-1111-1111-111111111111';
const ROOM_2 = '22222222-2222-2222-2222-222222222222';
const HOUSEKEEPER_1 = '33333333-3333-3333-3333-333333333333';
const INSPECTOR_1 = '44444444-4444-4444-4444-444444444444';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockContainer(housekeepingRepository: InMemoryHousekeepingRepository): Container {
  return {
    housekeepingRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

describe('HousekeepingService', () => {
  let repository: InMemoryHousekeepingRepository;
  let container: Container;
  let service: ReturnType<typeof createHousekeepingService>;

  beforeEach(() => {
    repository = new InMemoryHousekeepingRepository();
    container = createMockContainer(repository);
    service = createHousekeepingService(container);
  });

  // ============================================
  // CREATE TASK TESTS
  // ============================================
  describe('createTask', () => {
    it('should create a cleaning task', async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });

      expect(task).toBeDefined();
      expect(task.roomNumber).toBe('101');
      expect(task.status).toBe('dirty');
      expect(task.priority).toBe('medium');
    });

    it('should accept custom priority', async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
        priority: 'urgent',
      });

      expect(task.priority).toBe('urgent');
    });

    it('should accept checkout/checkin dates', async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
        checkoutDate: '2024-07-15',
        checkinDate: '2024-07-16',
      });

      expect(task.checkoutDate).toBe('2024-07-15');
      expect(task.checkinDate).toBe('2024-07-16');
    });

    it('should reject invalid room ID', async () => {
      await expect(
        service.createTask({
          roomId: INVALID_UUID,
          roomNumber: '101',
          floor: 1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_ROOM_ID',
      });
    });

    it('should reject empty room number', async () => {
      await expect(
        service.createTask({
          roomId: ROOM_1,
          roomNumber: '',
          floor: 1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_ROOM_NUMBER',
      });
    });

    it('should reject negative floor', async () => {
      await expect(
        service.createTask({
          roomId: ROOM_1,
          roomNumber: '101',
          floor: -1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_FLOOR',
      });
    });

    it('should reject invalid priority', async () => {
      await expect(
        service.createTask({
          roomId: ROOM_1,
          roomNumber: '101',
          floor: 1,
          priority: 'super' as any,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PRIORITY',
      });
    });
  });

  // ============================================
  // GET TASK TESTS
  // ============================================
  describe('getTask', () => {
    it('should retrieve task by ID', async () => {
      const created = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });

      const found = await service.getTask(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent task', async () => {
      const found = await service.getTask(ROOM_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getTask(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_TASK_ID',
      });
    });
  });

  describe('getTaskByRoom', () => {
    it('should retrieve task by room ID', async () => {
      await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });

      const found = await service.getTaskByRoom(ROOM_1);
      expect(found).toBeDefined();
      expect(found?.roomId).toBe(ROOM_1);
    });
  });

  // ============================================
  // UPDATE TASK TESTS
  // ============================================
  describe('updateTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });
      taskId = task.id;
    });

    it('should update priority', async () => {
      const updated = await service.updateTask(taskId, {
        priority: 'high',
      });

      expect(updated.priority).toBe('high');
    });

    it('should update notes', async () => {
      const updated = await service.updateTask(taskId, {
        notes: 'Deep cleaning needed',
      });

      expect(updated.notes).toBe('Deep cleaning needed');
    });

    it('should reject non-existent task', async () => {
      await expect(
        service.updateTask(ROOM_2, { priority: 'high' })
      ).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
      });
    });
  });

  // ============================================
  // DELETE TASK TESTS
  // ============================================
  describe('deleteTask', () => {
    it('should delete task', async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });

      await service.deleteTask(task.id);

      const found = await service.getTask(task.id);
      expect(found).toBeNull();
    });

    it('should reject non-existent task', async () => {
      await expect(service.deleteTask(ROOM_2)).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
      });
    });
  });

  // ============================================
  // ASSIGN TASK TESTS
  // ============================================
  describe('assignTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });
      taskId = task.id;
    });

    it('should assign task to housekeeper', async () => {
      const assigned = await service.assignTask(taskId, HOUSEKEEPER_1);

      expect(assigned.assignedTo).toBe(HOUSEKEEPER_1);
    });

    it('should reject non-existent task', async () => {
      await expect(
        service.assignTask(ROOM_2, HOUSEKEEPER_1)
      ).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
      });
    });

    it('should reject invalid assignee ID', async () => {
      await expect(
        service.assignTask(taskId, INVALID_UUID)
      ).rejects.toMatchObject({
        code: 'INVALID_ASSIGNEE_ID',
      });
    });
  });

  // ============================================
  // UNASSIGN TASK TESTS
  // ============================================
  describe('unassignTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });
      await service.assignTask(task.id, HOUSEKEEPER_1);
      taskId = task.id;
    });

    it('should unassign task', async () => {
      const unassigned = await service.unassignTask(taskId);
      expect(unassigned.assignedTo).toBeNull();
    });

    it('should reject unassigned task', async () => {
      const newTask = await service.createTask({
        roomId: ROOM_2,
        roomNumber: '102',
        floor: 1,
      });

      await expect(service.unassignTask(newTask.id)).rejects.toMatchObject({
        code: 'NOT_ASSIGNED',
      });
    });
  });

  // ============================================
  // START CLEANING TESTS
  // ============================================
  describe('startCleaning', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });
      taskId = task.id;
    });

    it('should start cleaning', async () => {
      const started = await service.startCleaning(taskId);

      expect(started.status).toBe('in_progress');
      expect(started.startedAt).toBeDefined();
    });

    it('should reject already started task', async () => {
      await service.startCleaning(taskId);

      await expect(service.startCleaning(taskId)).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });
  });

  // ============================================
  // COMPLETE CLEANING TESTS
  // ============================================
  describe('completeCleaning', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });
      await service.startCleaning(task.id);
      taskId = task.id;
    });

    it('should complete cleaning', async () => {
      const completed = await service.completeCleaning(taskId);

      expect(completed.status).toBe('clean');
      expect(completed.completedAt).toBeDefined();
    });

    it('should reject non-started task', async () => {
      const newTask = await service.createTask({
        roomId: ROOM_2,
        roomNumber: '102',
        floor: 1,
      });

      await expect(service.completeCleaning(newTask.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });
  });

  // ============================================
  // INSPECT ROOM TESTS
  // ============================================
  describe('inspectRoom', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });
      await service.startCleaning(task.id);
      await service.completeCleaning(task.id);
      taskId = task.id;
    });

    it('should pass inspection', async () => {
      const inspected = await service.inspectRoom(taskId, INSPECTOR_1, true);

      expect(inspected.status).toBe('inspected');
      expect(inspected.inspectedBy).toBe(INSPECTOR_1);
      expect(inspected.inspectedAt).toBeDefined();
    });

    it('should fail inspection and mark dirty', async () => {
      const inspected = await service.inspectRoom(taskId, INSPECTOR_1, false);

      expect(inspected.status).toBe('dirty');
    });

    it('should reject non-clean room', async () => {
      const newTask = await service.createTask({
        roomId: ROOM_2,
        roomNumber: '102',
        floor: 1,
      });

      await expect(
        service.inspectRoom(newTask.id, INSPECTOR_1, true)
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });
  });

  // ============================================
  // MARK OUT OF ORDER TESTS
  // ============================================
  describe('markOutOfOrder', () => {
    it('should mark room out of order', async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });

      const outOfOrder = await service.markOutOfOrder(task.id, 'Flooding');

      expect(outOfOrder.status).toBe('out_of_order');
      expect(outOfOrder.notes).toContain('Out of order: Flooding');
    });
  });

  // ============================================
  // MARK DIRTY TESTS
  // ============================================
  describe('markDirty', () => {
    it('should mark room as dirty', async () => {
      const task = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });
      await service.startCleaning(task.id);
      await service.completeCleaning(task.id);
      await service.inspectRoom(task.id, INSPECTOR_1, true);

      const dirty = await service.markDirty(ROOM_1);

      expect(dirty.status).toBe('dirty');
      expect(dirty.startedAt).toBeNull();
      expect(dirty.completedAt).toBeNull();
    });

    it('should reject non-existent room', async () => {
      await expect(service.markDirty(ROOM_2)).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
      });
    });
  });

  // ============================================
  // SUPPLY TESTS
  // ============================================
  describe('createSupply', () => {
    it('should create supply', async () => {
      const supply = await service.createSupply({
        name: 'Towels',
        quantity: 100,
        minQuantity: 20,
        unit: 'pieces',
      });

      expect(supply).toBeDefined();
      expect(supply.name).toBe('Towels');
      expect(supply.quantity).toBe(100);
    });

    it('should reject empty name', async () => {
      await expect(
        service.createSupply({
          name: '',
          quantity: 100,
          minQuantity: 20,
          unit: 'pieces',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_SUPPLY_NAME',
      });
    });

    it('should reject negative quantity', async () => {
      await expect(
        service.createSupply({
          name: 'Towels',
          quantity: -10,
          minQuantity: 20,
          unit: 'pieces',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_QUANTITY',
      });
    });
  });

  describe('restockSupply', () => {
    it('should restock supply', async () => {
      const supply = await service.createSupply({
        name: 'Towels',
        quantity: 100,
        minQuantity: 20,
        unit: 'pieces',
      });

      const restocked = await service.restockSupply(supply.id, 50);

      expect(restocked.quantity).toBe(150);
      expect(restocked.lastRestocked).toBeDefined();
    });

    it('should reject invalid quantity', async () => {
      const supply = await service.createSupply({
        name: 'Towels',
        quantity: 100,
        minQuantity: 20,
        unit: 'pieces',
      });

      await expect(service.restockSupply(supply.id, 0)).rejects.toMatchObject({
        code: 'INVALID_QUANTITY',
      });
    });
  });

  describe('useSupply', () => {
    it('should use supply', async () => {
      const supply = await service.createSupply({
        name: 'Towels',
        quantity: 100,
        minQuantity: 20,
        unit: 'pieces',
      });

      const used = await service.useSupply(supply.id, 30);

      expect(used.quantity).toBe(70);
    });

    it('should reject insufficient quantity', async () => {
      const supply = await service.createSupply({
        name: 'Towels',
        quantity: 10,
        minQuantity: 20,
        unit: 'pieces',
      });

      await expect(service.useSupply(supply.id, 20)).rejects.toMatchObject({
        code: 'INSUFFICIENT_QUANTITY',
      });
    });
  });

  describe('getLowSupplies', () => {
    it('should return low supplies', async () => {
      await service.createSupply({
        name: 'Towels',
        quantity: 100,
        minQuantity: 20,
        unit: 'pieces',
      });

      await service.createSupply({
        name: 'Soap',
        quantity: 5,
        minQuantity: 10,
        unit: 'bottles',
      });

      const lowSupplies = await service.getLowSupplies();

      expect(lowSupplies.length).toBe(1);
      expect(lowSupplies[0].name).toBe('Soap');
    });
  });

  // ============================================
  // LIST TASKS TESTS
  // ============================================
  describe('listTasks', () => {
    beforeEach(async () => {
      await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
        priority: 'medium',
      });

      await service.createTask({
        roomId: ROOM_2,
        roomNumber: '201',
        floor: 2,
        priority: 'urgent',
      });
    });

    it('should return all tasks', async () => {
      const tasks = await service.listTasks();
      expect(tasks.length).toBe(2);
    });

    it('should filter by floor', async () => {
      const tasks = await service.listTasks({ floor: 1 });
      expect(tasks.length).toBe(1);
    });

    it('should filter by priority', async () => {
      const tasks = await service.listTasks({ priority: 'urgent' });
      expect(tasks.length).toBe(1);
    });
  });

  // ============================================
  // GET PENDING TASKS TESTS
  // ============================================
  describe('getPendingTasks', () => {
    it('should return only pending tasks', async () => {
      const task1 = await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });

      const task2 = await service.createTask({
        roomId: ROOM_2,
        roomNumber: '102',
        floor: 1,
      });
      await service.startCleaning(task2.id);
      await service.completeCleaning(task2.id);
      await service.inspectRoom(task2.id, INSPECTOR_1, true);

      const pending = await service.getPendingTasks();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(task1.id);
    });
  });

  // ============================================
  // STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats with no data', async () => {
      const stats = await service.getStats();

      expect(stats.totalTasks).toBe(0);
      expect(stats.avgCleaningTimeMinutes).toBe(0);
    });

    it('should count tasks by status', async () => {
      await service.createTask({
        roomId: ROOM_1,
        roomNumber: '101',
        floor: 1,
      });

      const stats = await service.getStats();

      expect(stats.totalTasks).toBe(1);
      expect(stats.byStatus.dirty).toBe(1);
      expect(stats.byFloor[1]).toBe(1);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getRoomStatuses', () => {
    it('should return all room statuses', () => {
      const statuses = service.getRoomStatuses();

      expect(statuses).toContain('clean');
      expect(statuses).toContain('dirty');
      expect(statuses).toContain('inspected');
    });
  });

  describe('getPriorities', () => {
    it('should return all priorities', () => {
      const priorities = service.getPriorities();

      expect(priorities).toContain('low');
      expect(priorities).toContain('urgent');
    });
  });
});
