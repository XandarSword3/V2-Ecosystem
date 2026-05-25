import { v4 as uuidv4 } from 'uuid';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';
export type MaintenanceCategory = 'plumbing' | 'electrical' | 'hvac' | 'carpentry' | 'painting' | 'cleaning' | 'landscaping' | 'equipment' | 'safety' | 'general';
export type WorkOrderStatus = 'open' | 'assigned' | 'in_progress' | 'pending_parts' | 'completed' | 'cancelled';

export interface WorkOrder {
  id: string; title: string; description: string;
  category: MaintenanceCategory; priority: MaintenancePriority; status: WorkOrderStatus;
  locationId: string; locationType: string;
  reportedBy: string; assignedTo: string | null;
  scheduledDate: string | null; startedAt: string | null; completedAt: string | null;
  estimatedHours: number | null; actualHours: number | null;
  laborCost: number | null; partsCost: number | null;
  notes: string | null; createdAt: string; updatedAt: string | null;
}

export interface WorkOrderPart {
  id: string; workOrderId: string; partName: string; partNumber?: string;
  quantity: number; unitCost: number; totalCost: number; createdAt: string;
}

export class MaintenanceServiceError extends Error {
  constructor(msg: string, public readonly code: string, public readonly statusCode = 400) {
    super(msg); this.name = 'MaintenanceServiceError';
  }
}

export interface MaintenanceRepository {
  findById(id: string): Promise<WorkOrder | null>;
  findAll(filters?: { category?: string; priority?: string; status?: string; locationId?: string }): Promise<WorkOrder[]>;
  save(o: WorkOrder): Promise<WorkOrder>;
  delete(id: string): Promise<void>;
  savePart(p: WorkOrderPart): Promise<WorkOrderPart>;
  findParts(workOrderId: string): Promise<WorkOrderPart[]>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITIES: MaintenancePriority[] = ['low', 'medium', 'high', 'critical'];
const CATEGORIES: MaintenanceCategory[] = ['plumbing', 'electrical', 'hvac', 'carpentry', 'painting', 'cleaning', 'landscaping', 'equipment', 'safety', 'general'];

export function createMaintenanceService(container: { maintenanceRepository: MaintenanceRepository; logger?: any }) {
  const { maintenanceRepository: repo } = container;

  function validate(id: string, code: string) {
    if (!UUID_RE.test(id)) throw new MaintenanceServiceError(`Invalid UUID`, code);
  }

  async function getOrThrow(id: string): Promise<WorkOrder> {
    validate(id, 'INVALID_WORK_ORDER_ID');
    const o = await repo.findById(id);
    if (!o) throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    return o;
  }

  return {
    async createWorkOrder(input: {
      title: string; description: string; category: string; priority: string;
      locationId: string; locationType: string; reportedBy: string;
      estimatedHours?: number; scheduledDate?: string; notes?: string;
    }): Promise<WorkOrder> {
      if (!input.title || input.title.trim().length < 3) throw new MaintenanceServiceError('Title too short', 'INVALID_TITLE');
      if (!input.description?.trim()) throw new MaintenanceServiceError('Description required', 'INVALID_DESCRIPTION');
      if (!CATEGORIES.includes(input.category as MaintenanceCategory)) throw new MaintenanceServiceError('Invalid category', 'INVALID_CATEGORY');
      if (!PRIORITIES.includes(input.priority as MaintenancePriority)) throw new MaintenanceServiceError('Invalid priority', 'INVALID_PRIORITY');
      if (!UUID_RE.test(input.locationId)) throw new MaintenanceServiceError('Invalid location ID', 'INVALID_LOCATION_ID');
      if (input.estimatedHours !== undefined && input.estimatedHours < 0) throw new MaintenanceServiceError('Hours must be non-negative', 'INVALID_HOURS');

      const now = new Date().toISOString();
      return repo.save({
        id: uuidv4(), title: input.title.trim(), description: input.description.trim(),
        category: input.category as MaintenanceCategory, priority: input.priority as MaintenancePriority,
        status: 'open', locationId: input.locationId, locationType: input.locationType,
        reportedBy: input.reportedBy, assignedTo: null,
        scheduledDate: input.scheduledDate ?? null, startedAt: null, completedAt: null,
        estimatedHours: input.estimatedHours ?? null, actualHours: null,
        laborCost: null, partsCost: null, notes: input.notes ?? null,
        createdAt: now, updatedAt: null,
      });
    },

    async getWorkOrder(id: string): Promise<WorkOrder | null> {
      validate(id, 'INVALID_WORK_ORDER_ID');
      return repo.findById(id);
    },

    async updateWorkOrder(id: string, updates: Partial<Pick<WorkOrder, 'title' | 'description' | 'priority' | 'scheduledDate' | 'estimatedHours' | 'notes'>>): Promise<WorkOrder> {
      const o = await getOrThrow(id);
      return repo.save({ ...o, ...updates, updatedAt: new Date().toISOString() });
    },

    async deleteWorkOrder(id: string): Promise<void> {
      const o = await getOrThrow(id);
      await repo.delete(o.id);
    },

    async assignWorkOrder(id: string, technicianId: string): Promise<WorkOrder> {
      if (!UUID_RE.test(technicianId)) throw new MaintenanceServiceError('Invalid assignee', 'INVALID_ASSIGNEE_ID');
      const o = await getOrThrow(id);
      return repo.save({ ...o, assignedTo: technicianId, status: 'assigned', updatedAt: new Date().toISOString() });
    },

    async unassignWorkOrder(id: string): Promise<WorkOrder> {
      const o = await getOrThrow(id);
      if (o.status !== 'assigned') throw new MaintenanceServiceError('Invalid transition', 'INVALID_STATUS_TRANSITION');
      return repo.save({ ...o, assignedTo: null, status: 'open', updatedAt: new Date().toISOString() });
    },

    async startWorkOrder(id: string): Promise<WorkOrder> {
      const o = await getOrThrow(id);
      if (o.status !== 'assigned') throw new MaintenanceServiceError('Must be assigned first', 'INVALID_STATUS_TRANSITION');
      return repo.save({ ...o, status: 'in_progress', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    },

    async setPendingParts(id: string): Promise<WorkOrder> {
      const o = await getOrThrow(id);
      if (!['assigned', 'in_progress'].includes(o.status)) throw new MaintenanceServiceError('Invalid transition', 'INVALID_STATUS_TRANSITION');
      return repo.save({ ...o, status: 'pending_parts', updatedAt: new Date().toISOString() });
    },

    async completeWorkOrder(id: string, input: { actualHours?: number; laborCost?: number; notes?: string }): Promise<WorkOrder> {
      const o = await getOrThrow(id);
      if (!['in_progress', 'pending_parts'].includes(o.status)) throw new MaintenanceServiceError('Must be in progress', 'INVALID_STATUS_TRANSITION');
      if (input.actualHours !== undefined && input.actualHours < 0) throw new MaintenanceServiceError('Hours must be non-negative', 'INVALID_HOURS');

      const parts = await repo.findParts(id);
      const partsCost = parts.reduce((s, p) => s + p.totalCost, 0) || null;

      return repo.save({
        ...o, status: 'completed',
        actualHours: input.actualHours ?? null,
        laborCost: input.laborCost ?? null,
        partsCost,
        notes: input.notes ?? o.notes,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },

    async cancelWorkOrder(id: string, reason?: string): Promise<WorkOrder> {
      const o = await getOrThrow(id);
      if (o.status === 'cancelled') throw new MaintenanceServiceError('Already cancelled', 'ALREADY_CANCELLED');
      const notes = reason ? `${o.notes ? o.notes + '\n' : ''}Cancellation: ${reason}` : o.notes;
      return repo.save({ ...o, status: 'cancelled', notes, updatedAt: new Date().toISOString() });
    },

    async reopenWorkOrder(id: string): Promise<WorkOrder> {
      const o = await getOrThrow(id);
      if (o.status !== 'cancelled') throw new MaintenanceServiceError('Only cancelled can be reopened', 'INVALID_STATUS_TRANSITION');
      return repo.save({ ...o, status: 'open', assignedTo: null, updatedAt: new Date().toISOString() });
    },

    async addPart(input: { workOrderId: string; partName: string; partNumber?: string; quantity: number; unitCost: number }): Promise<WorkOrderPart> {
      await getOrThrow(input.workOrderId);
      if (!input.partName?.trim()) throw new MaintenanceServiceError('Part name required', 'INVALID_PART_NAME');
      if (input.quantity <= 0) throw new MaintenanceServiceError('Quantity must be positive', 'INVALID_QUANTITY');
      if (input.unitCost < 0) throw new MaintenanceServiceError('Unit cost cannot be negative', 'INVALID_UNIT_COST');
      return repo.savePart({
        id: uuidv4(), workOrderId: input.workOrderId, partName: input.partName.trim(),
        partNumber: input.partNumber, quantity: input.quantity, unitCost: input.unitCost,
        totalCost: Math.round(input.quantity * input.unitCost * 100) / 100,
        createdAt: new Date().toISOString(),
      });
    },

    async getParts(workOrderId: string): Promise<WorkOrderPart[]> {
      await getOrThrow(workOrderId);
      return repo.findParts(workOrderId);
    },

    async listWorkOrders(filters?: { category?: string; priority?: string; status?: string; locationId?: string }): Promise<WorkOrder[]> {
      return repo.findAll(filters);
    },

    async getByLocation(locationId: string): Promise<WorkOrder[]> {
      return repo.findAll({ locationId });
    },

    async getOpenWorkOrders(): Promise<WorkOrder[]> {
      return (await repo.findAll()).filter(o => !['completed', 'cancelled'].includes(o.status));
    },

    async getCriticalWorkOrders(): Promise<WorkOrder[]> {
      return (await repo.findAll()).filter(o => o.priority === 'critical' && !['completed', 'cancelled'].includes(o.status));
    },

    async getStats() {
      const all = await repo.findAll();
      const byStatus: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      let totalHours = 0; let completedCount = 0;
      for (const o of all) {
        byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
        byCategory[o.category] = (byCategory[o.category] ?? 0) + 1;
        if (o.status === 'completed' && o.actualHours) { totalHours += o.actualHours; completedCount++; }
      }
      return { totalWorkOrders: all.length, byStatus, byCategory, avgCompletionHours: completedCount ? totalHours / completedCount : 0 };
    },

    getPriorities(): MaintenancePriority[] { return [...PRIORITIES]; },
    getStatuses(): WorkOrderStatus[] { return ['open', 'assigned', 'in_progress', 'pending_parts', 'completed', 'cancelled']; },
    getCategories(): MaintenanceCategory[] { return [...CATEGORIES]; },
  };
}
