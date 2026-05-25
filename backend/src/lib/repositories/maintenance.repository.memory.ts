import type { WorkOrder, WorkOrderPart } from '../container/types';

export class InMemoryMaintenanceRepository {
  private orders: Map<string, WorkOrder> = new Map();
  private parts: Map<string, WorkOrderPart[]> = new Map();

  async findById(id: string): Promise<WorkOrder | null> { return this.orders.get(id) ?? null; }
  async findAll(filters?: { category?: string; priority?: string; status?: string; locationId?: string }): Promise<WorkOrder[]> {
    let res = Array.from(this.orders.values());
    if (filters?.category) res = res.filter(o => o.category === filters.category);
    if (filters?.priority) res = res.filter(o => o.priority === filters.priority);
    if (filters?.status) res = res.filter(o => o.status === filters.status);
    if (filters?.locationId) res = res.filter(o => o.locationId === filters.locationId);
    return res;
  }
  async save(order: WorkOrder): Promise<WorkOrder> { this.orders.set(order.id, { ...order }); return order; }
  async delete(id: string): Promise<void> { this.orders.delete(id); }
  async savePart(part: WorkOrderPart): Promise<WorkOrderPart> {
    const list = this.parts.get(part.workOrderId) ?? [];
    list.push({ ...part });
    this.parts.set(part.workOrderId, list);
    return part;
  }
  async findParts(workOrderId: string): Promise<WorkOrderPart[]> { return this.parts.get(workOrderId) ?? []; }
}
