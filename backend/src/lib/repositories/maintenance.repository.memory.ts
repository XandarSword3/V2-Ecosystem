/**
 * In-Memory Maintenance Repository
 * Test double for MaintenanceRepository using in-memory data structures.
 */

import type {
  MaintenanceRepository,
  WorkOrder,
  WorkOrderPart,
  WorkOrderFilters,
} from '../container/types.js';

export class InMemoryMaintenanceRepository implements MaintenanceRepository {
  private workOrders = new Map<string, WorkOrder>();
  private parts: WorkOrderPart[] = [];

  reset() {
    this.workOrders.clear();
    this.parts = [];
  }

  async create(data: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkOrder> {
    const id = crypto.randomUUID();
    const wo: WorkOrder = { ...data, id, createdAt: new Date().toISOString(), updatedAt: null };
    this.workOrders.set(id, wo);
    return wo;
  }

  async update(id: string, data: Partial<WorkOrder>): Promise<WorkOrder> {
    const existing = this.workOrders.get(id);
    if (!existing) throw new Error(`WorkOrder ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    this.workOrders.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.workOrders.delete(id);
  }

  async getById(id: string): Promise<WorkOrder | null> {
    return this.workOrders.get(id) ?? null;
  }

  async list(filters?: WorkOrderFilters): Promise<WorkOrder[]> {
    let result = [...this.workOrders.values()];
    if (filters?.status) result = result.filter(w => w.status === filters.status);
    if (filters?.priority) result = result.filter(w => w.priority === filters.priority);
    if (filters?.category) result = result.filter(w => w.category === filters.category);
    if (filters?.assignedTo) result = result.filter(w => w.assignedTo === filters.assignedTo);
    if (filters?.locationId) result = result.filter(w => w.locationId === filters.locationId);
    return result;
  }

  async getByLocation(locationId: string): Promise<WorkOrder[]> {
    return [...this.workOrders.values()].filter(w => w.locationId === locationId);
  }

  async getByAssignee(assignedTo: string): Promise<WorkOrder[]> {
    return [...this.workOrders.values()].filter(w => w.assignedTo === assignedTo);
  }

  async addPart(data: Omit<WorkOrderPart, 'id' | 'createdAt'>): Promise<WorkOrderPart> {
    const part: WorkOrderPart = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    this.parts.push(part);
    return part;
  }

  async getParts(workOrderId: string): Promise<WorkOrderPart[]> {
    return this.parts.filter(p => p.workOrderId === workOrderId);
  }

  async deletePart(id: string): Promise<void> {
    this.parts = this.parts.filter(p => p.id !== id);
  }
}
