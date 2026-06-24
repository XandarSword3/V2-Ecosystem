// ============================================
// V2 Ecosystem - Unified Customization System Types
// Module-agnostic customization for all present and future modules
// ============================================

import { UUID, BaseEntity } from './index';

// ----- Enums -----

/**
 * How the customization affects the base item
 */
export type CustomizationType = 
  | 'add'      // Include extra item/service
  | 'remove'   // Exclude from recipe/package
  | 'swap'     // Replace one item with another
  | 'upgrade'  // Premium version
  | 'replace'; // Full replacement

/**
 * Entity types that support customizations
 * Add new types as modules are built
 */
export type CustomizableEntityType =
  | 'menu_item'      // Menu service items
  | 'kiosk_item'         // Kiosk items
  | 'accommodation_unit' // Accommodation units
  | 'pool_session'   // Pool sessions/bookings
  | 'spa_service'    // Spa services (future)
  | 'activity'       // Activities/excursions (future)
  | 'rental_item'    // Equipment rentals (future)
  | 'event_ticket'   // Events/shows (future)
  | 'room'           // Hotel rooms (future)
  | 'package';       // Bundled packages (future)

/**
 * How users select options in a group
 */
export type SelectionMode = 
  | 'single'   // Radio button style
  | 'multiple' // Checkbox style
  | 'quantity'; // Quantity picker

/**
 * How price adjustment is calculated
 */
export type PriceType = 
  | 'fixed'       // Fixed amount added
  | 'percentage'  // Percentage of base price
  | 'per_unit'    // Per unit/item
  | 'per_night'   // Per night (accommodations)
  | 'per_person'; // Per person

// ----- Core Types -----

/**
 * Customization group (e.g., "Toppings", "Room Add-ons")
 */
export interface CustomizationGroup extends BaseEntity {
  // Identity
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;

  // Display
  displayName?: string;      // Customer-facing name
  displayNameAr?: string;
  icon?: string;             // Lucide icon name

  // Selection rules
  selectionMode: SelectionMode;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;

  // Applicability
  applicableEntityTypes: CustomizableEntityType[];
  isGlobal: boolean;         // Available to all entities of applicable types

  // Availability
  isAvailable: boolean;
  availableFrom?: string;    // Time string "HH:mm"
  availableUntil?: string;
  availableDays?: number[];  // 0=Sunday, 1=Monday, etc.

  // Conditional display
  displayConditions?: CustomizationDisplayConditions;

  // Sorting
  sortOrder: number;

  // Relations (when loaded)
  options?: CustomizationOption[];
}

/**
 * Conditions for when to display a customization group
 */
export interface CustomizationDisplayConditions {
  minOrderTotal?: number;
  maxOrderTotal?: number;
  requiresMembership?: boolean;
  membershipTiers?: string[];
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek?: number[];
  seasonalOnly?: boolean;
  seasons?: string[];
}

/**
 * Individual customization option within a group
 */
export interface CustomizationOption extends BaseEntity {
  groupId: UUID;

  // Identity
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;

  // Behavior
  customizationType: CustomizationType;

  // Pricing
  priceAdjustment: number;
  priceType: PriceType;

  // Inventory integration
  inventoryItemId?: UUID;
  quantityPerSelection: number;
  inventoryUnit: string;

  // For swap type
  replacesInventoryItemId?: UUID;

  // Quantity options
  maxQuantity: number;
  quantityIncrement: number;

  // Display
  isDefault: boolean;
  isPopular: boolean;
  badgeText?: string;
  badgeColor?: string;
  imageUrl?: string;

  // Availability
  isAvailable: boolean;
  availableStock?: number;   // NULL = unlimited

  // Sorting
  sortOrder: number;
}

/**
 * Links a customization group to a specific entity
 */
export interface EntityCustomization {
  id: UUID;
  entityType: CustomizableEntityType;
  entityId: UUID;
  customizationGroupId: UUID;

  // Override settings for this entity
  isRequiredOverride?: boolean;
  minSelectionsOverride?: number;
  maxSelectionsOverride?: number;
  priceMultiplier: number;

  isEnabled: boolean;
  sortOrder: number;
  createdAt: Date;

  // Relations (when loaded)
  group?: CustomizationGroup;
}

/**
 * Immutable record of customization applied to an order
 */
export interface OrderCustomization {
  id: UUID;
  orderType: string;
  orderId: UUID;
  orderItemId?: UUID;

  // References
  customizationGroupId?: UUID;
  customizationOptionId?: UUID;

  // Snapshot values (immutable)
  groupName: string;
  optionName: string;
  customizationType: string;
  quantity: number;

  // Pricing at time of order
  unitPriceAdjustment: number;
  totalPriceAdjustment: number;

  // Inventory tracking
  inventoryItemId?: UUID;
  inventoryQuantityUsed?: number;
  inventoryDeducted: boolean;

  createdAt: Date;
}

// ----- API Request/Response Types -----

/**
 * Selection made by customer
 */
export interface CustomizationSelection {
  groupId: UUID;
  optionId: UUID;
  quantity: number;
}

/**
 * Validated selection with calculated values
 */
export interface ValidatedSelection extends CustomizationSelection {
  groupName: string;
  optionName: string;
  customizationType: CustomizationType;
  unitPrice: number;
  totalPrice: number;
  inventoryItemId?: UUID;
  quantityPerSelection: number;
  replacesInventoryItemId?: UUID;
}

/**
 * Result from validate_customizations function
 */
export interface CustomizationValidationResult {
  isValid: boolean;
  totalPriceAdjustment: number;
  validatedSelections: ValidatedSelection[];
  validationErrors: string[];
}

/**
 * Group with options for display
 */
export interface CustomizationGroupWithOptions {
  groupId: UUID;
  groupName: string;
  groupNameAr?: string;
  displayName?: string;
  displayNameAr?: string;
  selectionMode: SelectionMode;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  options: CustomizationOptionDisplay[];
}

/**
 * Option formatted for display
 */
export interface CustomizationOptionDisplay {
  id: UUID;
  name: string;
  nameAr?: string;
  description?: string;
  customizationType: CustomizationType;
  priceAdjustment: number;
  priceType: PriceType;
  maxQuantity: number;
  isDefault: boolean;
  isPopular: boolean;
  badgeText?: string;
  imageUrl?: string;
  isAvailable: boolean;
  inventoryItemId?: UUID;
  quantityPerSelection: number;
  sortOrder: number;
}

// ----- Admin API Types -----

/**
 * Request to create a customization group
 */
export interface CreateCustomizationGroupRequest {
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  displayName?: string;
  displayNameAr?: string;
  icon?: string;
  selectionMode: SelectionMode;
  minSelections?: number;
  maxSelections?: number;
  isRequired?: boolean;
  applicableEntityTypes: CustomizableEntityType[];
  isGlobal?: boolean;
  availableFrom?: string;
  availableUntil?: string;
  availableDays?: number[];
  displayConditions?: CustomizationDisplayConditions;
  sortOrder?: number;
}

/**
 * Request to update a customization group
 */
export interface UpdateCustomizationGroupRequest extends Partial<CreateCustomizationGroupRequest> {
  isAvailable?: boolean;
}

/**
 * Request to create a customization option
 */
export interface CreateCustomizationOptionRequest {
  groupId: UUID;
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  customizationType: CustomizationType;
  priceAdjustment?: number;
  priceType?: PriceType;
  inventoryItemId?: UUID;
  quantityPerSelection?: number;
  inventoryUnit?: string;
  replacesInventoryItemId?: UUID;
  maxQuantity?: number;
  quantityIncrement?: number;
  isDefault?: boolean;
  isPopular?: boolean;
  badgeText?: string;
  badgeColor?: string;
  imageUrl?: string;
  availableStock?: number;
  sortOrder?: number;
}

/**
 * Request to update a customization option
 */
export interface UpdateCustomizationOptionRequest extends Partial<Omit<CreateCustomizationOptionRequest, 'groupId'>> {
  isAvailable?: boolean;
}

/**
 * Request to link a customization group to an entity
 */
export interface LinkCustomizationRequest {
  entityType: CustomizableEntityType;
  entityId: UUID;
  customizationGroupId: UUID;
  isRequiredOverride?: boolean;
  minSelectionsOverride?: number;
  maxSelectionsOverride?: number;
  priceMultiplier?: number;
  sortOrder?: number;
}

/**
 * Request to update an entity customization link
 */
export interface UpdateEntityCustomizationRequest {
  isRequiredOverride?: boolean;
  minSelectionsOverride?: number;
  maxSelectionsOverride?: number;
  priceMultiplier?: number;
  isEnabled?: boolean;
  sortOrder?: number;
}

// ----- Inventory Integration Types -----

/**
 * Result of inventory processing for customizations
 */
export interface CustomizationInventoryResult {
  itemsAdded: number;
  itemsRemoved: number;
  itemsSwapped: number;
  deductionLog: CustomizationDeductionLog[];
}

/**
 * Log entry for inventory deduction
 */
export interface CustomizationDeductionLog {
  action: 'deducted' | 'swapped' | 'skip_deduction';
  inventoryItemId?: UUID;
  optionName: string;
  quantity?: number;
  addedItemId?: UUID;
  removedItemId?: UUID;
  reason?: string;
}

// ----- Order Display Types -----

/**
 * Customizations grouped for display on receipt/staff view
 */
export interface OrderCustomizationDisplay {
  groupName: string;
  options: OrderCustomizationOptionDisplay[];
}

/**
 * Single customization for display
 */
export interface OrderCustomizationOptionDisplay {
  name: string;
  type: CustomizationType;
  quantity: number;
  priceAdjustment: number;
}

// ----- Module Integration Types -----

/**
 * Generic order item with customizations
 * Used by all modules (menu service, accommodation, pool, etc.)
 */
export interface CustomizableOrderItem {
  itemId: UUID;
  quantity: number;
  basePrice: number;
  customizations: ValidatedSelection[];
  customizationTotal: number;
  lineTotal: number;
  notes?: string;
}

/**
 * Booking with customizations (for accommodations)
 */
export interface CustomizableBooking {
  bookingId: UUID;
  entityType: CustomizableEntityType;
  entityId: UUID;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  basePrice: number;
  customizations: ValidatedSelection[];
  customizationTotal: number;
  totalPrice: number;
}

// ----- Export for convenience -----

export type {
  UUID,
  BaseEntity
} from './index';
