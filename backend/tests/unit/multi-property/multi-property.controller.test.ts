import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../utils';

// Mock the multi-property service
vi.mock('../../../src/modules/multi-property/multi-property.service.js', () => ({
  getPropertyGroups: vi.fn(),
  getPropertyGroup: vi.fn(),
  getPropertiesInGroup: vi.fn(),
  createPropertyGroup: vi.fn(),
  updatePropertyGroup: vi.fn(),
  getGroupSummary: vi.fn(),
  getUserAccessibleProperties: vi.fn(),
  getUserPrimaryProperty: vi.fn(),
  switchUserProperty: vi.fn(),
  grantPropertyAccess: vi.fn(),
  revokePropertyAccess: vi.fn(),
  grantGroupAccess: vi.fn(),
  revokeGroupAccess: vi.fn(),
  addPropertyToGroup: vi.fn(),
  removePropertyFromGroup: vi.fn(),
  getGroupBenchmarks: vi.fn(),
  calculateAndStoreBenchmarks: vi.fn(),
}));

import * as multiPropertyController from '../../../src/modules/multi-property/multi-property.controller';
import * as multiPropertyService from '../../../src/modules/multi-property/multi-property.service.js';

describe('Multi-Property Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPropertyGroups', () => {
    it('should return all property groups', async () => {
      const mockGroups = [
        { id: 'group-1', name: 'European Hotels' },
        { id: 'group-2', name: 'Asian Resorts' }
      ];
      vi.mocked(multiPropertyService.getPropertyGroups).mockResolvedValue(mockGroups);

      const { req, res } = createMockReqRes();

      await multiPropertyController.getPropertyGroups(req, res);

      expect(multiPropertyService.getPropertyGroups).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        groups: mockGroups
      });
    });

    it('should handle errors', async () => {
      vi.mocked(multiPropertyService.getPropertyGroups).mockRejectedValue(new Error('DB error'));

      const { req, res } = createMockReqRes();

      await multiPropertyController.getPropertyGroups(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB error' });
    });
  });

  describe('getPropertyGroup', () => {
    it('should return a specific property group with properties', async () => {
      const mockGroup = { id: 'group-1', name: 'European Hotels' };
      const mockProperties = [
        { id: 'prop-1', name: 'Paris Hotel' },
        { id: 'prop-2', name: 'Rome Resort' }
      ];
      vi.mocked(multiPropertyService.getPropertyGroup).mockResolvedValue(mockGroup);
      vi.mocked(multiPropertyService.getPropertiesInGroup).mockResolvedValue(mockProperties);

      const { req, res } = createMockReqRes({
        params: { groupId: 'group-1' }
      });

      await multiPropertyController.getPropertyGroup(req, res);

      expect(multiPropertyService.getPropertyGroup).toHaveBeenCalledWith('group-1');
      expect(multiPropertyService.getPropertiesInGroup).toHaveBeenCalledWith('group-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        group: mockGroup,
        properties: mockProperties
      });
    });

    it('should return 404 for non-existent group', async () => {
      vi.mocked(multiPropertyService.getPropertyGroup).mockResolvedValue(null);

      const { req, res } = createMockReqRes({
        params: { groupId: 'invalid-group' }
      });

      await multiPropertyController.getPropertyGroup(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property group not found' });
    });
  });

  describe('createPropertyGroup', () => {
    it('should create a new property group', async () => {
      const mockGroup = { id: 'group-new', name: 'New Chain', created_at: '2024-01-01' };
      vi.mocked(multiPropertyService.createPropertyGroup).mockResolvedValue(mockGroup);

      const { req, res } = createMockReqRes({
        body: { name: 'New Chain', description: 'Test chain' }
      });

      await multiPropertyController.createPropertyGroup(req, res);

      expect(multiPropertyService.createPropertyGroup).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        group: mockGroup
      });
    });

    it('should handle creation errors', async () => {
      vi.mocked(multiPropertyService.createPropertyGroup).mockRejectedValue(new Error('Invalid data'));

      const { req, res } = createMockReqRes({
        body: { name: '' }
      });

      await multiPropertyController.createPropertyGroup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid data' });
    });
  });

  describe('updatePropertyGroup', () => {
    it('should update an existing property group', async () => {
      const mockUpdatedGroup = { id: 'group-1', name: 'Updated Name' };
      vi.mocked(multiPropertyService.updatePropertyGroup).mockResolvedValue(mockUpdatedGroup);

      const { req, res } = createMockReqRes({
        params: { groupId: 'group-1' },
        body: { name: 'Updated Name' }
      });

      await multiPropertyController.updatePropertyGroup(req, res);

      expect(multiPropertyService.updatePropertyGroup).toHaveBeenCalledWith('group-1', { name: 'Updated Name' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        group: mockUpdatedGroup
      });
    });
  });

  describe('getGroupSummary', () => {
    it('should return group summary', async () => {
      const mockSummary = {
        totalProperties: 5,
        totalRevenue: 150000,
        occupancyRate: 75
      };
      vi.mocked(multiPropertyService.getGroupSummary).mockResolvedValue(mockSummary);

      const { req, res } = createMockReqRes({
        params: { groupId: 'group-1' }
      });

      await multiPropertyController.getGroupSummary(req, res);

      expect(multiPropertyService.getGroupSummary).toHaveBeenCalledWith('group-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        summary: mockSummary
      });
    });
  });

  describe('getMyProperties', () => {
    it('should return user accessible properties', async () => {
      const mockProperties = [
        { id: 'prop-1', name: 'Hotel A' },
        { id: 'prop-2', name: 'Hotel B' }
      ];
      const mockPrimaryProperty = { id: 'prop-1', name: 'Hotel A' };
      vi.mocked(multiPropertyService.getUserAccessibleProperties).mockResolvedValue(mockProperties);
      vi.mocked(multiPropertyService.getUserPrimaryProperty).mockResolvedValue(mockPrimaryProperty);

      const { req, res } = createMockReqRes({
        user: { id: 'user-1', role: 'manager', userId: 'user-1' }
      });

      await multiPropertyController.getMyProperties(req, res);

      expect(multiPropertyService.getUserAccessibleProperties).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        properties: mockProperties,
        primary_property: mockPrimaryProperty
      });
    });

    it('should return 401 if not authenticated', async () => {
      const { req, res } = createMockReqRes();
      req.user = undefined;

      await multiPropertyController.getMyProperties(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });
  });
});
