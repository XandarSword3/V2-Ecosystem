/**
 * Task Service Tests
 *
 * Unit tests for the Task/Work Order Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTaskService, TaskServiceError } from '../../src/lib/services/task.service';
import { InMemoryTaskRepository } from '../../src/lib/repositories/task.repository.memory';
import type { Container, Task } from '../../src/lib/container/types';

// Test UUIDs
const STAFF_1 = '11111111-1111-1111-1111-111111111111';
const STAFF_2 = '22222222-2222-2222-2222-222222222222';
const AUTHOR_1 = '33333333-3333-3333-3333-333333333333';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockContainer(taskRepository: InMemoryTaskRepository): Container {
  return {
    taskRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

function createTestTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: '99999999-9999-9999-9999-999999999999',
    title: 'Fix AC Unit',
    description: 'AC unit in room 101 is not cooling properly',
    category: 'repair',
    priority: 'high',
    status: 'open',
    assignedTo: null,
    assignedToName: null,
    createdBy: STAFF_1,
    createdByName: 'John Manager',
    location: 'Room 101',
    dueDate: null,
    estimatedMinutes: null,
    actualMinutes: null,
    completedAt: null,
    notes: null,
    tags: [],
    createdAt: now,
    updatedAt: null,
    ...overrides,
  };
}

describe('TaskService', () => {
  let repository: InMemoryTaskRepository;
  let container: Container;
  let service: ReturnType<typeof createTaskService>;

  beforeEach(() => {
    repository = new InMemoryTaskRepository();
    container = createMockContainer(repository);
    service = createTaskService(container);
  });

  // ============================================
  // CREATE TASK TESTS
  // ============================================
  describe('createTask', () => {
    it('should create a task', async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'AC not working',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
      });

      expect(task).toBeDefined();
      expect(task.title).toBe('Fix AC Unit');
      expect(task.status).toBe('open');
    });

    it('should create assigned task with assigned status', async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'AC not working',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
        assignedTo: STAFF_2,
        assignedToName: 'Bob Worker',
      });

      expect(task.status).toBe('assigned');
      expect(task.assignedToName).toBe('Bob Worker');
    });

    it('should accept due date', async () => {
      const dueDate = new Date(Date.now() + 86400000).toISOString();

      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'AC not working',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
        dueDate,
      });

      expect(task.dueDate).toBe(dueDate);
    });

    it('should accept estimated minutes', async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'AC not working',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
        estimatedMinutes: 60,
      });

      expect(task.estimatedMinutes).toBe(60);
    });

    it('should accept tags', async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'AC not working',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
        tags: ['hvac', 'urgent'],
      });

      expect(task.tags).toContain('hvac');
      expect(task.tags).toContain('urgent');
    });

    it('should reject short title', async () => {
      await expect(
        service.createTask({
          title: 'AB',
          description: 'Description',
          category: 'repair',
          priority: 'high',
          createdBy: STAFF_1,
          createdByName: 'John Manager',
          location: 'Room 101',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_TITLE',
      });
    });

    it('should reject empty description', async () => {
      await expect(
        service.createTask({
          title: 'Fix AC Unit',
          description: '',
          category: 'repair',
          priority: 'high',
          createdBy: STAFF_1,
          createdByName: 'John Manager',
          location: 'Room 101',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DESCRIPTION',
      });
    });

    it('should reject invalid category', async () => {
      await expect(
        service.createTask({
          title: 'Fix AC Unit',
          description: 'Description',
          category: 'invalid' as any,
          priority: 'high',
          createdBy: STAFF_1,
          createdByName: 'John Manager',
          location: 'Room 101',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CATEGORY',
      });
    });

    it('should reject invalid priority', async () => {
      await expect(
        service.createTask({
          title: 'Fix AC Unit',
          description: 'Description',
          category: 'repair',
          priority: 'invalid' as any,
          createdBy: STAFF_1,
          createdByName: 'John Manager',
          location: 'Room 101',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PRIORITY',
      });
    });

    it('should reject empty location', async () => {
      await expect(
        service.createTask({
          title: 'Fix AC Unit',
          description: 'Description',
          category: 'repair',
          priority: 'high',
          createdBy: STAFF_1,
          createdByName: 'John Manager',
          location: '',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_LOCATION',
      });
    });

    it('should reject invalid creator ID', async () => {
      await expect(
        service.createTask({
          title: 'Fix AC Unit',
          description: 'Description',
          category: 'repair',
          priority: 'high',
          createdBy: INVALID_UUID,
          createdByName: 'John Manager',
          location: 'Room 101',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CREATOR_ID',
      });
    });

    it('should reject empty creator name', async () => {
      await expect(
        service.createTask({
          title: 'Fix AC Unit',
          description: 'Description',
          category: 'repair',
          priority: 'high',
          createdBy: STAFF_1,
          createdByName: '',
          location: 'Room 101',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CREATOR_NAME',
      });
    });

    it('should reject negative estimated minutes', async () => {
      await expect(
        service.createTask({
          title: 'Fix AC Unit',
          description: 'Description',
          category: 'repair',
          priority: 'high',
          createdBy: STAFF_1,
          createdByName: 'John Manager',
          location: 'Room 101',
          estimatedMinutes: -30,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_ESTIMATED_MINUTES',
      });
    });

    it('should reject invalid assignee ID', async () => {
      await expect(
        service.createTask({
          title: 'Fix AC Unit',
          description: 'Description',
          category: 'repair',
          priority: 'high',
          createdBy: STAFF_1,
          createdByName: 'John Manager',
          location: 'Room 101',
          assignedTo: INVALID_UUID,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_ASSIGNEE_ID',
      });
    });
  });

  // ============================================
  // GET TASK TESTS
  // ============================================
  describe('getTask', () => {
    it('should retrieve task by ID', async () => {
      const created = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
      });

      const found = await service.getTask(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent task', async () => {
      const found = await service.getTask(STAFF_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getTask(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_TASK_ID',
      });
    });
  });

  // ============================================
  // UPDATE TASK TESTS
  // ============================================
  describe('updateTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
      });
      taskId = task.id;
    });

    it('should update title', async () => {
      const updated = await service.updateTask(taskId, {
        title: 'Replace AC Unit',
      });

      expect(updated.title).toBe('Replace AC Unit');
    });

    it('should update priority', async () => {
      const updated = await service.updateTask(taskId, {
        priority: 'urgent',
      });

      expect(updated.priority).toBe('urgent');
    });

    it('should update category', async () => {
      const updated = await service.updateTask(taskId, {
        category: 'maintenance',
      });

      expect(updated.category).toBe('maintenance');
    });

    it('should update tags', async () => {
      const updated = await service.updateTask(taskId, {
        tags: ['hvac', 'electrical'],
      });

      expect(updated.tags).toContain('hvac');
    });

    it('should reject update for non-existent task', async () => {
      await expect(
        service.updateTask(STAFF_2, { title: 'New Title' })
      ).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
      });
    });

    it('should reject update for completed task', async () => {
      // Assign and start first
      await service.assignTask(taskId, { assignedTo: STAFF_2, assignedToName: 'Bob' });
      await service.startTask(taskId);
      await service.completeTask(taskId);

      await expect(
        service.updateTask(taskId, { title: 'New Title' })
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(
        service.updateTask(INVALID_UUID, { title: 'New Title' })
      ).rejects.toMatchObject({
        code: 'INVALID_TASK_ID',
      });
    });
  });

  // ============================================
  // DELETE TASK TESTS
  // ============================================
  describe('deleteTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
      });
      taskId = task.id;
    });

    it('should delete open task', async () => {
      await service.deleteTask(taskId);

      const found = await service.getTask(taskId);
      expect(found).toBeNull();
    });

    it('should reject deleting in-progress task', async () => {
      await service.assignTask(taskId, { assignedTo: STAFF_2, assignedToName: 'Bob' });
      await service.startTask(taskId);

      await expect(service.deleteTask(taskId)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent task', async () => {
      await expect(service.deleteTask(STAFF_2)).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(service.deleteTask(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_TASK_ID',
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
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
      });
      taskId = task.id;
    });

    it('should assign task to staff', async () => {
      const updated = await service.assignTask(taskId, {
        assignedTo: STAFF_2,
        assignedToName: 'Bob Worker',
      });

      expect(updated.status).toBe('assigned');
      expect(updated.assignedTo).toBe(STAFF_2);
    });

    it('should reject invalid assignee ID', async () => {
      await expect(
        service.assignTask(taskId, {
          assignedTo: INVALID_UUID,
          assignedToName: 'Bob Worker',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_ASSIGNEE_ID',
      });
    });

    it('should reject empty assignee name', async () => {
      await expect(
        service.assignTask(taskId, {
          assignedTo: STAFF_2,
          assignedToName: '',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_ASSIGNEE_NAME',
      });
    });

    it('should reject assigning completed task', async () => {
      await service.assignTask(taskId, { assignedTo: STAFF_2, assignedToName: 'Bob' });
      await service.startTask(taskId);
      await service.completeTask(taskId);

      await expect(
        service.assignTask(taskId, { assignedTo: AUTHOR_1, assignedToName: 'Alice' })
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
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
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
        assignedTo: STAFF_2,
        assignedToName: 'Bob Worker',
      });
      taskId = task.id;
    });

    it('should unassign task', async () => {
      const updated = await service.unassignTask(taskId);

      expect(updated.status).toBe('open');
      expect(updated.assignedTo).toBeNull();
    });

    it('should reject unassigning in-progress task', async () => {
      await service.startTask(taskId);

      await expect(service.unassignTask(taskId)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent task', async () => {
      await expect(service.unassignTask(STAFF_1)).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
      });
    });
  });

  // ============================================
  // START TASK TESTS
  // ============================================
  describe('startTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
        assignedTo: STAFF_2,
        assignedToName: 'Bob Worker',
      });
      taskId = task.id;
    });

    it('should start assigned task', async () => {
      const updated = await service.startTask(taskId);

      expect(updated.status).toBe('in_progress');
    });

    it('should reject starting open task', async () => {
      const openTask = await service.createTask({
        title: 'Another Task',
        description: 'Description',
        category: 'repair',
        priority: 'low',
        createdBy: STAFF_1,
        createdByName: 'John',
        location: 'Room 102',
      });

      await expect(service.startTask(openTask.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject non-existent task', async () => {
      await expect(service.startTask(STAFF_1)).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
      });
    });
  });

  // ============================================
  // COMPLETE TASK TESTS
  // ============================================
  describe('completeTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
        assignedTo: STAFF_2,
        assignedToName: 'Bob Worker',
      });
      taskId = task.id;
      await service.startTask(taskId);
    });

    it('should complete in-progress task', async () => {
      const updated = await service.completeTask(taskId);

      expect(updated.status).toBe('completed');
      expect(updated.completedAt).toBeDefined();
    });

    it('should record actual minutes', async () => {
      const updated = await service.completeTask(taskId, {
        actualMinutes: 45,
      });

      expect(updated.actualMinutes).toBe(45);
    });

    it('should add completion notes', async () => {
      const updated = await service.completeTask(taskId, {
        notes: 'Replaced filter',
      });

      expect(updated.notes).toContain('Replaced filter');
    });

    it('should reject completing non-started task', async () => {
      const newTask = await service.createTask({
        title: 'Another Task',
        description: 'Description',
        category: 'repair',
        priority: 'low',
        createdBy: STAFF_1,
        createdByName: 'John',
        location: 'Room 102',
      });

      await expect(service.completeTask(newTask.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });

    it('should reject invalid actual minutes', async () => {
      await expect(
        service.completeTask(taskId, { actualMinutes: -10 })
      ).rejects.toMatchObject({
        code: 'INVALID_ACTUAL_MINUTES',
      });
    });
  });

  // ============================================
  // CANCEL TASK TESTS
  // ============================================
  describe('cancelTask', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
      });
      taskId = task.id;
    });

    it('should cancel open task', async () => {
      const updated = await service.cancelTask(taskId);

      expect(updated.status).toBe('cancelled');
    });

    it('should add cancellation reason', async () => {
      const updated = await service.cancelTask(taskId, 'Duplicate request');

      expect(updated.notes).toContain('Duplicate request');
    });

    it('should reject cancelling completed task', async () => {
      await service.assignTask(taskId, { assignedTo: STAFF_2, assignedToName: 'Bob' });
      await service.startTask(taskId);
      await service.completeTask(taskId);

      await expect(service.cancelTask(taskId)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });
  });

  // ============================================
  // PUT ON HOLD TESTS
  // ============================================
  describe('putOnHold', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
        assignedTo: STAFF_2,
        assignedToName: 'Bob Worker',
      });
      taskId = task.id;
    });

    it('should put assigned task on hold', async () => {
      const updated = await service.putOnHold(taskId);

      expect(updated.status).toBe('on_hold');
    });

    it('should add hold reason', async () => {
      const updated = await service.putOnHold(taskId, 'Waiting for parts');

      expect(updated.notes).toContain('Waiting for parts');
    });

    it('should reject putting open task on hold', async () => {
      const openTask = await service.createTask({
        title: 'Another Task',
        description: 'Description',
        category: 'repair',
        priority: 'low',
        createdBy: STAFF_1,
        createdByName: 'John',
        location: 'Room 102',
      });

      await expect(service.putOnHold(openTask.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });
  });

  // ============================================
  // REOPEN TASK TESTS
  // ============================================
  describe('reopenTask', () => {
    it('should reopen cancelled task', async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
      });
      await service.cancelTask(task.id);

      const updated = await service.reopenTask(task.id);

      expect(updated.status).toBe('open');
    });

    it('should reopen on-hold task as assigned', async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
        assignedTo: STAFF_2,
        assignedToName: 'Bob Worker',
      });
      await service.putOnHold(task.id);

      const updated = await service.reopenTask(task.id);

      expect(updated.status).toBe('assigned');
    });

    it('should reject reopening open task', async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
      });

      await expect(service.reopenTask(task.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS',
      });
    });
  });

  // ============================================
  // LIST TASKS TESTS
  // ============================================
  describe('listTasks', () => {
    beforeEach(async () => {
      await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
      });

      await service.createTask({
        title: 'Clean Pool',
        description: 'Description',
        category: 'cleaning',
        priority: 'medium',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Pool Area',
      });

      await service.createTask({
        title: 'Inspect Fire Alarm',
        description: 'Description',
        category: 'inspection',
        priority: 'low',
        createdBy: STAFF_2,
        createdByName: 'Bob Worker',
        location: 'Lobby',
      });
    });

    it('should return all tasks', async () => {
      const tasks = await service.listTasks();
      expect(tasks.length).toBe(3);
    });

    it('should filter by category', async () => {
      const tasks = await service.listTasks({ category: 'repair' });
      expect(tasks.length).toBe(1);
    });

    it('should filter by priority', async () => {
      const tasks = await service.listTasks({ priority: 'high' });
      expect(tasks.length).toBe(1);
    });

    it('should filter by status', async () => {
      const tasks = await service.listTasks({ status: 'open' });
      expect(tasks.length).toBe(3);
    });

    it('should filter by createdBy', async () => {
      const tasks = await service.listTasks({ createdBy: STAFF_2 });
      expect(tasks.length).toBe(1);
    });
  });

  // ============================================
  // GET ASSIGNEE TASKS TESTS
  // ============================================
  describe('getAssigneeTasks', () => {
    it('should return tasks assigned to staff', async () => {
      await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
        assignedTo: STAFF_2,
        assignedToName: 'Bob Worker',
      });

      const tasks = await service.getAssigneeTasks(STAFF_2);
      expect(tasks.length).toBe(1);
    });

    it('should reject invalid staff ID', async () => {
      await expect(service.getAssigneeTasks(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_STAFF_ID',
      });
    });
  });

  // ============================================
  // OVERDUE TASKS TESTS
  // ============================================
  describe('getOverdueTasks', () => {
    it('should return overdue tasks', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString();

      const task = createTestTask({
        id: '44444444-4444-4444-4444-444444444444',
        dueDate: yesterday,
        status: 'open',
      });
      repository.addTask(task);

      const overdue = await service.getOverdueTasks();
      expect(overdue.length).toBe(1);
    });
  });

  // ============================================
  // COMMENT TESTS
  // ============================================
  describe('addComment', () => {
    let taskId: string;

    beforeEach(async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
      });
      taskId = task.id;
    });

    it('should add comment to task', async () => {
      const comment = await service.addComment({
        taskId,
        authorId: AUTHOR_1,
        authorName: 'Alice',
        content: 'Started working on this',
      });

      expect(comment).toBeDefined();
      expect(comment.content).toBe('Started working on this');
    });

    it('should reject empty content', async () => {
      await expect(
        service.addComment({
          taskId,
          authorId: AUTHOR_1,
          authorName: 'Alice',
          content: '',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CONTENT',
      });
    });

    it('should reject invalid author ID', async () => {
      await expect(
        service.addComment({
          taskId,
          authorId: INVALID_UUID,
          authorName: 'Alice',
          content: 'Comment',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_AUTHOR_ID',
      });
    });

    it('should reject empty author name', async () => {
      await expect(
        service.addComment({
          taskId,
          authorId: AUTHOR_1,
          authorName: '',
          content: 'Comment',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_AUTHOR_NAME',
      });
    });
  });

  describe('getComments', () => {
    it('should retrieve comments for task', async () => {
      const task = await service.createTask({
        title: 'Fix AC Unit',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John Manager',
        location: 'Room 101',
      });

      await service.addComment({
        taskId: task.id,
        authorId: AUTHOR_1,
        authorName: 'Alice',
        content: 'Comment 1',
      });

      await service.addComment({
        taskId: task.id,
        authorId: STAFF_2,
        authorName: 'Bob',
        content: 'Comment 2',
      });

      const comments = await service.getComments(task.id);
      expect(comments.length).toBe(2);
    });

    it('should reject invalid task ID', async () => {
      await expect(service.getComments(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_TASK_ID',
      });
    });
  });

  // ============================================
  // STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats with no tasks', async () => {
      const stats = await service.getStats();

      expect(stats.totalTasks).toBe(0);
      expect(stats.openTasks).toBe(0);
    });

    it('should count tasks by status', async () => {
      const task1 = await service.createTask({
        title: 'Task 1',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John',
        location: 'Room 101',
      });

      await service.createTask({
        title: 'Task 2',
        description: 'Description',
        category: 'cleaning',
        priority: 'medium',
        createdBy: STAFF_1,
        createdByName: 'John',
        location: 'Room 102',
      });

      await service.cancelTask(task1.id);

      const stats = await service.getStats();

      expect(stats.totalTasks).toBe(2);
      expect(stats.cancelledTasks).toBe(1);
      expect(stats.openTasks).toBe(1);
    });

    it('should count by category', async () => {
      await service.createTask({
        title: 'Repair Task',
        description: 'Description',
        category: 'repair',
        priority: 'high',
        createdBy: STAFF_1,
        createdByName: 'John',
        location: 'Room 101',
      });

      await service.createTask({
        title: 'Cleaning Task',
        description: 'Description',
        category: 'cleaning',
        priority: 'medium',
        createdBy: STAFF_1,
        createdByName: 'John',
        location: 'Room 102',
      });

      const stats = await service.getStats();

      expect(stats.byCategory.repair).toBe(1);
      expect(stats.byCategory.cleaning).toBe(1);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getStatuses', () => {
    it('should return all statuses', () => {
      const statuses = service.getStatuses();

      expect(statuses).toContain('open');
      expect(statuses).toContain('assigned');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('cancelled');
      expect(statuses).toContain('on_hold');
    });
  });

  describe('getPriorities', () => {
    it('should return all priorities', () => {
      const priorities = service.getPriorities();

      expect(priorities).toContain('low');
      expect(priorities).toContain('medium');
      expect(priorities).toContain('high');
      expect(priorities).toContain('urgent');
    });
  });

  describe('getCategories', () => {
    it('should return all categories', () => {
      const categories = service.getCategories();

      expect(categories).toContain('maintenance');
      expect(categories).toContain('cleaning');
      expect(categories).toContain('repair');
      expect(categories).toContain('inspection');
    });
  });
});
