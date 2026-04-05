/**
 * In-Memory Housekeeping Repository
 * Test double for HousekeepingRepository using in-memory data structures.
 */

import type {
  HousekeepingRepository,
  RoomCleaningTask,
  CleaningSupply,
  HousekeepingFilters,
} from '../container/types.js';

export class InMemoryHousekeepingRepository implements HousekeepingRepository {
  private tasks = new Map<string, RoomCleaningTask>();
  private supplies = new Map<string, CleaningSupply>();

  reset() {
    this.tasks.clear();
    this.supplies.clear();
  }

  // Task operations
  async createTask(data: Omit<RoomCleaningTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<RoomCleaningTask> {
    const id = crypto.randomUUID();
    const task: RoomCleaningTask = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, data: Partial<RoomCleaningTask>): Promise<RoomCleaningTask> {
    const existing = this.tasks.get(id);
    if (!existing) throw new Error(`Task ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
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
    for (const t of this.tasks.values()) {
      if (t.roomId === roomId) return t;
    }
    return null;
  }

  async listTasks(filters?: HousekeepingFilters): Promise<RoomCleaningTask[]> {
    let result = [...this.tasks.values()];
    if (filters?.status) result = result.filter(t => t.status === filters.status);
    if (filters?.priority) result = result.filter(t => t.priority === filters.priority);
    if (filters?.floor !== undefined) result = result.filter(t => t.floor === filters.floor);
    if (filters?.assignedTo) result = result.filter(t => t.assignedTo === filters.assignedTo);
    return result;
  }

  async getTasksByAssignee(assigneeId: string): Promise<RoomCleaningTask[]> {
    return [...this.tasks.values()].filter(t => t.assignedTo === assigneeId);
  }

  async getTasksByFloor(floor: number): Promise<RoomCleaningTask[]> {
    return [...this.tasks.values()].filter(t => t.floor === floor);
  }

  // Supply operations
  async createSupply(data: Omit<CleaningSupply, 'id'>): Promise<CleaningSupply> {
    const id = crypto.randomUUID();
    const supply: CleaningSupply = { ...data, id };
    this.supplies.set(id, supply);
    return supply;
  }

  async updateSupply(id: string, data: Partial<CleaningSupply>): Promise<CleaningSupply> {
    const existing = this.supplies.get(id);
    if (!existing) throw new Error(`Supply ${id} not found`);
    const updated = { ...existing, ...data };
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
    return [...this.supplies.values()];
  }

  async getLowSupplies(): Promise<CleaningSupply[]> {
    return [...this.supplies.values()].filter(s => s.quantity <= s.minQuantity);
  }
}
