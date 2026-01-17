/**
 * Housekeeping Service
 *
 * Business logic for room cleaning and housekeeping with DI.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Container,
  HousekeepingRepository,
  RoomCleaningTask,
  CleaningSupply,
  RoomStatus,
  CleaningPriority,
  HousekeepingFilters,
  LoggerService,
} from '../container/types.js';

// ============================================
// TYPES
// ============================================

export interface CreateTaskInput {
  roomId: string;
  roomNumber: string;
  floor: number;
  priority?: CleaningPriority;
  checkoutDate?: string;
  checkinDate?: string;
  notes?: string;
}

export interface UpdateTaskInput {
  priority?: CleaningPriority;
  notes?: string;
  checkoutDate?: string;
  checkinDate?: string;
}

export interface CreateSupplyInput {
  name: string;
  quantity: number;
  minQuantity: number;
  unit: string;
}

export interface UpdateSupplyInput {
  name?: string;
  quantity?: number;
  minQuantity?: number;
  unit?: string;
}

export interface HousekeepingStats {
  totalTasks: number;
  byStatus: Record<RoomStatus, number>;
  byPriority: Record<CleaningPriority, number>;
  byFloor: Record<number, number>;
  avgCleaningTimeMinutes: number;
  lowSuppliesCount: number;
}

export interface HousekeepingService {
  // Task operations
  createTask(input: CreateTaskInput): Promise<RoomCleaningTask>;
  getTask(id: string): Promise<RoomCleaningTask | null>;
  getTaskByRoom(roomId: string): Promise<RoomCleaningTask | null>;
  updateTask(id: string, input: UpdateTaskInput): Promise<RoomCleaningTask>;
  deleteTask(id: string): Promise<void>;
  listTasks(filters?: HousekeepingFilters): Promise<RoomCleaningTask[]>;
  
  // Workflow
  assignTask(id: string, assignedTo: string): Promise<RoomCleaningTask>;
  unassignTask(id: string): Promise<RoomCleaningTask>;
  startCleaning(id: string): Promise<RoomCleaningTask>;
  completeCleaning(id: string): Promise<RoomCleaningTask>;
  inspectRoom(id: string, inspectedBy: string, passed: boolean): Promise<RoomCleaningTask>;
  markOutOfOrder(id: string, reason: string): Promise<RoomCleaningTask>;
  markDirty(roomId: string): Promise<RoomCleaningTask>;
  
  // Supply operations
  createSupply(input: CreateSupplyInput): Promise<CleaningSupply>;
  getSupply(id: string): Promise<CleaningSupply | null>;
  updateSupply(id: string, input: UpdateSupplyInput): Promise<CleaningSupply>;
  deleteSupply(id: string): Promise<void>;
  listSupplies(): Promise<CleaningSupply[]>;
  getLowSupplies(): Promise<CleaningSupply[]>;
  restockSupply(id: string, quantity: number): Promise<CleaningSupply>;
  useSupply(id: string, quantity: number): Promise<CleaningSupply>;
  
  // Reporting
  getByAssignee(assigneeId: string): Promise<RoomCleaningTask[]>;
  getByFloor(floor: number): Promise<RoomCleaningTask[]>;
  getPendingTasks(): Promise<RoomCleaningTask[]>;
  getUrgentTasks(): Promise<RoomCleaningTask[]>;
  getStats(): Promise<HousekeepingStats>;
  
  // Utility
  getRoomStatuses(): RoomStatus[];
  getPriorities(): CleaningPriority[];
}

// ============================================
// ERROR CLASS
// ============================================

export class HousekeepingServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'HousekeepingServiceError';
  }
}

// ============================================
// CONSTANTS
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROOM_STATUSES: RoomStatus[] = ['clean', 'dirty', 'in_progress', 'inspected', 'out_of_order'];
const PRIORITIES: CleaningPriority[] = ['low', 'medium', 'high', 'urgent'];

// ============================================
// FACTORY
// ============================================

export function createHousekeepingService(container: Container): HousekeepingService {
  const repository: HousekeepingRepository = container.housekeepingRepository;
  const logger: LoggerService = container.logger;

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  function validateUUID(id: string, field: string): void {
    if (!UUID_REGEX.test(id)) {
      throw new HousekeepingServiceError(`Invalid ${field} format`, `INVALID_${field.toUpperCase()}_ID`);
    }
  }

  function validateRoomNumber(roomNumber: string): void {
    if (!roomNumber || roomNumber.trim().length === 0) {
      throw new HousekeepingServiceError('Room number is required', 'INVALID_ROOM_NUMBER');
    }
  }

  function validateFloor(floor: number): void {
    if (!Number.isInteger(floor) || floor < 0) {
      throw new HousekeepingServiceError('Floor must be a non-negative integer', 'INVALID_FLOOR');
    }
  }

  function validatePriority(priority: CleaningPriority): void {
    if (!PRIORITIES.includes(priority)) {
      throw new HousekeepingServiceError(`Invalid priority: ${priority}`, 'INVALID_PRIORITY');
    }
  }

  function validateQuantity(quantity: number, fieldName: string): void {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new HousekeepingServiceError(`${fieldName} must be a non-negative integer`, 'INVALID_QUANTITY');
    }
  }

  // ============================================
  // TASK OPERATIONS
  // ============================================

  async function createTask(input: CreateTaskInput): Promise<RoomCleaningTask> {
    validateUUID(input.roomId, 'room');
    validateRoomNumber(input.roomNumber);
    validateFloor(input.floor);

    if (input.priority !== undefined) {
      validatePriority(input.priority);
    }

    // Check if task already exists for this room
    const existing = await repository.getTaskByRoomId(input.roomId);
    if (existing && !['clean', 'inspected'].includes(existing.status)) {
      throw new HousekeepingServiceError('Active task already exists for this room', 'TASK_ALREADY_EXISTS');
    }

    const task = await repository.createTask({
      roomId: input.roomId,
      roomNumber: input.roomNumber.trim(),
      floor: input.floor,
      assignedTo: null,
      status: 'dirty',
      priority: input.priority ?? 'medium',
      checkoutDate: input.checkoutDate ?? null,
      checkinDate: input.checkinDate ?? null,
      notes: input.notes?.trim() ?? null,
      startedAt: null,
      completedAt: null,
      inspectedBy: null,
      inspectedAt: null,
    });

    logger.info('Cleaning task created', { taskId: task.id, roomNumber: task.roomNumber });
    return task;
  }

  async function getTask(id: string): Promise<RoomCleaningTask | null> {
    validateUUID(id, 'task');
    return repository.getTaskById(id);
  }

  async function getTaskByRoom(roomId: string): Promise<RoomCleaningTask | null> {
    validateUUID(roomId, 'room');
    return repository.getTaskByRoomId(roomId);
  }

  async function updateTask(id: string, input: UpdateTaskInput): Promise<RoomCleaningTask> {
    validateUUID(id, 'task');

    const task = await repository.getTaskById(id);
    if (!task) {
      throw new HousekeepingServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (input.priority !== undefined) {
      validatePriority(input.priority);
    }

    const updated = await repository.updateTask(id, {
      ...(input.priority && { priority: input.priority }),
      ...(input.notes !== undefined && { notes: input.notes?.trim() ?? null }),
      ...(input.checkoutDate !== undefined && { checkoutDate: input.checkoutDate }),
      ...(input.checkinDate !== undefined && { checkinDate: input.checkinDate }),
    });

    logger.info('Task updated', { taskId: id });
    return updated;
  }

  async function deleteTask(id: string): Promise<void> {
    validateUUID(id, 'task');

    const task = await repository.getTaskById(id);
    if (!task) {
      throw new HousekeepingServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    await repository.deleteTask(id);
    logger.info('Task deleted', { taskId: id });
  }

  async function listTasks(filters?: HousekeepingFilters): Promise<RoomCleaningTask[]> {
    return repository.listTasks(filters);
  }

  // ============================================
  // WORKFLOW
  // ============================================

  async function assignTask(id: string, assignedTo: string): Promise<RoomCleaningTask> {
    validateUUID(id, 'task');
    validateUUID(assignedTo, 'assignee');

    const task = await repository.getTaskById(id);
    if (!task) {
      throw new HousekeepingServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (!['dirty', 'in_progress'].includes(task.status)) {
      throw new HousekeepingServiceError(
        `Cannot assign task with status: ${task.status}`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await repository.updateTask(id, { assignedTo });
    logger.info('Task assigned', { taskId: id, assignedTo });
    return updated;
  }

  async function unassignTask(id: string): Promise<RoomCleaningTask> {
    validateUUID(id, 'task');

    const task = await repository.getTaskById(id);
    if (!task) {
      throw new HousekeepingServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (!task.assignedTo) {
      throw new HousekeepingServiceError('Task is not assigned', 'NOT_ASSIGNED');
    }

    if (task.status === 'in_progress') {
      throw new HousekeepingServiceError('Cannot unassign in-progress task', 'TASK_IN_PROGRESS');
    }

    const updated = await repository.updateTask(id, { assignedTo: null });
    logger.info('Task unassigned', { taskId: id });
    return updated;
  }

  async function startCleaning(id: string): Promise<RoomCleaningTask> {
    validateUUID(id, 'task');

    const task = await repository.getTaskById(id);
    if (!task) {
      throw new HousekeepingServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status !== 'dirty') {
      throw new HousekeepingServiceError(
        `Cannot start cleaning for status: ${task.status}`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await repository.updateTask(id, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    });

    logger.info('Cleaning started', { taskId: id, roomNumber: task.roomNumber });
    return updated;
  }

  async function completeCleaning(id: string): Promise<RoomCleaningTask> {
    validateUUID(id, 'task');

    const task = await repository.getTaskById(id);
    if (!task) {
      throw new HousekeepingServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status !== 'in_progress') {
      throw new HousekeepingServiceError(
        'Only in-progress tasks can be completed',
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await repository.updateTask(id, {
      status: 'clean',
      completedAt: new Date().toISOString(),
    });

    logger.info('Cleaning completed', { taskId: id, roomNumber: task.roomNumber });
    return updated;
  }

  async function inspectRoom(id: string, inspectedBy: string, passed: boolean): Promise<RoomCleaningTask> {
    validateUUID(id, 'task');
    validateUUID(inspectedBy, 'inspector');

    const task = await repository.getTaskById(id);
    if (!task) {
      throw new HousekeepingServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    if (task.status !== 'clean') {
      throw new HousekeepingServiceError(
        'Only clean rooms can be inspected',
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await repository.updateTask(id, {
      status: passed ? 'inspected' : 'dirty',
      inspectedBy,
      inspectedAt: new Date().toISOString(),
      startedAt: passed ? task.startedAt : null,
      completedAt: passed ? task.completedAt : null,
    });

    logger.info('Room inspected', { taskId: id, passed });
    return updated;
  }

  async function markOutOfOrder(id: string, reason: string): Promise<RoomCleaningTask> {
    validateUUID(id, 'task');

    const task = await repository.getTaskById(id);
    if (!task) {
      throw new HousekeepingServiceError('Task not found', 'TASK_NOT_FOUND', 404);
    }

    const notes = reason
      ? (task.notes ? `${task.notes}\n\nOut of order: ${reason}` : `Out of order: ${reason}`)
      : task.notes;

    const updated = await repository.updateTask(id, {
      status: 'out_of_order',
      notes,
    });

    logger.info('Room marked out of order', { taskId: id, reason });
    return updated;
  }

  async function markDirty(roomId: string): Promise<RoomCleaningTask> {
    validateUUID(roomId, 'room');

    const existing = await repository.getTaskByRoomId(roomId);
    if (!existing) {
      throw new HousekeepingServiceError('No task found for this room', 'TASK_NOT_FOUND', 404);
    }

    const updated = await repository.updateTask(existing.id, {
      status: 'dirty',
      startedAt: null,
      completedAt: null,
      inspectedBy: null,
      inspectedAt: null,
    });

    logger.info('Room marked dirty', { roomId, taskId: existing.id });
    return updated;
  }

  // ============================================
  // SUPPLY OPERATIONS
  // ============================================

  async function createSupply(input: CreateSupplyInput): Promise<CleaningSupply> {
    if (!input.name || input.name.trim().length === 0) {
      throw new HousekeepingServiceError('Supply name is required', 'INVALID_SUPPLY_NAME');
    }

    validateQuantity(input.quantity, 'Quantity');
    validateQuantity(input.minQuantity, 'Minimum quantity');

    if (!input.unit || input.unit.trim().length === 0) {
      throw new HousekeepingServiceError('Unit is required', 'INVALID_UNIT');
    }

    const supply = await repository.createSupply({
      name: input.name.trim(),
      quantity: input.quantity,
      minQuantity: input.minQuantity,
      unit: input.unit.trim(),
      lastRestocked: null,
    });

    logger.info('Supply created', { supplyId: supply.id, name: supply.name });
    return supply;
  }

  async function getSupply(id: string): Promise<CleaningSupply | null> {
    validateUUID(id, 'supply');
    return repository.getSupplyById(id);
  }

  async function updateSupply(id: string, input: UpdateSupplyInput): Promise<CleaningSupply> {
    validateUUID(id, 'supply');

    const supply = await repository.getSupplyById(id);
    if (!supply) {
      throw new HousekeepingServiceError('Supply not found', 'SUPPLY_NOT_FOUND', 404);
    }

    if (input.quantity !== undefined) {
      validateQuantity(input.quantity, 'Quantity');
    }

    if (input.minQuantity !== undefined) {
      validateQuantity(input.minQuantity, 'Minimum quantity');
    }

    const updated = await repository.updateSupply(id, {
      ...(input.name && { name: input.name.trim() }),
      ...(input.quantity !== undefined && { quantity: input.quantity }),
      ...(input.minQuantity !== undefined && { minQuantity: input.minQuantity }),
      ...(input.unit && { unit: input.unit.trim() }),
    });

    logger.info('Supply updated', { supplyId: id });
    return updated;
  }

  async function deleteSupply(id: string): Promise<void> {
    validateUUID(id, 'supply');

    const supply = await repository.getSupplyById(id);
    if (!supply) {
      throw new HousekeepingServiceError('Supply not found', 'SUPPLY_NOT_FOUND', 404);
    }

    await repository.deleteSupply(id);
    logger.info('Supply deleted', { supplyId: id });
  }

  async function listSupplies(): Promise<CleaningSupply[]> {
    return repository.listSupplies();
  }

  async function getLowSupplies(): Promise<CleaningSupply[]> {
    return repository.getLowSupplies();
  }

  async function restockSupply(id: string, quantity: number): Promise<CleaningSupply> {
    validateUUID(id, 'supply');

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new HousekeepingServiceError('Restock quantity must be a positive integer', 'INVALID_QUANTITY');
    }

    const supply = await repository.getSupplyById(id);
    if (!supply) {
      throw new HousekeepingServiceError('Supply not found', 'SUPPLY_NOT_FOUND', 404);
    }

    const updated = await repository.updateSupply(id, {
      quantity: supply.quantity + quantity,
      lastRestocked: new Date().toISOString(),
    });

    logger.info('Supply restocked', { supplyId: id, quantity, newTotal: updated.quantity });
    return updated;
  }

  async function useSupply(id: string, quantity: number): Promise<CleaningSupply> {
    validateUUID(id, 'supply');

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new HousekeepingServiceError('Usage quantity must be a positive integer', 'INVALID_QUANTITY');
    }

    const supply = await repository.getSupplyById(id);
    if (!supply) {
      throw new HousekeepingServiceError('Supply not found', 'SUPPLY_NOT_FOUND', 404);
    }

    if (supply.quantity < quantity) {
      throw new HousekeepingServiceError('Insufficient supply quantity', 'INSUFFICIENT_QUANTITY');
    }

    const updated = await repository.updateSupply(id, {
      quantity: supply.quantity - quantity,
    });

    logger.info('Supply used', { supplyId: id, quantity, remaining: updated.quantity });
    return updated;
  }

  // ============================================
  // REPORTING
  // ============================================

  async function getByAssignee(assigneeId: string): Promise<RoomCleaningTask[]> {
    validateUUID(assigneeId, 'assignee');
    return repository.getTasksByAssignee(assigneeId);
  }

  async function getByFloor(floor: number): Promise<RoomCleaningTask[]> {
    validateFloor(floor);
    return repository.getTasksByFloor(floor);
  }

  async function getPendingTasks(): Promise<RoomCleaningTask[]> {
    const allTasks = await repository.listTasks();
    return allTasks.filter(t => ['dirty', 'in_progress'].includes(t.status));
  }

  async function getUrgentTasks(): Promise<RoomCleaningTask[]> {
    const allTasks = await repository.listTasks({ priority: 'urgent' });
    return allTasks.filter(t => !['clean', 'inspected'].includes(t.status));
  }

  async function getStats(): Promise<HousekeepingStats> {
    const tasks = await repository.listTasks();
    const lowSupplies = await repository.getLowSupplies();

    const byStatus: Record<RoomStatus, number> = {
      clean: 0,
      dirty: 0,
      in_progress: 0,
      inspected: 0,
      out_of_order: 0,
    };

    const byPriority: Record<CleaningPriority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };

    const byFloor: Record<number, number> = {};

    let totalCleaningTime = 0;
    let completedCount = 0;

    for (const task of tasks) {
      byStatus[task.status]++;
      byPriority[task.priority]++;
      byFloor[task.floor] = (byFloor[task.floor] || 0) + 1;

      if (task.startedAt && task.completedAt) {
        const start = new Date(task.startedAt).getTime();
        const end = new Date(task.completedAt).getTime();
        totalCleaningTime += (end - start) / 60000; // minutes
        completedCount++;
      }
    }

    return {
      totalTasks: tasks.length,
      byStatus,
      byPriority,
      byFloor,
      avgCleaningTimeMinutes: completedCount > 0 ? totalCleaningTime / completedCount : 0,
      lowSuppliesCount: lowSupplies.length,
    };
  }

  // ============================================
  // UTILITY
  // ============================================

  function getRoomStatuses(): RoomStatus[] {
    return [...ROOM_STATUSES];
  }

  function getPriorities(): CleaningPriority[] {
    return [...PRIORITIES];
  }

  return {
    createTask,
    getTask,
    getTaskByRoom,
    updateTask,
    deleteTask,
    listTasks,
    assignTask,
    unassignTask,
    startCleaning,
    completeCleaning,
    inspectRoom,
    markOutOfOrder,
    markDirty,
    createSupply,
    getSupply,
    updateSupply,
    deleteSupply,
    listSupplies,
    getLowSupplies,
    restockSupply,
    useSupply,
    getByAssignee,
    getByFloor,
    getPendingTasks,
    getUrgentTasks,
    getStats,
    getRoomStatuses,
    getPriorities,
  };
}
