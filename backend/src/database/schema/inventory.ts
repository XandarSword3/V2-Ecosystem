import { pgTable, uuid, varchar, text, boolean, timestamp, integer, decimal, jsonb } from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================
// Inventory Categories
// ============================================
export const inventoryCategories = pgTable('inventory_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }).default('#6B7280'),
  parentId: uuid('parent_id'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Inventory Items
// ============================================
export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 100 }).unique(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => inventoryCategories.id),
  unit: varchar('unit', { length: 50 }).default('piece').notNull(),
  currentStock: decimal('current_stock', { precision: 10, scale: 2 }).default('0'),
  minStockLevel: decimal('min_stock_level', { precision: 10, scale: 2 }).default('0'),
  maxStockLevel: decimal('max_stock_level', { precision: 10, scale: 2 }),
  reorderPoint: decimal('reorder_point', { precision: 10, scale: 2 }).default('10'),
  costPerUnit: decimal('cost_per_unit', { precision: 10, scale: 2 }),
  lastPurchasePrice: decimal('last_purchase_price', { precision: 10, scale: 2 }),
  supplier: varchar('supplier', { length: 255 }),
  location: varchar('location', { length: 255 }),
  expiryDate: timestamp('expiry_date'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// ============================================
// Inventory Transactions
// ============================================
export const inventoryTransactions = pgTable('inventory_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').references(() => inventoryItems.id).notNull(),
  transactionType: varchar('transaction_type', { length: 20 }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal('unit_cost', { precision: 10, scale: 2 }),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }),
  costImpact: decimal('cost_impact', { precision: 10, scale: 2 }),
  stockBefore: decimal('stock_before', { precision: 10, scale: 2 }),
  stockAfter: decimal('stock_after', { precision: 10, scale: 2 }),
  referenceType: varchar('reference_type', { length: 50 }),
  referenceId: uuid('reference_id'),
  notes: text('notes'),
  performedBy: uuid('performed_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Inventory Alerts
// ============================================
export const inventoryAlerts = pgTable('inventory_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').references(() => inventoryItems.id).notNull(),
  alertType: varchar('alert_type', { length: 20 }).notNull(),
  message: text('message').notNull(),
  severity: varchar('severity', { length: 20 }).default('warning'),
  isResolved: boolean('is_resolved').default(false),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Recipes
// ============================================
export const inventoryRecipes = pgTable('inventory_recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  catalogItemId: uuid('catalog_item_id').notNull(),
  name: varchar('name', { length: 255 }),
  yields: integer('yields').default(1),
  prepTimeMinutes: integer('prep_time_minutes'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Recipe Ingredients
// ============================================
export const inventoryRecipeIngredients = pgTable('inventory_recipe_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').references(() => inventoryRecipes.id).notNull(),
  inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 3 }).notNull(),
  unit: varchar('unit', { length: 50 }),
  isOptional: boolean('is_optional').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Suppliers
// ============================================
export const inventorySuppliers = pgTable('inventory_suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  contactName: varchar('contact_name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  paymentTerms: varchar('payment_terms', { length: 100 }),
  leadTimeDays: integer('lead_time_days').default(3),
  notes: text('notes'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Purchase Orders
// ============================================
export const inventoryPurchaseOrders = pgTable('inventory_purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  poNumber: varchar('po_number', { length: 50 }).notNull().unique(),
  supplierId: uuid('supplier_id').references(() => inventorySuppliers.id),
  status: varchar('status', { length: 20 }).default('draft'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }),
  expectedDelivery: timestamp('expected_delivery'),
  receivedDate: timestamp('received_date'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Purchase Order Items
// ============================================
export const inventoryPurchaseOrderItems = pgTable('inventory_purchase_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').references(() => inventoryPurchaseOrders.id).notNull(),
  itemId: uuid('item_id').references(() => inventoryItems.id).notNull(),
  quantityOrdered: decimal('quantity_ordered', { precision: 10, scale: 4 }).notNull(),
  quantityReceived: decimal('quantity_received', { precision: 10, scale: 4 }).default('0'),
  unitCost: decimal('unit_cost', { precision: 10, scale: 4 }),
  totalCost: decimal('total_cost', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Inventory Batches (FIFO)
// ============================================
export const inventoryBatches = pgTable('inventory_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').references(() => inventoryItems.id).notNull(),
  batchNumber: varchar('batch_number', { length: 100 }),
  quantity: decimal('quantity', { precision: 10, scale: 4 }).notNull(),
  remainingQuantity: decimal('remaining_quantity', { precision: 10, scale: 4 }).notNull(),
  costPerUnit: decimal('cost_per_unit', { precision: 10, scale: 4 }),
  purchaseOrderId: uuid('purchase_order_id').references(() => inventoryPurchaseOrders.id),
  receivedDate: timestamp('received_date').defaultNow(),
  expiryDate: timestamp('expiry_date'),
  location: varchar('location', { length: 100 }),
  status: varchar('status', { length: 20 }).default('active'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Inventory Wastage
// ============================================
export const inventoryWastage = pgTable('inventory_wastage', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').references(() => inventoryItems.id).notNull(),
  batchId: uuid('batch_id').references(() => inventoryBatches.id),
  quantity: decimal('quantity', { precision: 10, scale: 4 }).notNull(),
  reason: varchar('reason', { length: 50 }).notNull(),
  notes: text('notes'),
  photoUrl: text('photo_url'),
  costImpact: decimal('cost_impact', { precision: 10, scale: 2 }),
  reportedBy: uuid('reported_by').references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvalStatus: varchar('approval_status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Inventory Variance
// ============================================
export const inventoryVariance = pgTable('inventory_variance', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').references(() => inventoryItems.id).notNull(),
  countDate: timestamp('count_date').notNull(),
  systemQuantity: decimal('system_quantity', { precision: 10, scale: 4 }).notNull(),
  actualQuantity: decimal('actual_quantity', { precision: 10, scale: 4 }).notNull(),
  varianceQuantity: decimal('variance_quantity', { precision: 10, scale: 4 }).notNull(),
  variancePercentage: decimal('variance_percentage', { precision: 5, scale: 2 }),
  varianceCost: decimal('variance_cost', { precision: 10, scale: 2 }),
  reason: text('reason'),
  countedBy: uuid('counted_by').references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  status: varchar('status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================
// Inventory Consumption (Housekeeping)
// ============================================
export const inventoryConsumption = pgTable('inventory_consumption', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id'),
  inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  recordedAt: timestamp('recorded_at').defaultNow(),
});

// ============================================
// Inventory BOM (Bill of Materials)
// ============================================
export const inventoryBom = pgTable('inventory_bom', {
  id: uuid('id').primaryKey().defaultRandom(),
  catalogItemId: uuid('catalog_item_id').notNull(),
  inventoryItemId: uuid('inventory_item_id').references(() => inventoryItems.id).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 4 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
