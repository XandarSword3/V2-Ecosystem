/**
 * Maintenance Service Tests
 *
 * Unit tests for the Maintenance/Work Order Service with DI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMaintenanceService, MaintenanceServiceError } from '../../src/lib/services/maintenance.service';
import { InMemoryMaintenanceRepository } from '../../src/lib/repositories/maintenance.repository.memory';
import type { Container, WorkOrder } from '../../src/lib/container/types';

// Test UUIDs
const LOCATION_1 = '11111111-1111-1111-1111-111111111111';
const LOCATION_2 = '22222222-2222-2222-2222-222222222222';
const REPORTER_1 = '33333333-3333-3333-3333-333333333333';
const TECHNICIAN_1 = '44444444-4444-4444-4444-444444444444';
const INVALID_UUID = 'not-a-valid-uuid';

function createMockContainer(maintenanceRepository: InMemoryMaintenanceRepository): Container {
  return {
    maintenanceRepository,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as Container;
}

function createTestWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  const now = new Date().toISOString();
  return {
    id: '99999999-9999-9999-9999-999999999999',
    title: 'Fix leaking faucet',
    description: 'Bathroom faucet is leaking',
    category: 'plumbing',
    priority: 'medium',
    status: 'open',
    locationId: LOCATION_1,
    locationType: 'room',
    reportedBy: REPORTER_1,
    assignedTo: null,
    scheduledDate: null,
    startedAt: null,
    completedAt: null,
    estimatedHours: 2,
    actualHours: null,
    laborCost: null,
    partsCost: null,
    notes: null,
    createdAt: now,
    updatedAt: null,
    ...overrides,
  };
}

describe('MaintenanceService', () => {
  let repository: InMemoryMaintenanceRepository;
  let container: Container;
  let service: ReturnType<typeof createMaintenanceService>;

  beforeEach(() => {
    repository = new InMemoryMaintenanceRepository();
    container = createMockContainer(repository);
    service = createMaintenanceService(container);
  });

  // ============================================
  // CREATE WORK ORDER TESTS
  // ============================================
  describe('createWorkOrder', () => {
    it('should create a work order', async () => {
      const order = await service.createWorkOrder({
        title: 'Fix leaking faucet',
        description: 'Bathroom faucet is leaking',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      expect(order).toBeDefined();
      expect(order.title).toBe('Fix leaking faucet');
      expect(order.status).toBe('open');
    });

    it('should accept estimated hours', async () => {
      const order = await service.createWorkOrder({
        title: 'Fix AC unit',
        description: 'AC not cooling',
        category: 'hvac',
        priority: 'high',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
        estimatedHours: 4,
      });

      expect(order.estimatedHours).toBe(4);
    });

    it('should accept scheduled date', async () => {
      const scheduledDate = '2024-07-20';
      const order = await service.createWorkOrder({
        title: 'Routine inspection',
        description: 'Monthly inspection',
        category: 'general',
        priority: 'low',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
        scheduledDate,
      });

      expect(order.scheduledDate).toBe(scheduledDate);
    });

    it('should reject short title', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fi',
          description: 'Description',
          category: 'plumbing',
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_TITLE',
      });
    });

    it('should reject empty description', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: '',
          category: 'plumbing',
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_DESCRIPTION',
      });
    });

    it('should reject invalid category', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: 'Description',
          category: 'invalid' as any,
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CATEGORY',
      });
    });

    it('should reject invalid priority', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: 'Description',
          category: 'plumbing',
          priority: 'urgent' as any,
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PRIORITY',
      });
    });

    it('should reject invalid location ID', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: 'Description',
          category: 'plumbing',
          priority: 'medium',
          locationId: INVALID_UUID,
          locationType: 'room',
          reportedBy: REPORTER_1,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_LOCATION_ID',
      });
    });

    it('should reject negative estimated hours', async () => {
      await expect(
        service.createWorkOrder({
          title: 'Fix faucet',
          description: 'Description',
          category: 'plumbing',
          priority: 'medium',
          locationId: LOCATION_1,
          locationType: 'room',
          reportedBy: REPORTER_1,
          estimatedHours: -2,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_HOURS',
      });
    });
  });

  // ============================================
  // GET WORK ORDER TESTS
  // ============================================
  describe('getWorkOrder', () => {
    it('should retrieve work order by ID', async () => {
      const created = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      const found = await service.getWorkOrder(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent order', async () => {
      const found = await service.getWorkOrder(LOCATION_1);
      expect(found).toBeNull();
    });

    it('should reject invalid ID format', async () => {
      await expect(service.getWorkOrder(INVALID_UUID)).rejects.toMatchObject({
        code: 'INVALID_WORK_ORDER_ID',
      });
    });
  });

  // ============================================
  // UPDATE WORK ORDER TESTS
  // ============================================
  describe('updateWorkOrder', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });
      orderId = order.id;
    });

    it('should update title', async () => {
      const updated = await service.updateWorkOrder(orderId, {
        title: 'Replace faucet',
      });

      expect(updated.title).toBe('Replace faucet');
    });

    it('should update priority', async () => {
      const updated = await service.updateWorkOrder(orderId, {
        priority: 'high',
      });

      expect(updated.priority).toBe('high');
    });

    it('should update estimated hours', async () => {
      const updated = await service.updateWorkOrder(orderId, {
        estimatedHours: 4,
      });

      expect(updated.estimatedHours).toBe(4);
    });

    it('should reject non-existent order', async () => {
      await expect(
        service.updateWorkOrder(LOCATION_2, { title: 'New Title' })
      ).rejects.toMatchObject({
        code: 'WORK_ORDER_NOT_FOUND',
      });
    });

    it('should reject invalid ID format', async () => {
      await expect(
        service.updateWorkOrder(INVALID_UUID, { title: 'New Title' })
      ).rejects.toMatchObject({
        code: 'INVALID_WORK_ORDER_ID',
      });
    });
  });

  // ============================================
  // DELETE WORK ORDER TESTS
  // ============================================
  describe('deleteWorkOrder', () => {
    it('should delete work order', async () => {
      const order = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      await service.deleteWorkOrder(order.id);

      const found = await service.getWorkOrder(order.id);
      expect(found).toBeNull();
    });

    it('should reject non-existent order', async () => {
      await expect(service.deleteWorkOrder(LOCATION_2)).rejects.toMatchObject({
        code: 'WORK_ORDER_NOT_FOUND',
      });
    });
  });

  // ============================================
  // ASSIGN WORK ORDER TESTS
  // ============================================
  describe('assignWorkOrder', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });
      orderId = order.id;
    });

    it('should assign work order to technician', async () => {
      const assigned = await service.assignWorkOrder(orderId, TECHNICIAN_1);

      expect(assigned.assignedTo).toBe(TECHNICIAN_1);
      expect(assigned.status).toBe('assigned');
    });

    it('should reject non-existent order', async () => {
      await expect(
        service.assignWorkOrder(LOCATION_2, TECHNICIAN_1)
      ).rejects.toMatchObject({
        code: 'WORK_ORDER_NOT_FOUND',
      });
    });

    it('should reject invalid assignee ID', async () => {
      await expect(
        service.assignWorkOrder(orderId, INVALID_UUID)
      ).rejects.toMatchObject({
        code: 'INVALID_ASSIGNEE_ID',
      });
    });
  });

  // ============================================
  // UNASSIGN WORK ORDER TESTS
  // ============================================
  describe('unassignWorkOrder', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });
      await service.assignWorkOrder(order.id, TECHNICIAN_1);
      orderId = order.id;
    });

    it('should unassign work order', async () => {
      const unassigned = await service.unassignWorkOrder(orderId);

      expect(unassigned.assignedTo).toBeNull();
      expect(unassigned.status).toBe('open');
    });

    it('should reject non-assigned order', async () => {
      const newOrder = await service.createWorkOrder({
        title: 'New order',
        description: 'Description',
        category: 'general',
        priority: 'low',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      await expect(service.unassignWorkOrder(newOrder.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });
  });

  // ============================================
  // START WORK ORDER TESTS
  // ============================================
  describe('startWorkOrder', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });
      await service.assignWorkOrder(order.id, TECHNICIAN_1);
      orderId = order.id;
    });

    it('should start work order', async () => {
      const started = await service.startWorkOrder(orderId);

      expect(started.status).toBe('in_progress');
      expect(started.startedAt).toBeDefined();
    });

    it('should reject unassigned order', async () => {
      const newOrder = await service.createWorkOrder({
        title: 'New order',
        description: 'Description',
        category: 'general',
        priority: 'low',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      await expect(service.startWorkOrder(newOrder.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });
  });

  // ============================================
  // SET PENDING PARTS TESTS
  // ============================================
  describe('setPendingParts', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });
      await service.assignWorkOrder(order.id, TECHNICIAN_1);
      orderId = order.id;
    });

    it('should set pending parts from assigned', async () => {
      const pending = await service.setPendingParts(orderId);
      expect(pending.status).toBe('pending_parts');
    });

    it('should set pending parts from in progress', async () => {
      await service.startWorkOrder(orderId);
      const pending = await service.setPendingParts(orderId);
      expect(pending.status).toBe('pending_parts');
    });
  });

  // ============================================
  // COMPLETE WORK ORDER TESTS
  // ============================================
  describe('completeWorkOrder', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });
      await service.assignWorkOrder(order.id, TECHNICIAN_1);
      await service.startWorkOrder(order.id);
      orderId = order.id;
    });

    it('should complete work order', async () => {
      const completed = await service.completeWorkOrder(orderId, {
        actualHours: 2,
      });

      expect(completed.status).toBe('completed');
      expect(completed.actualHours).toBe(2);
      expect(completed.completedAt).toBeDefined();
    });

    it('should record labor cost', async () => {
      const completed = await service.completeWorkOrder(orderId, {
        actualHours: 2,
        laborCost: 150,
      });

      expect(completed.laborCost).toBe(150);
    });

    it('should calculate parts cost', async () => {
      await service.addPart({
        workOrderId: orderId,
        partName: 'Faucet',
        quantity: 1,
        unitCost: 50,
      });

      await service.addPart({
        workOrderId: orderId,
        partName: 'O-ring',
        quantity: 2,
        unitCost: 5,
      });

      const completed = await service.completeWorkOrder(orderId, {
        actualHours: 2,
      });

      expect(completed.partsCost).toBe(60); // 50 + 10
    });

    it('should reject negative hours', async () => {
      await expect(
        service.completeWorkOrder(orderId, { actualHours: -1 })
      ).rejects.toMatchObject({
        code: 'INVALID_HOURS',
      });
    });

    it('should reject non-started order', async () => {
      const newOrder = await service.createWorkOrder({
        title: 'New order',
        description: 'Description',
        category: 'general',
        priority: 'low',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      await expect(
        service.completeWorkOrder(newOrder.id, { actualHours: 1 })
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });
  });

  // ============================================
  // CANCEL WORK ORDER TESTS
  // ============================================
  describe('cancelWorkOrder', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });
      orderId = order.id;
    });

    it('should cancel work order', async () => {
      const cancelled = await service.cancelWorkOrder(orderId);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should add cancellation reason to notes', async () => {
      const cancelled = await service.cancelWorkOrder(orderId, 'No longer needed');
      expect(cancelled.notes).toContain('Cancellation: No longer needed');
    });

    it('should reject already cancelled order', async () => {
      await service.cancelWorkOrder(orderId);

      await expect(service.cancelWorkOrder(orderId)).rejects.toMatchObject({
        code: 'ALREADY_CANCELLED',
      });
    });
  });

  // ============================================
  // REOPEN WORK ORDER TESTS
  // ============================================
  describe('reopenWorkOrder', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });
      await service.cancelWorkOrder(order.id);
      orderId = order.id;
    });

    it('should reopen cancelled work order', async () => {
      const reopened = await service.reopenWorkOrder(orderId);

      expect(reopened.status).toBe('open');
      expect(reopened.assignedTo).toBeNull();
    });

    it('should reject non-cancelled order', async () => {
      const newOrder = await service.createWorkOrder({
        title: 'New order',
        description: 'Description',
        category: 'general',
        priority: 'low',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      await expect(service.reopenWorkOrder(newOrder.id)).rejects.toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    });
  });

  // ============================================
  // PARTS MANAGEMENT TESTS
  // ============================================
  describe('addPart', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });
      orderId = order.id;
    });

    it('should add part to work order', async () => {
      const part = await service.addPart({
        workOrderId: orderId,
        partName: 'Faucet',
        quantity: 1,
        unitCost: 50,
      });

      expect(part).toBeDefined();
      expect(part.partName).toBe('Faucet');
      expect(part.totalCost).toBe(50);
    });

    it('should calculate total cost', async () => {
      const part = await service.addPart({
        workOrderId: orderId,
        partName: 'O-ring',
        quantity: 5,
        unitCost: 2,
      });

      expect(part.totalCost).toBe(10);
    });

    it('should accept part number', async () => {
      const part = await service.addPart({
        workOrderId: orderId,
        partName: 'Faucet',
        partNumber: 'FT-1234',
        quantity: 1,
        unitCost: 50,
      });

      expect(part.partNumber).toBe('FT-1234');
    });

    it('should reject empty part name', async () => {
      await expect(
        service.addPart({
          workOrderId: orderId,
          partName: '',
          quantity: 1,
          unitCost: 10,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_PART_NAME',
      });
    });

    it('should reject invalid quantity', async () => {
      await expect(
        service.addPart({
          workOrderId: orderId,
          partName: 'Part',
          quantity: 0,
          unitCost: 10,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_QUANTITY',
      });
    });

    it('should reject negative unit cost', async () => {
      await expect(
        service.addPart({
          workOrderId: orderId,
          partName: 'Part',
          quantity: 1,
          unitCost: -10,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_UNIT_COST',
      });
    });
  });

  describe('getParts', () => {
    it('should return parts for work order', async () => {
      const order = await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      await service.addPart({
        workOrderId: order.id,
        partName: 'Part 1',
        quantity: 1,
        unitCost: 10,
      });

      await service.addPart({
        workOrderId: order.id,
        partName: 'Part 2',
        quantity: 2,
        unitCost: 20,
      });

      const parts = await service.getParts(order.id);
      expect(parts.length).toBe(2);
    });

    it('should reject non-existent order', async () => {
      await expect(service.getParts(LOCATION_2)).rejects.toMatchObject({
        code: 'WORK_ORDER_NOT_FOUND',
      });
    });
  });

  // ============================================
  // LIST WORK ORDERS TESTS
  // ============================================
  describe('listWorkOrders', () => {
    beforeEach(async () => {
      await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Plumbing issue',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      await service.createWorkOrder({
        title: 'Fix AC',
        description: 'HVAC issue',
        category: 'hvac',
        priority: 'high',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      await service.createWorkOrder({
        title: 'Fix lights',
        description: 'Electrical issue',
        category: 'electrical',
        priority: 'critical',
        locationId: LOCATION_2,
        locationType: 'lobby',
        reportedBy: REPORTER_1,
      });
    });

    it('should return all work orders', async () => {
      const orders = await service.listWorkOrders();
      expect(orders.length).toBe(3);
    });

    it('should filter by category', async () => {
      const orders = await service.listWorkOrders({ category: 'plumbing' });
      expect(orders.length).toBe(1);
    });

    it('should filter by priority', async () => {
      const orders = await service.listWorkOrders({ priority: 'critical' });
      expect(orders.length).toBe(1);
    });

    it('should filter by location', async () => {
      const orders = await service.listWorkOrders({ locationId: LOCATION_1 });
      expect(orders.length).toBe(2);
    });
  });

  // ============================================
  // GET BY LOCATION TESTS
  // ============================================
  describe('getByLocation', () => {
    it('should return work orders by location', async () => {
      await service.createWorkOrder({
        title: 'Fix faucet',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      const orders = await service.getByLocation(LOCATION_1);
      expect(orders.length).toBe(1);
    });
  });

  // ============================================
  // GET OPEN WORK ORDERS TESTS
  // ============================================
  describe('getOpenWorkOrders', () => {
    it('should return only open/active work orders', async () => {
      const order1 = await service.createWorkOrder({
        title: 'Open order',
        description: 'Description',
        category: 'general',
        priority: 'low',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      const order2 = await service.createWorkOrder({
        title: 'Cancelled order',
        description: 'Description',
        category: 'general',
        priority: 'low',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });
      await service.cancelWorkOrder(order2.id);

      const openOrders = await service.getOpenWorkOrders();
      expect(openOrders.length).toBe(1);
      expect(openOrders[0].id).toBe(order1.id);
    });
  });

  // ============================================
  // GET CRITICAL WORK ORDERS TESTS
  // ============================================
  describe('getCriticalWorkOrders', () => {
    it('should return only critical open work orders', async () => {
      await service.createWorkOrder({
        title: 'Critical order',
        description: 'Description',
        category: 'electrical',
        priority: 'critical',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      await service.createWorkOrder({
        title: 'Low order',
        description: 'Description',
        category: 'general',
        priority: 'low',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      const criticalOrders = await service.getCriticalWorkOrders();
      expect(criticalOrders.length).toBe(1);
      expect(criticalOrders[0].priority).toBe('critical');
    });
  });

  // ============================================
  // STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return empty stats with no data', async () => {
      const stats = await service.getStats();

      expect(stats.totalWorkOrders).toBe(0);
      expect(stats.avgCompletionHours).toBe(0);
    });

    it('should count work orders by status', async () => {
      await service.createWorkOrder({
        title: 'Order 1',
        description: 'Description',
        category: 'plumbing',
        priority: 'medium',
        locationId: LOCATION_1,
        locationType: 'room',
        reportedBy: REPORTER_1,
      });

      const stats = await service.getStats();

      expect(stats.totalWorkOrders).toBe(1);
      expect(stats.byStatus.open).toBe(1);
      expect(stats.byCategory.plumbing).toBe(1);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================
  describe('getPriorities', () => {
    it('should return all priorities', () => {
      const priorities = service.getPriorities();

      expect(priorities).toContain('low');
      expect(priorities).toContain('critical');
    });
  });

  describe('getStatuses', () => {
    it('should return all statuses', () => {
      const statuses = service.getStatuses();

      expect(statuses).toContain('open');
      expect(statuses).toContain('completed');
    });
  });

  describe('getCategories', () => {
    it('should return all categories', () => {
      const categories = service.getCategories();

      expect(categories).toContain('plumbing');
      expect(categories).toContain('electrical');
      expect(categories).toContain('hvac');
    });
  });
});
