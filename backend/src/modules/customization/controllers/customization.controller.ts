import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { customizationService } from '../services/customization.service.js';
import { logger } from '../../../utils/logger.js';
import { getCallerTenantId } from '../../../security/tenant-scope.js';
import type {
  CustomizableEntityType,
  CreateCustomizationGroupRequest,
  UpdateCustomizationGroupRequest,
  CreateCustomizationOptionRequest,
  UpdateCustomizationOptionRequest,
  LinkCustomizationRequest,
  UpdateEntityCustomizationRequest,
  CustomizationSelection
} from '../services/customization.service.js';

/**
 * Resolve the tenant scope a request should be limited to.
 * Moved to backend/src/security/tenant-scope.ts so every controller shares
 * one implementation instead of reinventing it (see remediation plan 1.1/1.2).
 */
const tenantScopeFor = getCallerTenantId;

/**
 * Unified Customization Controller
 * REST API endpoints for managing customizations across all modules
 */
class CustomizationController {

  // ==========================================
  // GROUP ENDPOINTS
  // ==========================================

  /**
   * POST /api/customizations/groups
   * Create a new customization group
   */
  createGroup = asyncHandler(async (req: Request, res: Response) => {
      const data: CreateCustomizationGroupRequest = req.body;

      // Validate required fields
      if (!data.name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      if (!data.selectionMode) {
        res.status(400).json({ error: 'Selection mode is required' });
        return;
      }
      if (!data.applicableEntityTypes || data.applicableEntityTypes.length === 0) {
        res.status(400).json({ error: 'At least one applicable entity type is required' });
        return;
      }

      const group = await customizationService.createGroup(data, { tenantId: tenantScopeFor(req) });
      
      logger.info('Customization group created', { groupId: group.id, name: group.name });
      res.status(201).json(group);
  });
  /**
   * PUT /api/customizations/groups/:id
   * Update a customization group
   */
  updateGroup = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const data: UpdateCustomizationGroupRequest = req.body;

      const group = await customizationService.updateGroup(id, data, tenantScopeFor(req));
      
      logger.info('Customization group updated', { groupId: id });
      res.json(group);
  });
  /**
   * DELETE /api/customizations/groups/:id
   * Soft delete a customization group
   */
  deleteGroup = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      await customizationService.deleteGroup(id, tenantScopeFor(req));
      
      logger.info('Customization group deleted', { groupId: id });
      res.status(204).send();
  });
  /**
   * GET /api/customizations/groups/:id
   * Get a single customization group
   */
  getGroup = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const includeOptions = req.query.includeOptions === 'true';

      const group = await customizationService.getGroup(id, includeOptions, tenantScopeFor(req));
      
      if (!group) {
        res.status(404).json({ error: 'Customization group not found' });
        return;
      }

      res.json(group);
  });
  /**
   * GET /api/customizations/groups
   * List all customization groups
   */
  listGroups = asyncHandler(async (req: Request, res: Response) => {
      const entityType = req.query.entityType as CustomizableEntityType | undefined;
      const isGlobal = req.query.isGlobal === 'true' ? true : req.query.isGlobal === 'false' ? false : undefined;
      const includeOptions = req.query.includeOptions === 'true';

      const groups = await customizationService.listGroups({
        entityType,
        isGlobal,
        includeOptions,
        tenantId: tenantScopeFor(req),
      });

      res.json(groups);
  });
  // ==========================================
  // OPTION ENDPOINTS
  // ==========================================

  /**
   * POST /api/customizations/options
   * Create a new customization option
   */
  createOption = asyncHandler(async (req: Request, res: Response) => {
      const data: CreateCustomizationOptionRequest = req.body;

      // Validate required fields
      if (!data.groupId) {
        res.status(400).json({ error: 'Group ID is required' });
        return;
      }
      if (!data.name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      if (!data.customizationType) {
        res.status(400).json({ error: 'Customization type is required' });
        return;
      }

      const option = await customizationService.createOption(data, tenantScopeFor(req));
      
      logger.info('Customization option created', { optionId: option.id, name: option.name });
      res.status(201).json(option);
  });
  /**
   * PUT /api/customizations/options/:id
   * Update a customization option
   */
  updateOption = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const data: UpdateCustomizationOptionRequest = req.body;

      const option = await customizationService.updateOption(id, data, tenantScopeFor(req));
      
      logger.info('Customization option updated', { optionId: id });
      res.json(option);
  });
  /**
   * DELETE /api/customizations/options/:id
   * Soft delete a customization option
   */
  deleteOption = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      await customizationService.deleteOption(id, tenantScopeFor(req));
      
      logger.info('Customization option deleted', { optionId: id });
      res.status(204).send();
  });
  /**
   * GET /api/customizations/groups/:groupId/options
   * Get all options for a group
   */
  getOptionsForGroup = asyncHandler(async (req: Request, res: Response) => {
      const { groupId } = req.params;

      const options = await customizationService.getOptionsForGroup(groupId, tenantScopeFor(req));

      res.json(options);
  });
  // ==========================================
  // ENTITY LINKING ENDPOINTS
  // ==========================================

  /**
   * POST /api/customizations/entity-links
   * Link a customization group to an entity
   */
  linkToEntity = asyncHandler(async (req: Request, res: Response) => {
      const data: LinkCustomizationRequest = req.body;

      // Validate required fields
      if (!data.entityType) {
        res.status(400).json({ error: 'Entity type is required' });
        return;
      }
      if (!data.entityId) {
        res.status(400).json({ error: 'Entity ID is required' });
        return;
      }
      if (!data.customizationGroupId) {
        res.status(400).json({ error: 'Customization group ID is required' });
        return;
      }

      const link = await customizationService.linkToEntity(data);
      
      logger.info('Customization linked to entity', { 
        linkId: link.id, 
        entityType: data.entityType,
        entityId: data.entityId,
        groupId: data.customizationGroupId
      });
      res.status(201).json(link);
  });
  /**
   * PUT /api/customizations/entity-links/:id
   * Update an entity customization link
   */
  updateEntityLink = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const data: UpdateEntityCustomizationRequest = req.body;

      const link = await customizationService.updateEntityLink(id, data);
      
      logger.info('Entity customization link updated', { linkId: id });
      res.json(link);
  });
  /**
   * DELETE /api/customizations/entity-links/:id
   * Remove an entity customization link
   */
  unlinkFromEntity = asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;

      await customizationService.unlinkFromEntity(id);
      
      logger.info('Customization unlinked from entity', { linkId: id });
      res.status(204).send();
  });
  /**
   * GET /api/customizations/entity-links
   * Get all customization links for an entity
   */
  getEntityLinks = asyncHandler(async (req: Request, res: Response) => {
      const entityType = req.query.entityType as CustomizableEntityType;
      const entityId = req.query.entityId as string;

      if (!entityType || !entityId) {
        res.status(400).json({ error: 'Entity type and entity ID are required' });
        return;
      }

      const links = await customizationService.getEntityLinks(entityType, entityId);

      res.json(links);
  });
  // ==========================================
  // CUSTOMER-FACING ENDPOINTS
  // ==========================================

  /**
   * GET /api/customizations/for-entity/:entityType/:entityId
   * Get available customizations for an entity (customer-facing)
   */
  getCustomizationsForEntity = asyncHandler(async (req: Request, res: Response) => {
      const entityType = req.params.entityType as CustomizableEntityType;
      const { entityId } = req.params;

      if (!entityType || !entityId) {
        res.status(400).json({ error: 'Entity type and entity ID are required' });
        return;
      }

      const customizations = await customizationService.getCustomizationsForEntity(entityType, entityId);

      res.json(customizations);
  });
  /**
   * POST /api/customizations/validate
   * Validate customer selections
   */
  validateSelections = asyncHandler(async (req: Request, res: Response) => {
      const { entityType, entityId, selections } = req.body as {
        entityType: CustomizableEntityType;
        entityId: string;
        selections: CustomizationSelection[];
      };

      if (!entityType || !entityId) {
        res.status(400).json({ error: 'Entity type and entity ID are required' });
        return;
      }

      const result = await customizationService.validateSelections(
        entityType,
        entityId,
        selections || []
      );

      res.json(result);
  });
  /**
   * GET /api/customizations/orders/:orderType/:orderId
   * Get customizations for an order (for receipts, staff display)
   */
  getOrderCustomizations = asyncHandler(async (req: Request, res: Response) => {
      const { orderType, orderId } = req.params;
      const orderItemId = req.query.orderItemId as string | undefined;

      const customizations = await customizationService.getOrderCustomizations(
        orderType,
        orderId,
        orderItemId
      );

      res.json(customizations);
  });
  // ==========================================
  // TRANSACTIONAL ORDER SNAPSHOT
  // ==========================================

  /**
   * POST /api/customizations/orders/snapshot
   * Create transactional order snapshot with inventory execution
   */
  createOrderSnapshot = asyncHandler(async (req: Request, res: Response) => {
      const { 
        orderType, 
        orderId, 
        orderItemId,
        entityType, 
        entityId, 
        selections,
        baseQuantity,
        executeInventory 
      } = req.body;

      if (!orderType || !orderId || !entityType || !entityId) {
        res.status(400).json({ 
          error: 'orderType, orderId, entityType, and entityId are required' 
        });
        return;
      }

      const result = await customizationService.createOrderSnapshot({
        orderType,
        orderId,
        orderItemId,
        entityType,
        entityId,
        selections: selections || [],
        baseQuantity,
        executeInventory
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          errors: result.errors
        });
        return;
      }

      logger.info('Order snapshot created', { 
        orderType, 
        orderId, 
        snapshotId: result.snapshotId 
      });

      res.status(201).json(result);
  });
  // ==========================================
  // REFUND & REVERSAL
  // ==========================================

  /**
   * POST /api/customizations/orders/reverse
   * Reverse inventory for refund/cancellation
   */
  reverseOrderItemInventory = asyncHandler(async (req: Request, res: Response) => {
      const { snapshotId, reason } = req.body;
      const reversedBy = req.user?.id;

      if (!snapshotId) {
        res.status(400).json({ error: 'snapshotId is required' });
        return;
      }

      const result = await customizationService.reverseOrderItemInventory(
        snapshotId,
        reason || 'Refund',
        reversedBy
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: result.errorMessage
        });
        return;
      }

      logger.info('Order inventory reversed', { 
        snapshotId, 
        itemsReversed: result.itemsReversed 
      });

      res.json(result);
  });
  /**
   * GET /api/customizations/orders/:orderType/:orderId/reversible
   * Get reversible customizations for an order
   */
  getReversibleCustomizations = asyncHandler(async (req: Request, res: Response) => {
      const { orderType, orderId } = req.params;

      const customizations = await customizationService.getReversibleOrderCustomizations(
        orderType,
        orderId
      );

      res.json(customizations);
  });
  // ==========================================
  // OBSERVABILITY ENDPOINTS
  // ==========================================

  /**
   * GET /api/customizations/events
   * Get customization events for monitoring
   */
  getEvents = asyncHandler(async (req: Request, res: Response) => {
      const { eventType, orderType, orderId, limit, since } = req.query;

      const events = await customizationService.getEvents({
        eventType: eventType as string,
        orderType: orderType as string,
        orderId: orderId as string,
        limit: limit ? parseInt(limit as string) : undefined,
        since: since ? new Date(since as string) : undefined
      });

      res.json(events);
  });
  /**
   * GET /api/customizations/metrics
   * Get metrics summary for performance monitoring
   */
  getMetricsSummary = asyncHandler(async (req: Request, res: Response) => {
      const metrics = await customizationService.getMetricsSummary();
      res.json(metrics);
  });
  // ==========================================
  // DUAL-WRITE MONITORING
  // ==========================================

  /**
   * GET /api/customizations/dual-write/stats
   * Get dual-write match rate statistics
   */
  getDualWriteStats = asyncHandler(async (req: Request, res: Response) => {
      const stats = await customizationService.getDualWriteStats();
      res.json(stats);
  });
  /**
   * GET /api/customizations/dual-write/discrepancies
   * Get dual-write discrepancies for debugging
   */
  getDualWriteDiscrepancies = asyncHandler(async (req: Request, res: Response) => {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const discrepancies = await customizationService.getDualWriteDiscrepancies(limit);
      res.json(discrepancies);
  });
  // ==========================================
  // ADMIN UTILITIES
  // ==========================================

  /**
   * POST /api/customizations/migrate
   * Migrate existing menu modifiers to unified system (admin only)
   */
  migrateMenuModifiers = asyncHandler(async (req: Request, res: Response) => {
      const result = await customizationService.migrateMenuModifiers();
      
      logger.info('Menu modifiers migrated to unified system', result);
      res.json({
        message: 'Migration completed',
        ...result
      });
  });
}

// Export singleton instance
export const customizationController = new CustomizationController();
export default customizationController;
