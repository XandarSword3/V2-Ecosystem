/**
 * Unified Customization Module
 * 
 * This module provides a centralized customization system for ALL modules in the V2 Ecosystem platform.
 * It supports:
 * - Restaurant menu items
 * - Snack bar items
 * - Chalets and accommodations
 * - Pool sessions
 * - Spa services (future)
 * - Activities (future)
 * - Any future module
 * 
 * Key features:
 * - Module-agnostic design
 * - Flexible selection modes (single, multiple, quantity)
 * - Inventory integration (add, remove, swap)
 * - Time-based availability
 * - Conditional display rules
 * - Entity-specific overrides
 * - Immutable order records
 */

export { customizationService } from './services/customization.service.js';
export { customizationController } from './controllers/customization.controller.js';
export { default as customizationRoutes } from './routes/customization.routes.js';

// Re-export types from the service
export type {
  CustomizationType,
  CustomizableEntityType,
  SelectionMode,
  PriceType,
  CustomizationGroup,
  CustomizationOption,
  EntityCustomization,
  CustomizationSelection,
  ValidatedSelection,
  CustomizationValidationResult,
  CustomizationGroupWithOptions,
  CustomizationOptionDisplay,
  CreateCustomizationGroupRequest,
  UpdateCustomizationGroupRequest,
  CreateCustomizationOptionRequest,
  UpdateCustomizationOptionRequest,
  LinkCustomizationRequest,
  UpdateEntityCustomizationRequest,
  CustomizationInventoryResult
} from './services/customization.service.js';
