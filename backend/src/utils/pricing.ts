/**
 * Resolves the unit price based on base price and optional discount price.
 * Fixes the falsy-number bug (e.g., 0 being treated as false).
 * 
 * @param basePrice The standard price of the item
 * @param discountPrice The promotional price (if any)
 * @returns The effective unit price
 */
export function resolvePrice(basePrice: number | string, discountPrice: number | string | null | undefined): number {
  const base = typeof basePrice === 'string' ? parseFloat(basePrice) : basePrice;
  
  if (discountPrice == null || discountPrice === '') {
    return base;
  }
  
  const discount = typeof discountPrice === 'string' ? parseFloat(discountPrice) : discountPrice;
  
  // Use discount if it's lower than base (standard protection) or if it's explicitly 0 (100% off)
  // This allows representing 0 price discounts correctly.
  return (discount < base) ? discount : base;
}
