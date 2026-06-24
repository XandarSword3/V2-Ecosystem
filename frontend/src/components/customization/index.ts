/**
 * Unified Customization Components
 * 
 * This module provides reusable customization components for ALL modules
 * in the V2 Ecosystem platform.
 * 
 * Usage:
 * 
 * ```tsx
 * import { CustomizationSelector } from '@/components/customization';
 * 
 * // For instant_transaction catalog items (e.g. menu items)
 * <CustomizationSelector
 *   entityType="catalog_item"
 *   entityId={menuItem.id}
 *   entity={{
 *     name: menuItem.name,
 *     nameAr: menuItem.name_ar,
 *     basePrice: menuItem.price,
 *   }}
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onConfirm={(data) => addToCart(data)}
 * />
 * 
 * // For time_exclusive_reservation units (e.g. accommodation)
 * <CustomizationSelector
 *   entityType="accommodation_unit"
 *   entityId={unit.id}
 *   entity={{
 *     name: unit.name,
 *     basePrice: unit.price_per_night,
 *   }}
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onConfirm={(data) => proceedToBooking(data)}
 *   priceContext="per_night"
 *   contextMultiplier={numberOfNights}
 *   showQuantitySelector={false}
 * />
 * 
 * // For shared_capacity_access sessions
 * <CustomizationSelector
 *   entityType="capacity_session"
 *   entityId={session.id}
 *   entity={{
 *     name: session.name,
 *     basePrice: session.price_per_person,
 *   }}
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onConfirm={(data) => bookSession(data)}
 *   priceContext="per_person"
 *   contextMultiplier={numberOfGuests}
 * />
 * ```
 */

export { 
  CustomizationSelector,
  type CustomizationType,
  type CustomizableEntityType,
  type SelectionMode,
  type PriceType,
  type CustomizationOptionDisplay,
  type CustomizationGroupWithOptions,
  type CustomizationSelection,
  type ValidatedSelection,
  type CustomizationValidationResult,
} from './CustomizationSelector';

// Re-export hooks for convenience
export {
  useEntityCustomizations,
  useValidateCustomizations,
  useOrderCustomizations,
  useCustomizationGroups,
  useCustomizationGroup,
  useCreateCustomizationGroup,
  useUpdateCustomizationGroup,
  useDeleteCustomizationGroup,
  useCreateCustomizationOption,
  useUpdateCustomizationOption,
  useDeleteCustomizationOption,
  useLinkCustomization,
  useUnlinkCustomization,
  useMigrateMenuModifiers,
  customizationKeys,
} from '@/hooks/useCustomizations';
