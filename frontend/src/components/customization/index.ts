/**
 * Unified Customization Components
 * 
 * This module provides reusable customization components for ALL modules
 * in the V2 Resort platform.
 * 
 * Usage:
 * 
 * ```tsx
 * import { CustomizationSelector } from '@/components/customization';
 * 
 * // For restaurant menu items
 * <CustomizationSelector
 *   entityType="menu_item"
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
 * // For chalets (accommodation)
 * <CustomizationSelector
 *   entityType="chalet"
 *   entityId={chalet.id}
 *   entity={{
 *     name: chalet.name,
 *     basePrice: chalet.price_per_night,
 *   }}
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onConfirm={(data) => proceedToBooking(data)}
 *   priceContext="per_night"
 *   contextMultiplier={numberOfNights}
 *   showQuantitySelector={false}
 * />
 * 
 * // For pool sessions
 * <CustomizationSelector
 *   entityType="pool_session"
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
