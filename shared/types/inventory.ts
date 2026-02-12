// ============================================
// Inventory Domain Types
// ============================================

import type { UUID, BaseEntity } from './index';

export type InventoryUnit = 'unit' | 'kg' | 'g' | 'l' | 'ml' | 'box' | 'pack' | 'case' | 'dozen';
export type InventoryTransactionType = 'restock' | 'consume' | 'adjust' | 'waste' | 'transfer' | 'return' | 'count';
export type InventoryAlertType = 'low_stock' | 'out_of_stock' | 'expiring' | 'expired' | 'overstock';

export interface InventoryCategory extends BaseEntity {
  name: string;
  description?: string;
  parentId?: UUID;
  sortOrder: number;
}

export interface InventoryItem extends BaseEntity {
  sku?: string;
  name: string;
  description?: string;
  categoryId?: UUID;
  unit: InventoryUnit;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel?: number;
  reorderPoint: number;
  reorderQuantity: number;
  costPerUnit?: number;
  supplier?: string;
  supplierSku?: string;
  location?: string;
  isPerishable: boolean;
  expiryTracking: boolean;
  isActive: boolean;
  lastRestockDate?: Date;
  lastCountDate?: Date;
}

export interface InventoryTransaction {
  id: UUID;
  itemId: UUID;
  type: InventoryTransactionType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost?: number;
  totalCost?: number;
  referenceType?: string;
  referenceId?: UUID;
  reason?: string;
  notes?: string;
  batchNumber?: string;
  expiryDate?: string; // ISO date
  performedBy?: UUID;
  createdAt: Date;
}

export interface InventoryAlert {
  id: UUID;
  itemId: UUID;
  alertType: InventoryAlertType;
  message: string;
  isRead: boolean;
  isResolved: boolean;
  resolvedBy?: UUID;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface MenuItemIngredient {
  id: UUID;
  menuItemId: UUID;
  inventoryItemId: UUID;
  quantityRequired: number;
  unit: string;
  isOptional: boolean;
  createdAt: Date;
}

export interface Supplier extends BaseEntity {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
}

export interface PurchaseOrder extends BaseEntity {
  supplierId: UUID;
  orderNumber: string;
  status: 'draft' | 'submitted' | 'confirmed' | 'received' | 'cancelled';
  items: PurchaseOrderItem[];
  totalAmount: number;
  expectedDeliveryDate?: Date;
  receivedAt?: Date;
  notes?: string;
  createdBy: UUID;
}

export interface PurchaseOrderItem {
  id: UUID;
  purchaseOrderId: UUID;
  inventoryItemId: UUID;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQuantity?: number;
}

export interface Recipe extends BaseEntity {
  name: string;
  menuItemId?: UUID;
  ingredients: RecipeIngredient[];
  instructions?: string;
  yieldQuantity: number;
  yieldUnit: string;
}

export interface RecipeIngredient {
  inventoryItemId: UUID;
  quantityRequired: number;
  unit: string;
}
