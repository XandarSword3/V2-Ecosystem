/**
 * In-Memory Maintenance Repository
 *
 * Test double for work order/maintenance operations.
 */

import { v4 as uuidv4 } from 'uuid';
import type { WorkOrder, WorkOrderPart, WorkOrderFilters, MaintenanceRepository } from '../container/types.js';

export class InMemoryMaintenanceRepository implements MaintenanceRepository {
  private workOrders: Map<string, WorkOrder> = new Map();
  private parts: Map<string, WorkOrderPart> = new Map();

  // ============================================
  // WORK ORDER OPERATIONS
  // ============================================

  async create(workOrder: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkOrder> {
    const now = new Date().toISOString();
    const newOrder: WorkOrder = {
      ...workOrder,
      id: uuidv4(),
      createdAt: now,
      updatedAt: null,
    };
    this.workOrders.set(newOrder.id, newOrder);
    return newOrder;
  }

  async update(id: string, data: Partial<WorkOrder>): Promise<WorkOrder> {
    const order = this.workOrders.get(id);
    if (!order) {
      throw new Error('Work order not found');
    }
    
    const updated: WorkOrder = {
      ...order,
      ...data,
      id: order.id,
      createdAt: order.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.workOrders.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.workOrders.delete(id);
    // Also delete associated parts
    for (const [partId, part] of this.parts) {
      if (part.workOrderId === id) {
        this.parts.delete(partId);
      }
    }
  }

  async getById(id: string): Promise<WorkOrder | null> {
    return this.workOrders.get(id) ?? null;
  }

  async list(filters?: WorkOrderFilters): Promise<WorkOrder[]> {
    let result = Array.from(this.workOrders.values());

    if (filters?.status) {
      result = result.filter(o => o.status === filters.status);
    }

    if (filters?.priority) {
      result = result.filter(o => o.priority === filters.priority);
    }

    if (filters?.category) {
      result = result.filter(o => o.category === filters.category);
    }

    if (filters?.assignedTo) {
      result = result.filter(o => o.assignedTo === filters.assignedTo);
    }

    if (filters?.locationId) {
      result = result.filter(o => o.locationId === filters.locationId);
    }

    if (filters?.dateRange) {
      const { start, end } = filters.dateRange;
      result = result.filter(o => {
        const created = o.createdAt.split('T')[0];
        return created >= start && created <= end;
      });
    }

    return result;
  }

  async getByLocation(locationId: string): Promise<WorkOrder[]> {
    return Array.from(this.workOrders.values()).filter(o => o.locationId === locationId);
  }

  async getByAssignee(assignedTo: string): Promise<WorkOrder[]> {
    return Array.from(this.workOrders.values()).filter(o => o.assignedTo === assignedTo);
  }

  // ============================================
  // PARTS OPERATIONS
  // ============================================

  async addPart(part: Omit<WorkOrderPart, 'id' | 'createdAt'>): Promise<WorkOrderPart> {
    const now = new Date().toISOString();
    const newPart: WorkOrderPart = {
      ...part,
      id: uuidv4(),
      createdAt: now,
    };
    this.parts.set(newPart.id, newPart);
    return newPart;
  }

  async getParts(workOrderId: string): Promise<WorkOrderPart[]> {
    return Array.from(this.parts.values()).filter(p => p.workOrderId === workOrderId);
  }

  async deletePart(id: string): Promise<void> {
    this.parts.delete(id);
  }

  // ============================================
  // TEST HELPERS
  // ============================================

  addWorkOrder(order: WorkOrder): void {
    this.workOrders.set(order.id, order);
  }

  addPartDirect(part: WorkOrderPart): void {
    this.parts.set(part.id, part);
  }

  clear(): void {
    this.workOrders.clear();
    this.parts.clear();
  }

  getAll(): WorkOrder[] {
    return Array.from(this.workOrders.values());
  }

  getAllParts(): WorkOrderPart[] {
    return Array.from(this.parts.values());
  }
}
