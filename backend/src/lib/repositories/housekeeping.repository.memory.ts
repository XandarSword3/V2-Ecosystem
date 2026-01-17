/**
 * In-Memory Housekeeping Repository
 *
 * Test double for housekeeping/room cleaning operations.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  RoomCleaningTask,
  CleaningSupply,
  HousekeepingFilters,
  HousekeepingRepository,
} from '../container/types.js';

export class InMemoryHousekeepingRepository implements HousekeepingRepository {
  private tasks: Map<string, RoomCleaningTask> = new Map();
  private supplies: Map<string, CleaningSupply> = new Map();

  // ============================================
  // TASK OPERATIONS
  // ============================================

  async createTask(task: Omit<RoomCleaningTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<RoomCleaningTask> {
    const now = new Date().toISOString();
    const newTask: RoomCleaningTask = {
      ...task,
      id: uuidv4(),
      createdAt: now,
      updatedAt: null,
    };
    this.tasks.set(newTask.id, newTask);
    return newTask;
  }

  async updateTask(id: string, data: Partial<RoomCleaningTask>): Promise<RoomCleaningTask> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error('Task not found');
    }

    const updated: RoomCleaningTask = {
      ...task,
      ...data,
      id: task.id,
      createdAt: task.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    this.tasks.delete(id);
  }

  async getTaskById(id: string): Promise<RoomCleaningTask | null> {
    return this.tasks.get(id) ?? null;
  }

  async getTaskByRoomId(roomId: string): Promise<RoomCleaningTask | null> {
    for (const task of this.tasks.values()) {
      if (task.roomId === roomId) {
        return task;
      }
    }
    return null;
  }

  async listTasks(filters?: HousekeepingFilters): Promise<RoomCleaningTask[]> {
    let result = Array.from(this.tasks.values());

    if (filters?.status) {
      result = result.filter(t => t.status === filters.status);
    }

    if (filters?.priority) {
      result = result.filter(t => t.priority === filters.priority);
    }

    if (filters?.floor !== undefined) {
      result = result.filter(t => t.floor === filters.floor);
    }

    if (filters?.assignedTo) {
      result = result.filter(t => t.assignedTo === filters.assignedTo);
    }

    if (filters?.dateRange) {
      const { start, end } = filters.dateRange;
      result = result.filter(t => {
        const created = t.createdAt.split('T')[0];
        return created >= start && created <= end;
      });
    }

    return result;
  }

  async getTasksByAssignee(assigneeId: string): Promise<RoomCleaningTask[]> {
    return Array.from(this.tasks.values()).filter(t => t.assignedTo === assigneeId);
  }

  async getTasksByFloor(floor: number): Promise<RoomCleaningTask[]> {
    return Array.from(this.tasks.values()).filter(t => t.floor === floor);
  }

  // ============================================
  // SUPPLY OPERATIONS
  // ============================================

  async createSupply(supply: Omit<CleaningSupply, 'id'>): Promise<CleaningSupply> {
    const newSupply: CleaningSupply = {
      ...supply,
      id: uuidv4(),
    };
    this.supplies.set(newSupply.id, newSupply);
    return newSupply;
  }

  async updateSupply(id: string, data: Partial<CleaningSupply>): Promise<CleaningSupply> {
    const supply = this.supplies.get(id);
    if (!supply) {
      throw new Error('Supply not found');
    }

    const updated: CleaningSupply = {
      ...supply,
      ...data,
      id: supply.id,
    };
    this.supplies.set(id, updated);
    return updated;
  }

  async deleteSupply(id: string): Promise<void> {
    this.supplies.delete(id);
  }

  async getSupplyById(id: string): Promise<CleaningSupply | null> {
    return this.supplies.get(id) ?? null;
  }

  async listSupplies(): Promise<CleaningSupply[]> {
    return Array.from(this.supplies.values());
  }

  async getLowSupplies(): Promise<CleaningSupply[]> {
    return Array.from(this.supplies.values()).filter(s => s.quantity <= s.minQuantity);
  }

  // ============================================
  // TEST HELPERS
  // ============================================

  addTask(task: RoomCleaningTask): void {
    this.tasks.set(task.id, task);
  }

  addSupply(supply: CleaningSupply): void {
    this.supplies.set(supply.id, supply);
  }

  clear(): void {
    this.tasks.clear();
    this.supplies.clear();
  }

  getAllTasks(): RoomCleaningTask[] {
    return Array.from(this.tasks.values());
  }

  getAllSupplies(): CleaningSupply[] {
    return Array.from(this.supplies.values());
  }
}
