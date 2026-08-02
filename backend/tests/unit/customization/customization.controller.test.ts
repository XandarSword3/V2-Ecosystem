
// Mock logger before importing controller
vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock customization service
vi.mock('../../../src/modules/customization/services/customization.service.js', () => ({
  customizationService: {
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    getGroup: vi.fn(),
    listGroups: vi.fn(),
    createOption: vi.fn(),
    updateOption: vi.fn(),
    deleteOption: vi.fn(),
    getOptionsForGroup: vi.fn(),
    linkToEntity: vi.fn(),
    updateEntityLink: vi.fn(),
    unlinkFromEntity: vi.fn(),
    getEntityLinks: vi.fn(),
    getCustomizationsForEntity: vi.fn(),
    validateSelections: vi.fn(),
    getOrderCustomizations: vi.fn(),
    createOrderSnapshot: vi.fn(),
    reverseOrderItemInventory: vi.fn(),
    getReversibleOrderCustomizations: vi.fn(),
    getEvents: vi.fn(),
    getMetricsSummary: vi.fn(),
    getDualWriteDiscrepancies: vi.fn(),
  },
}));

import { customizationController } from '../../../src/modules/customization/controllers/customization.controller.js';
import { customizationService } from '../../../src/modules/customization/services/customization.service.js';

function createMockReqRes(overrides: any = {}) {
  const req = {
    params: {},
    query: {},
    body: {},
    headers: {},
    user: { id: 'user-1', role: 'admin' },
    ...overrides,
  };
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('CustomizationController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGroup', () => {
    it('should create a customization group with valid data', async () => {
      const mockGroup = { id: 'group-1', name: 'Toppings', selectionMode: 'multiple' };
      vi.mocked(customizationService.createGroup).mockResolvedValue(mockGroup);

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Toppings',
          selectionMode: 'multiple',
          applicableEntityTypes: ['menu_item'],
        },
      });

      await customizationController.createGroup(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockGroup);
    });

    it('should return 400 if name is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { selectionMode: 'multiple', applicableEntityTypes: ['menu_item'] },
      });

      await customizationController.createGroup(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Name is required' });
    });

    it('should return 400 if selectionMode is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { name: 'Toppings', applicableEntityTypes: ['menu_item'] },
      });

      await customizationController.createGroup(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Selection mode is required' });
    });

    it('should return 400 if applicableEntityTypes is empty', async () => {
      const { req, res, next } = createMockReqRes({
        body: { name: 'Toppings', selectionMode: 'multiple', applicableEntityTypes: [] },
      });

      await customizationController.createGroup(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'At least one applicable entity type is required' });
    });
  });

  describe('updateGroup', () => {
    it('should update a customization group', async () => {
      const mockGroup = { id: 'group-1', name: 'Updated Toppings' };
      vi.mocked(customizationService.updateGroup).mockResolvedValue(mockGroup);

      const { req, res, next } = createMockReqRes({
        params: { id: 'group-1' },
        body: { name: 'Updated Toppings' },
      });

      await customizationController.updateGroup(req as any, res as any, next);

      expect(customizationService.updateGroup).toHaveBeenCalledWith('group-1', { name: 'Updated Toppings' });
      expect(res.json).toHaveBeenCalledWith(mockGroup);
    });
  });

  describe('deleteGroup', () => {
    it('should delete a customization group', async () => {
      vi.mocked(customizationService.deleteGroup).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'group-1' },
      });

      await customizationController.deleteGroup(req as any, res as any, next);

      expect(customizationService.deleteGroup).toHaveBeenCalledWith('group-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getGroup', () => {
    it('should return a customization group', async () => {
      const mockGroup = { id: 'group-1', name: 'Toppings' };
      vi.mocked(customizationService.getGroup).mockResolvedValue(mockGroup);

      const { req, res, next } = createMockReqRes({
        params: { id: 'group-1' },
        query: { includeOptions: 'true' },
      });

      await customizationController.getGroup(req as any, res as any, next);

      expect(customizationService.getGroup).toHaveBeenCalledWith('group-1', true);
      expect(res.json).toHaveBeenCalledWith(mockGroup);
    });

    it('should return 404 if group not found', async () => {
      vi.mocked(customizationService.getGroup).mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({
        params: { id: 'invalid' },
        query: {},
      });

      await customizationController.getGroup(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Customization group not found' });
    });
  });

  describe('listGroups', () => {
    it('should list all customization groups', async () => {
      const mockGroups = [
        { id: 'group-1', name: 'Toppings' },
        { id: 'group-2', name: 'Sizes' },
      ];
      vi.mocked(customizationService.listGroups).mockResolvedValue(mockGroups);

      const { req, res, next } = createMockReqRes({
        query: { entityType: 'menu_item', isGlobal: 'true', includeOptions: 'true' },
      });

      await customizationController.listGroups(req as any, res as any, next);

      expect(customizationService.listGroups).toHaveBeenCalledWith({
        entityType: 'menu_item',
        isGlobal: true,
        includeOptions: true,
      });
      expect(res.json).toHaveBeenCalledWith(mockGroups);
    });
  });

  describe('createOption', () => {
    it('should create a customization option with all required fields', async () => {
      const mockOption = { id: 'opt-1', name: 'Extra Cheese', price: 1.50 };
      vi.mocked(customizationService.createOption).mockResolvedValue(mockOption);

      const { req, res, next } = createMockReqRes({
        body: {
          groupId: 'group-1',
          name: 'Extra Cheese',
          customizationType: 'addon',
          priceAdjustment: 1.50,
        },
      });

      await customizationController.createOption(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockOption);
    });

    it('should return 400 if groupId is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { name: 'Extra Cheese', customizationType: 'addon' },
      });

      await customizationController.createOption(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Group ID is required' });
    });

    it('should return 400 if name is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { groupId: 'group-1', customizationType: 'addon' },
      });

      await customizationController.createOption(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Name is required' });
    });

    it('should return 400 if customizationType is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { groupId: 'group-1', name: 'Extra Cheese' },
      });

      await customizationController.createOption(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Customization type is required' });
    });
  });

  describe('updateOption', () => {
    it('should update a customization option', async () => {
      const mockOption = { id: 'opt-1', name: 'Updated Cheese' };
      vi.mocked(customizationService.updateOption).mockResolvedValue(mockOption);

      const { req, res, next } = createMockReqRes({
        params: { id: 'opt-1' },
        body: { name: 'Updated Cheese' },
      });

      await customizationController.updateOption(req as any, res as any, next);

      expect(customizationService.updateOption).toHaveBeenCalledWith('opt-1', { name: 'Updated Cheese' });
      expect(res.json).toHaveBeenCalledWith(mockOption);
    });
  });

  describe('deleteOption', () => {
    it('should delete a customization option', async () => {
      vi.mocked(customizationService.deleteOption).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'opt-1' },
      });

      await customizationController.deleteOption(req as any, res as any, next);

      expect(customizationService.deleteOption).toHaveBeenCalledWith('opt-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getOptionsForGroup', () => {
    it('should return options for a group', async () => {
      const mockOptions = [
        { id: 'opt-1', name: 'Extra Cheese' },
        { id: 'opt-2', name: 'Bacon' },
      ];
      vi.mocked(customizationService.getOptionsForGroup).mockResolvedValue(mockOptions);

      const { req, res, next } = createMockReqRes({
        params: { groupId: 'group-1' },
        query: {},
      });

      await customizationController.getOptionsForGroup(req as any, res as any, next);

      expect(customizationService.getOptionsForGroup).toHaveBeenCalledWith('group-1');
      expect(res.json).toHaveBeenCalledWith(mockOptions);
    });
  });

  describe('linkToEntity', () => {
    it('should link customization to entity', async () => {
      const mockLink = { id: 'link-1', entityType: 'menu_item', entityId: 'item-1' };
      vi.mocked(customizationService.linkToEntity).mockResolvedValue(mockLink);

      const { req, res, next } = createMockReqRes({
        body: {
          customizationGroupId: 'group-1',
          entityType: 'menu_item',
          entityId: 'item-1',
        },
      });

      await customizationController.linkToEntity(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockLink);
    });

    it('should return 400 if required fields are missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { groupId: 'group-1' },
      });

      await customizationController.linkToEntity(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateEntityLink', () => {
    it('should update entity link', async () => {
      const mockLink = { id: 'link-1', isRequired: true };
      vi.mocked(customizationService.updateEntityLink).mockResolvedValue(mockLink);

      const { req, res, next } = createMockReqRes({
        params: { id: 'link-1' },
        body: { isRequired: true },
      });

      await customizationController.updateEntityLink(req as any, res as any, next);

      expect(customizationService.updateEntityLink).toHaveBeenCalledWith('link-1', { isRequired: true });
      expect(res.json).toHaveBeenCalledWith(mockLink);
    });
  });

  describe('unlinkFromEntity', () => {
    it('should unlink customization from entity', async () => {
      vi.mocked(customizationService.unlinkFromEntity).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'link-1' },
      });

      await customizationController.unlinkFromEntity(req as any, res as any, next);

      expect(customizationService.unlinkFromEntity).toHaveBeenCalledWith('link-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getEntityLinks', () => {
    it('should return entity links', async () => {
      const mockLinks = [{ id: 'link-1' }, { id: 'link-2' }];
      vi.mocked(customizationService.getEntityLinks).mockResolvedValue(mockLinks);

      const { req, res, next } = createMockReqRes({
        query: { entityType: 'menu_item', entityId: 'item-1' },
      });

      await customizationController.getEntityLinks(req as any, res as any, next);

      expect(customizationService.getEntityLinks).toHaveBeenCalledWith('menu_item', 'item-1');
      expect(res.json).toHaveBeenCalledWith(mockLinks);
    });

    it('should return 400 if entityType is missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {},
      });

      await customizationController.getEntityLinks(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getCustomizationsForEntity', () => {
    it('should return customizations for entity', async () => {
      const mockCustomizations = { groups: [], options: [] };
      vi.mocked(customizationService.getCustomizationsForEntity).mockResolvedValue(mockCustomizations);

      const { req, res, next } = createMockReqRes({
        params: { entityType: 'menu_item', entityId: 'item-1' },
        query: {},
      });

      await customizationController.getCustomizationsForEntity(req as any, res as any, next);

      expect(customizationService.getCustomizationsForEntity).toHaveBeenCalledWith('menu_item', 'item-1');
      expect(res.json).toHaveBeenCalledWith(mockCustomizations);
    });
  });

  describe('validateSelections', () => {
    it('should validate customization selections', async () => {
      const mockResult = { valid: true, errors: [] };
      vi.mocked(customizationService.validateSelections).mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        body: {
          entityType: 'menu_item',
          entityId: 'item-1',
          selections: [{ groupId: 'group-1', optionIds: ['opt-1'] }],
        },
      });

      await customizationController.validateSelections(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getOrderCustomizations', () => {
    it('should return order customizations', async () => {
      const mockCustomizations = [{ id: 'cust-1', name: 'Extra Cheese' }];
      vi.mocked(customizationService.getOrderCustomizations).mockResolvedValue(mockCustomizations);

      const { req, res, next } = createMockReqRes({
        params: { orderType: 'menu_service', orderId: 'order-1' },
        query: { orderItemId: 'item-1' },
      });

      await customizationController.getOrderCustomizations(req as any, res as any, next);

      expect(customizationService.getOrderCustomizations).toHaveBeenCalledWith('menu_service', 'order-1', 'item-1');
      expect(res.json).toHaveBeenCalledWith(mockCustomizations);
    });
  });

  describe('createOrderSnapshot', () => {
    it('should create order snapshot', async () => {
      const mockResult = { success: true, snapshotId: 'snap-1' };
      vi.mocked(customizationService.createOrderSnapshot).mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        body: {
          orderType: 'menu_service',
          orderId: 'order-1',
          orderItemId: 'item-1',
          entityType: 'menu_item',
          entityId: 'menu-1',
          selections: [{ groupId: 'group-1', optionIds: ['opt-1'] }],
        },
      });

      await customizationController.createOrderSnapshot(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 400 if required fields are missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { orderItemId: 'item-1', selections: [] },
      });

      await customizationController.createOrderSnapshot(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('reverseOrderItemInventory', () => {
    it('should reverse order item inventory', async () => {
      const mockResult = { success: true, itemsReversed: 2 };
      vi.mocked(customizationService.reverseOrderItemInventory).mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        body: { snapshotId: 'snap-1', reason: 'Order cancelled' },
        user: { id: 'user-1' },
      });

      await customizationController.reverseOrderItemInventory(req as any, res as any, next);

      expect(customizationService.reverseOrderItemInventory).toHaveBeenCalledWith('snap-1', 'Order cancelled', 'user-1');
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 400 if snapshotId is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: { reason: 'Order cancelled' },
      });

      await customizationController.reverseOrderItemInventory(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getReversibleCustomizations', () => {
    it('should return reversible customizations', async () => {
      const mockResult = [{ id: 'cust-1', reversible: true }];
      vi.mocked(customizationService.getReversibleOrderCustomizations).mockResolvedValue(mockResult);

      const { req, res, next } = createMockReqRes({
        params: { orderType: 'menu_service', orderId: 'order-1' },
      });

      await customizationController.getReversibleCustomizations(req as any, res as any, next);

      expect(customizationService.getReversibleOrderCustomizations).toHaveBeenCalledWith('menu_service', 'order-1');
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getEvents', () => {
    it('should return customization events', async () => {
      const mockEvents = [{ id: 'event-1', type: 'created' }];
      vi.mocked(customizationService.getEvents).mockResolvedValue(mockEvents);

      const { req, res, next } = createMockReqRes({
        query: {
          eventType: 'snapshot_created',
          orderType: 'menu_service',
          orderId: 'order-1',
          limit: '10',
        },
      });

      await customizationController.getEvents(req as any, res as any, next);

      expect(customizationService.getEvents).toHaveBeenCalledWith({
        eventType: 'snapshot_created',
        orderType: 'menu_service',
        orderId: 'order-1',
        limit: 10,
        since: undefined,
      });
      expect(res.json).toHaveBeenCalledWith(mockEvents);
    });
  });

  describe('getMetricsSummary', () => {
    it('should return metrics summary', async () => {
      const mockMetrics = { totalGroups: 10, totalOptions: 50 };
      vi.mocked(customizationService.getMetricsSummary).mockResolvedValue(mockMetrics);

      const { req, res, next } = createMockReqRes({
        query: { startDate: '2024-01-01', endDate: '2024-01-31' },
      });

      await customizationController.getMetricsSummary(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(mockMetrics);
    });
  });

  describe('getDualWriteDiscrepancies', () => {
    it('should return dual write discrepancies', async () => {
      const mockDiscrepancies = [{ id: 'disc-1' }];
      vi.mocked(customizationService.getDualWriteDiscrepancies).mockResolvedValue(mockDiscrepancies);

      const { req, res, next } = createMockReqRes({
        query: { limit: '50' },
      });

      await customizationController.getDualWriteDiscrepancies(req as any, res as any, next);

      expect(customizationService.getDualWriteDiscrepancies).toHaveBeenCalledWith(50);
      expect(res.json).toHaveBeenCalledWith(mockDiscrepancies);
    });
  });
});
