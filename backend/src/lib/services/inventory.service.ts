/**
 * Inventory Service with Dependency Injection
 *
 * This service handles all inventory management operations including:
 * - Item CRUD operations
 * - Stock movements (in/out/adjustments)
 * - Low stock alerts
 * - Stock valuation
 * - Inventory reports
 *
 * All dependencies are injected via the container for testability.
 */

import type {
  Container,
  InventoryCategory,
  InventoryFilters,
  InventoryItem,
  StockMovement,
  StockMovementType,
} from '../container/types';

// Custom error class
export class InventoryServiceError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'InventoryServiceError';
  }
}

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid categories and movement types
const VALID_CATEGORIES: InventoryCategory[] = ['food', 'beverage', 'supplies', 'equipment', 'other'];
const VALID_MOVEMENT_TYPES: StockMovementType[] = ['in', 'out', 'adjustment', 'return', 'waste'];

// SKU format regex (alphanumeric with dashes)
const SKU_REGEX = /^[A-Z0-9]{2,4}-[A-Z0-9]{3,6}(-[A-Z0-9]+)?$/i;

export interface CreateItemInput {
  name: string;
  sku: string;
  category: InventoryCategory;
  unit: string;
  quantity?: number;
  minQuantity?: number;
  maxQuantity?: number;
  costPerUnit: number;
  supplierId?: string;
  location?: string;
  notes?: string;
}

export interface UpdateItemInput {
  name?: string;
  category?: InventoryCategory;
  unit?: string;
  minQuantity?: number;
  maxQuantity?: number;
  costPerUnit?: number;
  supplierId?: string;
  location?: string;
  notes?: string;
  isActive?: boolean;
}

export interface StockAdjustmentInput {
  itemId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  referenceId?: string;
  performedBy: string;
}

export interface StockTransferInput {
  itemId: string;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  performedBy: string;
}

export interface InventoryValuation {
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  byCategory: Record<InventoryCategory, { count: number; quantity: number; value: number }>;
}

export function createInventoryService(container: Container) {
  const { inventoryRepository, logger } = container;

  /**
   * Validates a UUID format
   */
  function isValidUUID(id: string): boolean {
    return UUID_REGEX.test(id);
  }

  /**
   * Validates SKU format
   */
  function isValidSku(sku: string): boolean {
    return SKU_REGEX.test(sku);
  }

  /**
   * Create a new inventory item
   */
  async function createItem(input: CreateItemInput): Promise<InventoryItem> {
    // Validate name
    if (!input.name || input.name.trim().length < 2) {
      throw new InventoryServiceError('Name must be at least 2 characters', 'INVALID_NAME');
    }
    if (input.name.length > 100) {
      throw new InventoryServiceError('Name cannot exceed 100 characters', 'NAME_TOO_LONG');
    }

    // Validate SKU
    if (!input.sku || !isValidSku(input.sku)) {
      throw new InventoryServiceError(
        'Invalid SKU format. Use format like AB-123 or ABC-1234-X',
        'INVALID_SKU'
      );
    }

    // Check for duplicate SKU
    const existingItem = await inventoryRepository.getBySku(input.sku);
    if (existingItem) {
      throw new InventoryServiceError('An item with this SKU already exists', 'DUPLICATE_SKU');
    }

    // Validate category
    if (!input.category || !VALID_CATEGORIES.includes(input.category)) {
      throw new InventoryServiceError(
        `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        'INVALID_CATEGORY'
      );
    }

    // Validate unit
    if (!input.unit || input.unit.trim().length === 0) {
      throw new InventoryServiceError('Unit is required', 'MISSING_UNIT');
    }

    // Validate quantities
    const quantity = input.quantity ?? 0;
    const minQuantity = input.minQuantity ?? 0;
    const maxQuantity = input.maxQuantity ?? 1000;

    if (quantity < 0) {
      throw new InventoryServiceError('Quantity cannot be negative', 'INVALID_QUANTITY');
    }
    if (minQuantity < 0) {
      throw new InventoryServiceError('Minimum quantity cannot be negative', 'INVALID_MIN_QUANTITY');
    }
    if (maxQuantity < minQuantity) {
      throw new InventoryServiceError(
        'Maximum quantity must be greater than or equal to minimum quantity',
        'INVALID_MAX_QUANTITY'
      );
    }

    // Validate cost
    if (input.costPerUnit < 0) {
      throw new InventoryServiceError('Cost per unit cannot be negative', 'INVALID_COST');
    }

    // Validate supplier ID if provided
    if (input.supplierId && !isValidUUID(input.supplierId)) {
      throw new InventoryServiceError('Invalid supplier ID format', 'INVALID_SUPPLIER_ID');
    }

    const item = await inventoryRepository.create({
      name: input.name.trim(),
      sku: input.sku.toUpperCase(),
      category: input.category,
      unit: input.unit.trim(),
      quantity,
      minQuantity,
      maxQuantity,
      costPerUnit: input.costPerUnit,
      supplierId: input.supplierId || null,
      location: input.location || null,
      notes: input.notes || null,
      isActive: true,
    });

    logger.info(`Created inventory item: ${item.id} (${item.sku})`);
    return item;
  }

  /**
   * Get item by ID
   */
  async function getItemById(id: string): Promise<InventoryItem | null> {
    if (!id || !isValidUUID(id)) {
      throw new InventoryServiceError('Invalid item ID format', 'INVALID_ITEM_ID');
    }
    return inventoryRepository.getById(id);
  }

  /**
   * Get item by SKU
   */
  async function getItemBySku(sku: string): Promise<InventoryItem | null> {
    if (!sku || sku.trim().length === 0) {
      throw new InventoryServiceError('SKU is required', 'MISSING_SKU');
    }
    return inventoryRepository.getBySku(sku.toUpperCase());
  }

  /**
   * List inventory items with filters
   */
  async function listItems(filters: InventoryFilters = {}): Promise<InventoryItem[]> {
    // Validate category filter if provided
    if (filters.category && !VALID_CATEGORIES.includes(filters.category)) {
      throw new InventoryServiceError('Invalid category filter', 'INVALID_CATEGORY_FILTER');
    }

    return inventoryRepository.getAll(filters);
  }

  /**
   * Update inventory item
   */
  async function updateItem(id: string, input: UpdateItemInput): Promise<InventoryItem> {
    if (!id || !isValidUUID(id)) {
      throw new InventoryServiceError('Invalid item ID format', 'INVALID_ITEM_ID');
    }

    const existing = await inventoryRepository.getById(id);
    if (!existing) {
      throw new InventoryServiceError('Inventory item not found', 'ITEM_NOT_FOUND');
    }

    // Validate name if provided
    if (input.name !== undefined) {
      if (input.name.trim().length < 2) {
        throw new InventoryServiceError('Name must be at least 2 characters', 'INVALID_NAME');
      }
      if (input.name.length > 100) {
        throw new InventoryServiceError('Name cannot exceed 100 characters', 'NAME_TOO_LONG');
      }
    }

    // Validate category if provided
    if (input.category && !VALID_CATEGORIES.includes(input.category)) {
      throw new InventoryServiceError('Invalid category', 'INVALID_CATEGORY');
    }

    // Validate quantities if provided
    const minQty = input.minQuantity ?? existing.minQuantity;
    const maxQty = input.maxQuantity ?? existing.maxQuantity;

    if (input.minQuantity !== undefined && input.minQuantity < 0) {
      throw new InventoryServiceError('Minimum quantity cannot be negative', 'INVALID_MIN_QUANTITY');
    }
    if (input.maxQuantity !== undefined && maxQty < minQty) {
      throw new InventoryServiceError(
        'Maximum quantity must be greater than or equal to minimum quantity',
        'INVALID_MAX_QUANTITY'
      );
    }

    // Validate cost if provided
    if (input.costPerUnit !== undefined && input.costPerUnit < 0) {
      throw new InventoryServiceError('Cost per unit cannot be negative', 'INVALID_COST');
    }

    // Validate supplier ID if provided
    if (input.supplierId && !isValidUUID(input.supplierId)) {
      throw new InventoryServiceError('Invalid supplier ID format', 'INVALID_SUPPLIER_ID');
    }

    const updated = await inventoryRepository.update(id, {
      ...(input.name && { name: input.name.trim() }),
      ...(input.category && { category: input.category }),
      ...(input.unit && { unit: input.unit.trim() }),
      ...(input.minQuantity !== undefined && { minQuantity: input.minQuantity }),
      ...(input.maxQuantity !== undefined && { maxQuantity: input.maxQuantity }),
      ...(input.costPerUnit !== undefined && { costPerUnit: input.costPerUnit }),
      ...(input.supplierId !== undefined && { supplierId: input.supplierId }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });

    logger.info(`Updated inventory item: ${id}`);
    return updated;
  }

  /**
   * Delete inventory item (soft delete by deactivating)
   */
  async function deleteItem(id: string): Promise<void> {
    if (!id || !isValidUUID(id)) {
      throw new InventoryServiceError('Invalid item ID format', 'INVALID_ITEM_ID');
    }

    const existing = await inventoryRepository.getById(id);
    if (!existing) {
      throw new InventoryServiceError('Inventory item not found', 'ITEM_NOT_FOUND');
    }

    // Check if item has stock - require zero quantity for deletion
    if (existing.quantity > 0) {
      throw new InventoryServiceError(
        'Cannot delete item with remaining stock. Adjust quantity to zero first.',
        'HAS_STOCK'
      );
    }

    await inventoryRepository.delete(id);
    logger.info(`Deleted inventory item: ${id}`);
  }

  /**
   * Adjust stock (in, out, adjustment, return, waste)
   */
  async function adjustStock(input: StockAdjustmentInput): Promise<StockMovement> {
    // Validate item ID
    if (!input.itemId || !isValidUUID(input.itemId)) {
      throw new InventoryServiceError('Invalid item ID format', 'INVALID_ITEM_ID');
    }

    // Validate movement type
    if (!input.type || !VALID_MOVEMENT_TYPES.includes(input.type)) {
      throw new InventoryServiceError(
        `Invalid movement type. Must be one of: ${VALID_MOVEMENT_TYPES.join(', ')}`,
        'INVALID_MOVEMENT_TYPE'
      );
    }

    // Validate quantity
    if (input.quantity <= 0) {
      throw new InventoryServiceError('Quantity must be a positive number', 'INVALID_QUANTITY');
    }

    // Validate performed by
    if (!input.performedBy || !isValidUUID(input.performedBy)) {
      throw new InventoryServiceError('Invalid performer ID format', 'INVALID_PERFORMER_ID');
    }

    // Validate reference ID if provided
    if (input.referenceId && !isValidUUID(input.referenceId)) {
      throw new InventoryServiceError('Invalid reference ID format', 'INVALID_REFERENCE_ID');
    }

    // Get current item
    const item = await inventoryRepository.getById(input.itemId);
    if (!item) {
      throw new InventoryServiceError('Inventory item not found', 'ITEM_NOT_FOUND');
    }

    if (!item.isActive) {
      throw new InventoryServiceError('Cannot adjust stock for inactive item', 'ITEM_INACTIVE');
    }

    // Calculate new quantity
    let newQuantity: number;
    const previousQuantity = item.quantity;

    switch (input.type) {
      case 'in':
      case 'return':
        newQuantity = previousQuantity + input.quantity;
        break;
      case 'out':
      case 'waste':
        newQuantity = previousQuantity - input.quantity;
        if (newQuantity < 0) {
          throw new InventoryServiceError(
            `Insufficient stock. Current: ${previousQuantity}, Requested: ${input.quantity}`,
            'INSUFFICIENT_STOCK'
          );
        }
        break;
      case 'adjustment':
        // For adjustments, quantity is the absolute new quantity
        newQuantity = input.quantity;
        break;
      default:
        throw new InventoryServiceError('Invalid movement type', 'INVALID_MOVEMENT_TYPE');
    }

    // Check max quantity for incoming stock
    if ((input.type === 'in' || input.type === 'return') && newQuantity > item.maxQuantity) {
      throw new InventoryServiceError(
        `Exceeds maximum quantity. Max: ${item.maxQuantity}, Would be: ${newQuantity}`,
        'EXCEEDS_MAX_QUANTITY'
      );
    }

    // Record the movement
    const movement = await inventoryRepository.recordMovement({
      itemId: input.itemId,
      type: input.type,
      quantity: input.quantity,
      previousQuantity,
      newQuantity,
      reason: input.reason || null,
      referenceId: input.referenceId || null,
      performedBy: input.performedBy,
    });

    logger.info(
      `Stock ${input.type}: ${item.sku} ${previousQuantity} -> ${newQuantity} by ${input.performedBy}`
    );

    return movement;
  }

  /**
   * Add stock (convenience method)
   */
  async function addStock(
    itemId: string,
    quantity: number,
    performedBy: string,
    reason?: string
  ): Promise<StockMovement> {
    return adjustStock({
      itemId,
      type: 'in',
      quantity,
      performedBy,
      reason,
    });
  }

  /**
   * Remove stock (convenience method)
   */
  async function removeStock(
    itemId: string,
    quantity: number,
    performedBy: string,
    reason?: string,
    referenceId?: string
  ): Promise<StockMovement> {
    return adjustStock({
      itemId,
      type: 'out',
      quantity,
      performedBy,
      reason,
      referenceId,
    });
  }

  /**
   * Record waste
   */
  async function recordWaste(
    itemId: string,
    quantity: number,
    performedBy: string,
    reason: string
  ): Promise<StockMovement> {
    if (!reason || reason.trim().length === 0) {
      throw new InventoryServiceError('Reason is required for waste', 'MISSING_REASON');
    }
    return adjustStock({
      itemId,
      type: 'waste',
      quantity,
      performedBy,
      reason,
    });
  }

  /**
   * Get stock movements for an item
   */
  async function getStockMovements(itemId: string, limit = 50): Promise<StockMovement[]> {
    if (!itemId || !isValidUUID(itemId)) {
      throw new InventoryServiceError('Invalid item ID format', 'INVALID_ITEM_ID');
    }
    if (limit < 1 || limit > 1000) {
      throw new InventoryServiceError('Limit must be between 1 and 1000', 'INVALID_LIMIT');
    }
    return inventoryRepository.getMovements(itemId, limit);
  }

  /**
   * Get low stock items
   */
  async function getLowStockItems(): Promise<InventoryItem[]> {
    return inventoryRepository.getLowStockItems();
  }

  /**
   * Get low stock count
   */
  async function getLowStockCount(): Promise<number> {
    const items = await getLowStockItems();
    return items.length;
  }

  /**
   * Check if item is low stock
   */
  async function isLowStock(itemId: string): Promise<boolean> {
    const item = await getItemById(itemId);
    if (!item) {
      throw new InventoryServiceError('Item not found', 'ITEM_NOT_FOUND');
    }
    return item.quantity <= item.minQuantity;
  }

  /**
   * Get inventory valuation
   */
  async function getValuation(): Promise<InventoryValuation> {
    const items = await inventoryRepository.getAll({ isActive: true });

    const byCategory: Record<InventoryCategory, { count: number; quantity: number; value: number }> = {
      food: { count: 0, quantity: 0, value: 0 },
      beverage: { count: 0, quantity: 0, value: 0 },
      supplies: { count: 0, quantity: 0, value: 0 },
      equipment: { count: 0, quantity: 0, value: 0 },
      other: { count: 0, quantity: 0, value: 0 },
    };

    let totalItems = 0;
    let totalQuantity = 0;
    let totalValue = 0;

    for (const item of items) {
      const itemValue = item.quantity * item.costPerUnit;

      totalItems++;
      totalQuantity += item.quantity;
      totalValue += itemValue;

      byCategory[item.category].count++;
      byCategory[item.category].quantity += item.quantity;
      byCategory[item.category].value += itemValue;
    }

    return {
      totalItems,
      totalQuantity,
      totalValue: Math.round(totalValue * 100) / 100,
      byCategory,
    };
  }

  /**
   * Get items by category
   */
  async function getItemsByCategory(category: InventoryCategory): Promise<InventoryItem[]> {
    if (!VALID_CATEGORIES.includes(category)) {
      throw new InventoryServiceError('Invalid category', 'INVALID_CATEGORY');
    }
    return inventoryRepository.getAll({ category, isActive: true });
  }

  /**
   * Search items
   */
  async function searchItems(query: string): Promise<InventoryItem[]> {
    if (!query || query.trim().length < 2) {
      throw new InventoryServiceError('Search query must be at least 2 characters', 'INVALID_QUERY');
    }
    return inventoryRepository.getAll({ search: query.trim() });
  }

  /**
   * Get available categories
   */
  function getCategories(): InventoryCategory[] {
    return [...VALID_CATEGORIES];
  }

  /**
   * Get available movement types
   */
  function getMovementTypes(): StockMovementType[] {
    return [...VALID_MOVEMENT_TYPES];
  }

  /**
   * Validate SKU format
   */
  function validateSku(sku: string): boolean {
    return isValidSku(sku);
  }

  /**
   * Generate SKU suggestion
   */
  function generateSkuSuggestion(category: InventoryCategory, name: string): string {
    const catPrefix = category.substring(0, 3).toUpperCase();
    const nameCode = name
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 4)
      .toUpperCase();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `${catPrefix}-${nameCode}${random}`;
  }

  return {
    // CRUD operations
    createItem,
    getItemById,
    getItemBySku,
    listItems,
    updateItem,
    deleteItem,

    // Stock operations
    adjustStock,
    addStock,
    removeStock,
    recordWaste,
    getStockMovements,

    // Low stock
    getLowStockItems,
    getLowStockCount,
    isLowStock,

    // Reports
    getValuation,
    getItemsByCategory,
    searchItems,

    // Utilities
    getCategories,
    getMovementTypes,
    validateSku,
    generateSkuSuggestion,
  };
}

export type InventoryService = ReturnType<typeof createInventoryService>;
