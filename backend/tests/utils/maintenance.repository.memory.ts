import type { WorkOrder, WorkOrderPart, MaintenanceRepository } from '../../src/services/maintenance.service';

export class InMemoryMaintenanceRepository implements MaintenanceRepository {
  private orders = new Map<string, WorkOrder>();
  private parts = new Map<string, WorkOrderPart>();

  async findById(id: string): Promise<WorkOrder | null> { return this.orders.get(id) ?? null; }

  async findAll(filters?: { category?: string; priority?: string; status?: string; locationId?: string }): Promise<WorkOrder[]> {
    let result = [...this.orders.values()];
    if (filters?.category) result = result.filter(o => o.category === filters.category);
    if (filters?.priority) result = result.filter(o => o.priority === filters.priority);
    if (filters?.status) result = result.filter(o => o.status === filters.status);
    if (filters?.locationId) result = result.filter(o => o.locationId === filters.locationId);
    return result;
  }

  async save(o: WorkOrder): Promise<WorkOrder> { this.orders.set(o.id, { ...o }); return o; }
  async delete(id: string): Promise<void> { this.orders.delete(id); }

  async savePart(p: WorkOrderPart): Promise<WorkOrderPart> {
    this.parts.set(p.id, { ...p });
    return p;
  }

  async findParts(workOrderId: string): Promise<WorkOrderPart[]> {
    return [...this.parts.values()].filter(p => p.workOrderId === workOrderId);
  }
}
