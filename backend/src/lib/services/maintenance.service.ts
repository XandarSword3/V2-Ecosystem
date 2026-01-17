/**
 * Maintenance Service
 *
 * Business logic for work order management with DI.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Container,
  MaintenanceRepository,
  WorkOrder,
  WorkOrderPart,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderCategory,
  WorkOrderFilters,
  LoggerService,
} from '../container/types.js';

// ============================================
// TYPES
// ============================================

export interface CreateWorkOrderInput {
  title: string;
  description: string;
  category: WorkOrderCategory;
  priority: WorkOrderPriority;
  locationId: string;
  locationType: string;
  reportedBy: string;
  scheduledDate?: string;
  estimatedHours?: number;
  notes?: string;
}

export interface UpdateWorkOrderInput {
  title?: string;
  description?: string;
  priority?: WorkOrderPriority;
  scheduledDate?: string;
  estimatedHours?: number;
  notes?: string;
}

export interface AddPartInput {
  workOrderId: string;
  partName: string;
  partNumber?: string;
  quantity: number;
  unitCost: number;
}

export interface CompleteWorkOrderInput {
  actualHours: number;
  laborCost?: number;
  notes?: string;
}

export interface MaintenanceStats {
  totalWorkOrders: number;
  byStatus: Record<WorkOrderStatus, number>;
  byPriority: Record<WorkOrderPriority, number>;
  byCategory: Record<WorkOrderCategory, number>;
  avgCompletionHours: number;
  totalLaborCost: number;
  totalPartsCost: number;
}

export interface MaintenanceService {
  // Work order operations
  createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder>;
  getWorkOrder(id: string): Promise<WorkOrder | null>;
  updateWorkOrder(id: string, input: UpdateWorkOrderInput): Promise<WorkOrder>;
  deleteWorkOrder(id: string): Promise<void>;
  listWorkOrders(filters?: WorkOrderFilters): Promise<WorkOrder[]>;
  
  // Workflow
  assignWorkOrder(id: string, assignedTo: string): Promise<WorkOrder>;
  unassignWorkOrder(id: string): Promise<WorkOrder>;
  startWorkOrder(id: string): Promise<WorkOrder>;
  setPendingParts(id: string): Promise<WorkOrder>;
  completeWorkOrder(id: string, input: CompleteWorkOrderInput): Promise<WorkOrder>;
  cancelWorkOrder(id: string, reason?: string): Promise<WorkOrder>;
  reopenWorkOrder(id: string): Promise<WorkOrder>;
  
  // Parts management
  addPart(input: AddPartInput): Promise<WorkOrderPart>;
  getParts(workOrderId: string): Promise<WorkOrderPart[]>;
  removePart(partId: string): Promise<void>;
  
  // Reporting
  getByLocation(locationId: string): Promise<WorkOrder[]>;
  getByAssignee(assigneeId: string): Promise<WorkOrder[]>;
  getOpenWorkOrders(): Promise<WorkOrder[]>;
  getCriticalWorkOrders(): Promise<WorkOrder[]>;
  getStats(): Promise<MaintenanceStats>;
  
  // Utility
  getPriorities(): WorkOrderPriority[];
  getStatuses(): WorkOrderStatus[];
  getCategories(): WorkOrderCategory[];
}

// ============================================
// ERROR CLASS
// ============================================

export class MaintenanceServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'MaintenanceServiceError';
  }
}

// ============================================
// CONSTANTS
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRIORITIES: WorkOrderPriority[] = ['low', 'medium', 'high', 'critical'];
const STATUSES: WorkOrderStatus[] = ['open', 'assigned', 'in_progress', 'pending_parts', 'completed', 'cancelled'];
const CATEGORIES: WorkOrderCategory[] = ['electrical', 'plumbing', 'hvac', 'structural', 'appliance', 'general'];

// ============================================
// FACTORY
// ============================================

export function createMaintenanceService(container: Container): MaintenanceService {
  const repository: MaintenanceRepository = container.maintenanceRepository;
  const logger: LoggerService = container.logger;

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  function validateUUID(id: string, field: string): void {
    if (!UUID_REGEX.test(id)) {
      throw new MaintenanceServiceError(`Invalid ${field} format`, `INVALID_${field.toUpperCase()}_ID`);
    }
  }

  function validateTitle(title: string): void {
    if (!title || title.trim().length < 3) {
      throw new MaintenanceServiceError('Title must be at least 3 characters', 'INVALID_TITLE');
    }
  }

  function validateDescription(description: string): void {
    if (!description || description.trim().length === 0) {
      throw new MaintenanceServiceError('Description is required', 'INVALID_DESCRIPTION');
    }
  }

  function validateCategory(category: WorkOrderCategory): void {
    if (!CATEGORIES.includes(category)) {
      throw new MaintenanceServiceError(`Invalid category: ${category}`, 'INVALID_CATEGORY');
    }
  }

  function validatePriority(priority: WorkOrderPriority): void {
    if (!PRIORITIES.includes(priority)) {
      throw new MaintenanceServiceError(`Invalid priority: ${priority}`, 'INVALID_PRIORITY');
    }
  }

  function validateLocationType(type: string): void {
    if (!type || type.trim().length === 0) {
      throw new MaintenanceServiceError('Location type is required', 'INVALID_LOCATION_TYPE');
    }
  }

  // ============================================
  // WORK ORDER OPERATIONS
  // ============================================

  async function createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder> {
    validateTitle(input.title);
    validateDescription(input.description);
    validateCategory(input.category);
    validatePriority(input.priority);
    validateUUID(input.locationId, 'location');
    validateLocationType(input.locationType);
    validateUUID(input.reportedBy, 'reporter');

    if (input.estimatedHours !== undefined && input.estimatedHours < 0) {
      throw new MaintenanceServiceError('Estimated hours cannot be negative', 'INVALID_HOURS');
    }

    const workOrder = await repository.create({
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      priority: input.priority,
      status: 'open',
      locationId: input.locationId,
      locationType: input.locationType.trim(),
      reportedBy: input.reportedBy,
      assignedTo: null,
      scheduledDate: input.scheduledDate ?? null,
      startedAt: null,
      completedAt: null,
      estimatedHours: input.estimatedHours ?? null,
      actualHours: null,
      laborCost: null,
      partsCost: null,
      notes: input.notes?.trim() ?? null,
    });

    logger.info('Work order created', { workOrderId: workOrder.id, title: workOrder.title });
    return workOrder;
  }

  async function getWorkOrder(id: string): Promise<WorkOrder | null> {
    validateUUID(id, 'work_order');
    return repository.getById(id);
  }

  async function updateWorkOrder(id: string, input: UpdateWorkOrderInput): Promise<WorkOrder> {
    validateUUID(id, 'work_order');

    const order = await repository.getById(id);
    if (!order) {
      throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    }

    if (['completed', 'cancelled'].includes(order.status)) {
      throw new MaintenanceServiceError('Cannot update finalized work order', 'WORK_ORDER_FINALIZED');
    }

    if (input.title !== undefined) {
      validateTitle(input.title);
    }

    if (input.priority !== undefined) {
      validatePriority(input.priority);
    }

    const updated = await repository.update(id, {
      ...(input.title && { title: input.title.trim() }),
      ...(input.description && { description: input.description.trim() }),
      ...(input.priority && { priority: input.priority }),
      ...(input.scheduledDate !== undefined && { scheduledDate: input.scheduledDate }),
      ...(input.estimatedHours !== undefined && { estimatedHours: input.estimatedHours }),
      ...(input.notes !== undefined && { notes: input.notes?.trim() ?? null }),
    });

    logger.info('Work order updated', { workOrderId: id });
    return updated;
  }

  async function deleteWorkOrder(id: string): Promise<void> {
    validateUUID(id, 'work_order');

    const order = await repository.getById(id);
    if (!order) {
      throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    }

    await repository.delete(id);
    logger.info('Work order deleted', { workOrderId: id });
  }

  async function listWorkOrders(filters?: WorkOrderFilters): Promise<WorkOrder[]> {
    return repository.list(filters);
  }

  // ============================================
  // WORKFLOW
  // ============================================

  async function assignWorkOrder(id: string, assignedTo: string): Promise<WorkOrder> {
    validateUUID(id, 'work_order');
    validateUUID(assignedTo, 'assignee');

    const order = await repository.getById(id);
    if (!order) {
      throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    }

    if (!['open', 'assigned'].includes(order.status)) {
      throw new MaintenanceServiceError(
        `Cannot assign work order with status: ${order.status}`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await repository.update(id, {
      assignedTo,
      status: 'assigned',
    });

    logger.info('Work order assigned', { workOrderId: id, assignedTo });
    return updated;
  }

  async function unassignWorkOrder(id: string): Promise<WorkOrder> {
    validateUUID(id, 'work_order');

    const order = await repository.getById(id);
    if (!order) {
      throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    }

    if (order.status !== 'assigned') {
      throw new MaintenanceServiceError(
        'Only assigned work orders can be unassigned',
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await repository.update(id, {
      assignedTo: null,
      status: 'open',
    });

    logger.info('Work order unassigned', { workOrderId: id });
    return updated;
  }

  async function startWorkOrder(id: string): Promise<WorkOrder> {
    validateUUID(id, 'work_order');

    const order = await repository.getById(id);
    if (!order) {
      throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    }

    if (!['assigned', 'pending_parts'].includes(order.status)) {
      throw new MaintenanceServiceError(
        `Cannot start work order with status: ${order.status}`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await repository.update(id, {
      status: 'in_progress',
      startedAt: order.startedAt ?? new Date().toISOString(),
    });

    logger.info('Work order started', { workOrderId: id });
    return updated;
  }

  async function setPendingParts(id: string): Promise<WorkOrder> {
    validateUUID(id, 'work_order');

    const order = await repository.getById(id);
    if (!order) {
      throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    }

    if (!['assigned', 'in_progress'].includes(order.status)) {
      throw new MaintenanceServiceError(
        `Cannot set pending parts for status: ${order.status}`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updated = await repository.update(id, {
      status: 'pending_parts',
    });

    logger.info('Work order waiting for parts', { workOrderId: id });
    return updated;
  }

  async function completeWorkOrder(id: string, input: CompleteWorkOrderInput): Promise<WorkOrder> {
    validateUUID(id, 'work_order');

    if (input.actualHours < 0) {
      throw new MaintenanceServiceError('Actual hours cannot be negative', 'INVALID_HOURS');
    }

    const order = await repository.getById(id);
    if (!order) {
      throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    }

    if (order.status !== 'in_progress') {
      throw new MaintenanceServiceError(
        'Only in-progress work orders can be completed',
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Calculate parts cost
    const parts = await repository.getParts(id);
    const partsCost = parts.reduce((sum, p) => sum + p.totalCost, 0);

    const updated = await repository.update(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      actualHours: input.actualHours,
      laborCost: input.laborCost ?? null,
      partsCost,
      notes: input.notes ? (order.notes ? `${order.notes}\n${input.notes}` : input.notes) : order.notes,
    });

    logger.info('Work order completed', { workOrderId: id, actualHours: input.actualHours });
    return updated;
  }

  async function cancelWorkOrder(id: string, reason?: string): Promise<WorkOrder> {
    validateUUID(id, 'work_order');

    const order = await repository.getById(id);
    if (!order) {
      throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    }

    if (order.status === 'cancelled') {
      throw new MaintenanceServiceError('Work order is already cancelled', 'ALREADY_CANCELLED');
    }

    if (order.status === 'completed') {
      throw new MaintenanceServiceError('Cannot cancel completed work order', 'WORK_ORDER_COMPLETED');
    }

    const notes = reason
      ? (order.notes ? `${order.notes}\n\nCancellation: ${reason}` : `Cancellation: ${reason}`)
      : order.notes;

    const updated = await repository.update(id, {
      status: 'cancelled',
      notes,
    });

    logger.info('Work order cancelled', { workOrderId: id, reason });
    return updated;
  }

  async function reopenWorkOrder(id: string): Promise<WorkOrder> {
    validateUUID(id, 'work_order');

    const order = await repository.getById(id);
    if (!order) {
      throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    }

    if (order.status !== 'cancelled') {
      throw new MaintenanceServiceError('Only cancelled work orders can be reopened', 'INVALID_STATUS_TRANSITION');
    }

    const updated = await repository.update(id, {
      status: 'open',
      assignedTo: null,
    });

    logger.info('Work order reopened', { workOrderId: id });
    return updated;
  }

  // ============================================
  // PARTS MANAGEMENT
  // ============================================

  async function addPart(input: AddPartInput): Promise<WorkOrderPart> {
    validateUUID(input.workOrderId, 'work_order');

    const order = await repository.getById(input.workOrderId);
    if (!order) {
      throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    }

    if (!input.partName || input.partName.trim().length === 0) {
      throw new MaintenanceServiceError('Part name is required', 'INVALID_PART_NAME');
    }

    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new MaintenanceServiceError('Quantity must be a positive integer', 'INVALID_QUANTITY');
    }

    if (typeof input.unitCost !== 'number' || input.unitCost < 0) {
      throw new MaintenanceServiceError('Unit cost must be non-negative', 'INVALID_UNIT_COST');
    }

    const totalCost = input.quantity * input.unitCost;

    const part = await repository.addPart({
      workOrderId: input.workOrderId,
      partName: input.partName.trim(),
      partNumber: input.partNumber?.trim() ?? null,
      quantity: input.quantity,
      unitCost: input.unitCost,
      totalCost,
    });

    logger.info('Part added to work order', { workOrderId: input.workOrderId, partId: part.id });
    return part;
  }

  async function getParts(workOrderId: string): Promise<WorkOrderPart[]> {
    validateUUID(workOrderId, 'work_order');

    const order = await repository.getById(workOrderId);
    if (!order) {
      throw new MaintenanceServiceError('Work order not found', 'WORK_ORDER_NOT_FOUND', 404);
    }

    return repository.getParts(workOrderId);
  }

  async function removePart(partId: string): Promise<void> {
    validateUUID(partId, 'part');
    await repository.deletePart(partId);
    logger.info('Part removed from work order', { partId });
  }

  // ============================================
  // REPORTING
  // ============================================

  async function getByLocation(locationId: string): Promise<WorkOrder[]> {
    validateUUID(locationId, 'location');
    return repository.getByLocation(locationId);
  }

  async function getByAssignee(assigneeId: string): Promise<WorkOrder[]> {
    validateUUID(assigneeId, 'assignee');
    return repository.getByAssignee(assigneeId);
  }

  async function getOpenWorkOrders(): Promise<WorkOrder[]> {
    const allOrders = await repository.list();
    return allOrders.filter(o => !['completed', 'cancelled'].includes(o.status));
  }

  async function getCriticalWorkOrders(): Promise<WorkOrder[]> {
    const allOrders = await repository.list({ priority: 'critical' });
    return allOrders.filter(o => !['completed', 'cancelled'].includes(o.status));
  }

  async function getStats(): Promise<MaintenanceStats> {
    const orders = await repository.list();

    const byStatus: Record<WorkOrderStatus, number> = {
      open: 0,
      assigned: 0,
      in_progress: 0,
      pending_parts: 0,
      completed: 0,
      cancelled: 0,
    };

    const byPriority: Record<WorkOrderPriority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const byCategory: Record<WorkOrderCategory, number> = {
      electrical: 0,
      plumbing: 0,
      hvac: 0,
      structural: 0,
      appliance: 0,
      general: 0,
    };

    let totalHours = 0;
    let hoursCount = 0;
    let totalLaborCost = 0;
    let totalPartsCost = 0;

    for (const order of orders) {
      byStatus[order.status]++;
      byPriority[order.priority]++;
      byCategory[order.category]++;

      if (order.actualHours !== null) {
        totalHours += order.actualHours;
        hoursCount++;
      }

      if (order.laborCost !== null) {
        totalLaborCost += order.laborCost;
      }

      if (order.partsCost !== null) {
        totalPartsCost += order.partsCost;
      }
    }

    return {
      totalWorkOrders: orders.length,
      byStatus,
      byPriority,
      byCategory,
      avgCompletionHours: hoursCount > 0 ? totalHours / hoursCount : 0,
      totalLaborCost,
      totalPartsCost,
    };
  }

  // ============================================
  // UTILITY
  // ============================================

  function getPriorities(): WorkOrderPriority[] {
    return [...PRIORITIES];
  }

  function getStatuses(): WorkOrderStatus[] {
    return [...STATUSES];
  }

  function getCategories(): WorkOrderCategory[] {
    return [...CATEGORIES];
  }

  return {
    createWorkOrder,
    getWorkOrder,
    updateWorkOrder,
    deleteWorkOrder,
    listWorkOrders,
    assignWorkOrder,
    unassignWorkOrder,
    startWorkOrder,
    setPendingParts,
    completeWorkOrder,
    cancelWorkOrder,
    reopenWorkOrder,
    addPart,
    getParts,
    removePart,
    getByLocation,
    getByAssignee,
    getOpenWorkOrders,
    getCriticalWorkOrders,
    getStats,
    getPriorities,
    getStatuses,
    getCategories,
  };
}
