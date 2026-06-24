import { randomUUID } from 'crypto';
import type { Container, WorkOrder, WorkOrderPart, MaintenanceCategory, MaintenancePriority, LocationType } from '../container/types';
import type { InMemoryMaintenanceRepository } from '../repositories/maintenance.repository.memory';

export class MaintenanceServiceError extends Error {
  code: string;
  statusCode: number;
  constructor(codeOrMessage: string, messageOrCode: string, statusCode = 400) {
    const isCodeFirst = /^[A-Z_0-9]{3,}$/.test(codeOrMessage);
    if (isCodeFirst) {
      super(messageOrCode);
      this.code = codeOrMessage;
      this.statusCode = statusCode;
    } else {
      super(codeOrMessage);
      this.code = messageOrCode;
      this.statusCode = statusCode;
    }
    this.name = 'MaintenanceServiceError';
  }
}

const VALID_CATEGORIES: MaintenanceCategory[] = ['plumbing','electrical','hvac','carpentry','painting','cleaning','landscaping','appliance','structural','safety','it','general'];
const VALID_PRIORITIES: MaintenancePriority[] = ['low','medium','high','critical'];
const VALID_LOCATION_TYPES: LocationType[] = ['room','lobby','aquatic_area','gym','dining_area','parking','exterior','common_area','office','other'];

function isUUID(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }

export function createMaintenanceService(container: Container) {
  const repo = container.maintenanceRepository as InMemoryMaintenanceRepository;

  async function getOrThrow(id: string): Promise<WorkOrder> {
    if (!isUUID(id)) throw new MaintenanceServiceError('INVALID_WORK_ORDER_ID', 'Invalid ID format');
    const o = await repo.findById(id);
    if (!o) throw new MaintenanceServiceError('WORK_ORDER_NOT_FOUND', 'Work order not found');
    return o;
  }

  return {
    async createWorkOrder(input: { title: string; description: string; category: MaintenanceCategory; priority: MaintenancePriority; locationId: string; locationType: LocationType; reportedBy: string; assignedTo?: string; scheduledDate?: string; estimatedHours?: number; notes?: string }) {
      const title = input.title?.trim() ?? '';
      const description = input.description?.trim() ?? '';
      if (title.length < 3) throw new MaintenanceServiceError('INVALID_TITLE', 'Title too short');
      if (!description) throw new MaintenanceServiceError('INVALID_DESCRIPTION', 'Description required');
      if (!VALID_CATEGORIES.includes(input.category)) throw new MaintenanceServiceError('INVALID_CATEGORY', 'Invalid category');
      if (!VALID_PRIORITIES.includes(input.priority)) throw new MaintenanceServiceError('INVALID_PRIORITY', 'Invalid priority');
      if (!isUUID(input.locationId)) throw new MaintenanceServiceError('INVALID_LOCATION_ID', 'Invalid location ID');
      if (!isUUID(input.reportedBy)) throw new MaintenanceServiceError('INVALID_REPORTER_ID', 'Invalid reporter ID');
      if (!input.locationType || !VALID_LOCATION_TYPES.includes(input.locationType)) {
        throw new MaintenanceServiceError('INVALID_LOCATION_TYPE', 'Invalid location type');
      }
      if (input.estimatedHours !== undefined && input.estimatedHours < 0) throw new MaintenanceServiceError('INVALID_HOURS', 'Hours must be non-negative');
      const now = new Date().toISOString();
      const order: WorkOrder = {
        id: randomUUID(),
        title, description,
        category: input.category, priority: input.priority,
        status: 'open',
        locationId: input.locationId, locationType: input.locationType,
        reportedBy: input.reportedBy, assignedTo: input.assignedTo ?? null,
        scheduledDate: input.scheduledDate ?? null,
        startedAt: null, completedAt: null,
        estimatedHours: input.estimatedHours ?? null,
        actualHours: null, laborCost: null, partsCost: null,
        notes: input.notes ?? null,
        createdAt: now, updatedAt: null,
      };
      return repo.save(order);
    },

    async getWorkOrder(id: string) {
      if (!isUUID(id)) throw new MaintenanceServiceError('INVALID_WORK_ORDER_ID', 'Invalid ID format');
      return repo.findById(id);
    },

    async updateWorkOrder(id: string, updates: Partial<WorkOrder>) {
      const o = await getOrThrow(id);
      if (o.status === 'completed' || o.status === 'cancelled') {
        throw new MaintenanceServiceError('WORK_ORDER_FINALIZED', 'Cannot update finalized work order');
      }
      let title = updates.title;
      if (title !== undefined) {
        title = title.trim();
        if (title.length < 3) throw new MaintenanceServiceError('INVALID_TITLE', 'Title too short');
      }
      let description = updates.description;
      if (description !== undefined) {
        description = description.trim();
        if (!description) throw new MaintenanceServiceError('INVALID_DESCRIPTION', 'Description required');
      }
      if (updates.priority !== undefined && !VALID_PRIORITIES.includes(updates.priority)) {
        throw new MaintenanceServiceError('INVALID_PRIORITY', 'Invalid priority');
      }
      if (updates.category !== undefined && !VALID_CATEGORIES.includes(updates.category)) {
        throw new MaintenanceServiceError('INVALID_CATEGORY', 'Invalid category');
      }
      if (updates.estimatedHours != null && updates.estimatedHours < 0) throw new MaintenanceServiceError('INVALID_HOURS', 'Hours must be non-negative');
      const finalUpdates = { ...updates };
      if (title !== undefined) finalUpdates.title = title;
      if (description !== undefined) finalUpdates.description = description;
      return repo.save({ ...o, ...finalUpdates, updatedAt: new Date().toISOString() });
    },

    async deleteWorkOrder(id: string) {
      if (!isUUID(id)) throw new MaintenanceServiceError('INVALID_WORK_ORDER_ID', 'Invalid ID format');
      const o = await repo.findById(id);
      if (!o) throw new MaintenanceServiceError('WORK_ORDER_NOT_FOUND', 'Work order not found');
      await repo.delete(id);
    },

    async assignWorkOrder(id: string, assigneeId: string) {
      if (!isUUID(assigneeId)) throw new MaintenanceServiceError('INVALID_ASSIGNEE_ID', 'Invalid assignee ID');
      const o = await getOrThrow(id);
      if (o.status !== 'open' && o.status !== 'assigned') {
        throw new MaintenanceServiceError('INVALID_STATUS_TRANSITION', 'Can only assign open or assigned work orders');
      }
      return repo.save({ ...o, assignedTo: assigneeId, status: 'assigned', updatedAt: new Date().toISOString() });
    },

    async unassignWorkOrder(id: string) {
      const o = await getOrThrow(id);
      if (o.status !== 'assigned') throw new MaintenanceServiceError('INVALID_STATUS_TRANSITION', 'Order must be assigned');
      return repo.save({ ...o, assignedTo: null, status: 'open', updatedAt: new Date().toISOString() });
    },

    async startWorkOrder(id: string) {
      const o = await getOrThrow(id);
      if (o.status !== 'assigned' && o.status !== 'pending_parts') {
        throw new MaintenanceServiceError('INVALID_STATUS_TRANSITION', 'Must be assigned or pending parts first');
      }
      const startedAt = o.startedAt ?? new Date().toISOString();
      return repo.save({ ...o, status: 'in_progress', startedAt, updatedAt: new Date().toISOString() });
    },

    async setPendingParts(id: string) {
      const o = await getOrThrow(id);
      if (o.status !== 'assigned' && o.status !== 'in_progress') throw new MaintenanceServiceError('INVALID_STATUS_TRANSITION', 'Invalid transition');
      return repo.save({ ...o, status: 'pending_parts', updatedAt: new Date().toISOString() });
    },

    async completeWorkOrder(id: string, input: { actualHours?: number; laborCost?: number; notes?: string }) {
      if (input.actualHours !== undefined && input.actualHours < 0) throw new MaintenanceServiceError('INVALID_HOURS', 'Hours must be non-negative');
      const o = await getOrThrow(id);
      if (o.status !== 'in_progress' && o.status !== 'pending_parts') throw new MaintenanceServiceError('INVALID_STATUS_TRANSITION', 'Must be in progress');
      const parts = await repo.findParts(id);
      const partsCost = parts.reduce((s, p) => s + p.totalCost, 0);
      const now = new Date().toISOString();
      const notes = input.notes ? `${o.notes ? o.notes + '\n' : ''}${input.notes}` : o.notes;
      return repo.save({ ...o, status: 'completed', completedAt: now, actualHours: input.actualHours ?? null, laborCost: input.laborCost ?? null, partsCost, notes, updatedAt: now });
    },

    async cancelWorkOrder(id: string, reason?: string) {
      const o = await getOrThrow(id);
      if (o.status === 'cancelled') throw new MaintenanceServiceError('ALREADY_CANCELLED', 'Already cancelled');
      if (o.status === 'completed') throw new MaintenanceServiceError('WORK_ORDER_COMPLETED', 'Cannot cancel completed work order');
      const notes = reason ? `${o.notes ? o.notes + '\n\n' : ''}Cancellation: ${reason}` : o.notes;
      return repo.save({ ...o, status: 'cancelled', notes, updatedAt: new Date().toISOString() });
    },

    async reopenWorkOrder(id: string) {
      const o = await getOrThrow(id);
      if (o.status !== 'cancelled') throw new MaintenanceServiceError('INVALID_STATUS_TRANSITION', 'Only cancelled can be reopened');
      return repo.save({ ...o, status: 'open', assignedTo: null, updatedAt: new Date().toISOString() });
    },

    async addPart(input: { workOrderId: string; partName: string; partNumber?: string; quantity: number; unitCost: number; supplier?: string; notes?: string }) {
      await getOrThrow(input.workOrderId);
      if (!input.partName.trim()) throw new MaintenanceServiceError('INVALID_PART_NAME', 'Part name required');
      if (input.quantity < 1 || !Number.isInteger(input.quantity)) throw new MaintenanceServiceError('INVALID_QUANTITY', 'Quantity must be at least 1');
      if (input.unitCost < 0) throw new MaintenanceServiceError('INVALID_UNIT_COST', 'Unit cost cannot be negative');
      const part: WorkOrderPart = {
        id: randomUUID(),
        workOrderId: input.workOrderId,
        partName: input.partName,
        partNumber: input.partNumber ?? null,
        quantity: input.quantity,
        unitCost: input.unitCost,
        totalCost: input.quantity * input.unitCost,
        supplier: input.supplier ?? null,
        notes: input.notes ?? null,
      };
      return repo.savePart(part);
    },

    async getParts(workOrderId: string) {
      await getOrThrow(workOrderId);
      return repo.findParts(workOrderId);
    },

    async removePart(partId: string) {
      if (!isUUID(partId)) throw new MaintenanceServiceError('INVALID_PART_ID', 'Invalid part ID');
      if (typeof (repo as any).deletePart === 'function') {
        return (repo as any).deletePart(partId);
      }
    },

    async listWorkOrders(filters?: { category?: string; priority?: string; status?: string; locationId?: string }) {
      return repo.findAll(filters);
    },

    async getByLocation(locationId: string) {
      if (!isUUID(locationId)) throw new MaintenanceServiceError('INVALID_LOCATION_ID', 'Invalid location ID');
      if (typeof (repo as any).getByLocation === 'function') {
        return (repo as any).getByLocation(locationId);
      }
      return repo.findAll({ locationId });
    },

    async getByAssignee(assigneeId: string) {
      if (!isUUID(assigneeId)) throw new MaintenanceServiceError('INVALID_ASSIGNEE_ID', 'Invalid assignee ID');
      if (typeof (repo as any).getByAssignee === 'function') {
        return (repo as any).getByAssignee(assigneeId);
      }
      const all = await repo.findAll();
      return all.filter(o => o.assignedTo === assigneeId);
    },

    async getOpenWorkOrders() {
      const all = await repo.findAll();
      return all.filter(o => !['completed', 'cancelled'].includes(o.status));
    },

    async getCriticalWorkOrders() {
      const all = await repo.findAll({ priority: 'critical' });
      return all.filter(o => !['completed', 'cancelled'].includes(o.status));
    },

    async getStats() {
      const all = await repo.findAll();
      const byStatus = all.reduce((acc, o) => { acc[o.status] = (acc[o.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
      const byCategory = all.reduce((acc, o) => { acc[o.category] = (acc[o.category] ?? 0) + 1; return acc; }, {} as Record<string, number>);
      const byPriority = all.reduce((acc, o) => { acc[o.priority] = (acc[o.priority] ?? 0) + 1; return acc; }, {} as Record<string, number>);
      const completed = all.filter(o => o.status === 'completed');
      const completedWithHours = completed.filter(o => o.actualHours);
      const avgHours = completedWithHours.length ? completedWithHours.reduce((s, o) => s + (o.actualHours ?? 0), 0) / completedWithHours.length : 0;
      const totalLaborCost = completed.reduce((s, o) => s + (o.laborCost ?? 0), 0);
      const totalPartsCost = completed.reduce((s, o) => s + (o.partsCost ?? 0), 0);
      return {
        totalWorkOrders: all.length,
        byStatus,
        byCategory,
        byPriority,
        avgCompletionHours: avgHours,
        totalLaborCost,
        totalPartsCost,
      };
    },

    getPriorities() { return [...VALID_PRIORITIES]; },
    getStatuses() { return ['open','assigned','in_progress','pending_parts','completed','cancelled']; },
    getCategories() { return [...VALID_CATEGORIES]; },
  };
}
