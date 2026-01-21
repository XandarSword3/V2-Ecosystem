/**
 * CartSummary Component
 * 
 * Displays cart contents with items, quantities, and totals.
 * Supports loyalty points, gift cards, and discount codes.
 */
import { View, Text, Pressable, ScrollView, ViewProps } from 'react-native';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { QuantityControl } from './MenuItem';

export interface CartItemData {
  id: string;
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  variant?: {
    id: string;
    name: string;
    priceModifier: number;
  };
  addons?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  notes?: string;
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  serviceFee: number;
  loyaltyDiscount: number;
  giftCardDiscount: number;
  couponDiscount: number;
  total: number;
}

export interface CartSummaryProps extends Omit<ViewProps, 'children'> {
  /**
   * Cart items
   */
  items: CartItemData[];
  /**
   * Cart totals
   */
  totals: CartTotals;
  /**
   * Currency symbol
   */
  currency?: string;
  /**
   * Callback when item quantity changes
   */
  onQuantityChange?: (itemId: string, quantity: number) => void;
  /**
   * Callback when item is removed
   */
  onRemoveItem?: (itemId: string) => void;
  /**
   * Callback when checkout is pressed
   */
  onCheckout?: () => void;
  /**
   * Whether cart is loading
   */
  loading?: boolean;
  /**
   * Applied loyalty points
   */
  loyaltyPointsApplied?: number;
  /**
   * Applied gift card code
   */
  giftCardCode?: string;
  /**
   * Applied coupon code
   */
  couponCode?: string;
  /**
   * Show compact view
   */
  compact?: boolean;
  /**
   * Additional className
   */
  className?: string;
}

/**
 * Format price with currency
 */
function formatPrice(price: number, currency = '$'): string {
  return `${currency}${price.toFixed(2)}`;
}

/**
 * Cart summary component for order review
 */
export function CartSummary({
  items,
  totals,
  currency = '$',
  onQuantityChange,
  onRemoveItem,
  onCheckout,
  loading = false,
  loyaltyPointsApplied,
  giftCardCode,
  couponCode,
  compact = false,
  className,
  ...props
}: CartSummaryProps) {
  const isEmpty = items.length === 0;

  if (isEmpty) {
    return (
      <View
        className={cn('p-6 items-center justify-center', className)}
        {...props}
      >
        <Text className="text-muted-foreground text-lg mb-2">
          Your cart is empty
        </Text>
        <Text className="text-muted-foreground text-sm text-center">
          Browse our menu and add items to get started
        </Text>
      </View>
    );
  }

  if (compact) {
    return (
      <View className={cn('bg-card rounded-xl border border-border p-4', className)} {...props}>
        <View className="flex-row justify-between items-center mb-2">
          <Text className="font-semibold text-foreground">
            {items.length} item{items.length > 1 ? 's' : ''}
          </Text>
          <Text className="text-primary font-bold text-lg">
            {formatPrice(totals.total, currency)}
          </Text>
        </View>
        {onCheckout && (
          <Button onPress={onCheckout} loading={loading} className="w-full mt-2" title="Checkout" />
        )}
      </View>
    );
  }

  return (
    <View className={cn('bg-card rounded-xl border border-border', className)} {...props}>
      {/* Items List */}
      <ScrollView className="max-h-72" showsVerticalScrollIndicator={false}>
        {items.map((item, index) => (
          <CartItem
            key={item.id}
            item={item}
            currency={currency}
            onQuantityChange={onQuantityChange}
            onRemove={onRemoveItem}
            showDivider={index < items.length - 1}
          />
        ))}
      </ScrollView>

      {/* Totals Section */}
      <View className="p-4 border-t border-border">
        {/* Subtotal */}
        <TotalRow
          label="Subtotal"
          value={formatPrice(totals.subtotal, currency)}
        />

        {/* Tax */}
        {totals.tax > 0 && (
          <TotalRow
            label="Tax"
            value={formatPrice(totals.tax, currency)}
          />
        )}

        {/* Service Fee */}
        {totals.serviceFee > 0 && (
          <TotalRow
            label="Service Fee"
            value={formatPrice(totals.serviceFee, currency)}
          />
        )}

        {/* Loyalty Points Discount */}
        {totals.loyaltyDiscount > 0 && (
          <TotalRow
            label={`Loyalty Points${loyaltyPointsApplied ? ` (${loyaltyPointsApplied})` : ''}`}
            value={`-${formatPrice(totals.loyaltyDiscount, currency)}`}
            variant="discount"
          />
        )}

        {/* Gift Card Discount */}
        {totals.giftCardDiscount > 0 && (
          <TotalRow
            label={`Gift Card${giftCardCode ? ` (${giftCardCode})` : ''}`}
            value={`-${formatPrice(totals.giftCardDiscount, currency)}`}
            variant="discount"
          />
        )}

        {/* Coupon Discount */}
        {totals.couponDiscount > 0 && (
          <TotalRow
            label={`Coupon${couponCode ? ` (${couponCode})` : ''}`}
            value={`-${formatPrice(totals.couponDiscount, currency)}`}
            variant="discount"
          />
        )}

        {/* Total */}
        <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-border">
          <Text className="font-bold text-lg text-foreground">Total</Text>
          <Text className="font-bold text-xl text-primary">
            {formatPrice(totals.total, currency)}
          </Text>
        </View>

        {/* Checkout Button */}
        {onCheckout && (
          <Button
            onPress={onCheckout}
            loading={loading}
            className="w-full mt-4"
            size="lg"
            title="Proceed to Checkout"
          />
        )}
      </View>
    </View>
  );
}

/**
 * Individual cart item display
 */
interface CartItemProps {
  item: CartItemData;
  currency: string;
  onQuantityChange?: (itemId: string, quantity: number) => void;
  onRemove?: (itemId: string) => void;
  showDivider?: boolean;
}

function CartItem({
  item,
  currency,
  onQuantityChange,
  onRemove,
  showDivider,
}: CartItemProps) {
  const itemTotal =
    (item.price +
      (item.variant?.priceModifier ?? 0) +
      (item.addons?.reduce((sum, a) => sum + a.price, 0) ?? 0)) *
    item.quantity;

  return (
    <View
      className={cn('p-4', showDivider && 'border-b border-border')}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="font-medium text-foreground">{item.name}</Text>
          {item.variant && (
            <Text className="text-sm text-muted-foreground">
              {item.variant.name}
              {item.variant.priceModifier > 0 &&
                ` (+${formatPrice(item.variant.priceModifier, currency)})`}
            </Text>
          )}
          {item.addons && item.addons.length > 0 && (
            <Text className="text-sm text-muted-foreground">
              + {item.addons.map((a) => a.name).join(', ')}
            </Text>
          )}
          {item.notes && (
            <Text className="text-xs text-muted-foreground italic mt-1">
              Note: {item.notes}
            </Text>
          )}
        </View>
        <Text className="font-semibold text-foreground">
          {formatPrice(itemTotal, currency)}
        </Text>
      </View>

      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-sm text-muted-foreground">
          {formatPrice(item.price, currency)} × {item.quantity}
        </Text>
        <View className="flex-row items-center">
          {onRemove && (
            <Pressable
              onPress={() => onRemove(item.id)}
              className="mr-3 p-1"
            >
              <Text className="text-red-500 text-sm">Remove</Text>
            </Pressable>
          )}
          {onQuantityChange && (
            <QuantityControl
              quantity={item.quantity}
              onIncrease={() => onQuantityChange(item.id, item.quantity + 1)}
              onDecrease={() => onQuantityChange(item.id, item.quantity - 1)}
              min={1}
            />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Totals row component
 */
interface TotalRowProps {
  label: string;
  value: string;
  variant?: 'default' | 'discount';
}

function TotalRow({ label, value, variant = 'default' }: TotalRowProps) {
  return (
    <View className="flex-row justify-between items-center py-1">
      <Text className="text-muted-foreground">{label}</Text>
      <Text
        className={cn(
          'font-medium',
          variant === 'discount' ? 'text-green-600' : 'text-foreground'
        )}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Floating cart button for bottom of screen
 */
export interface FloatingCartButtonProps {
  itemCount: number;
  total: number;
  currency?: string;
  onPress: () => void;
  className?: string;
}

export function FloatingCartButton({
  itemCount,
  total,
  currency = '$',
  onPress,
  className,
}: FloatingCartButtonProps) {
  if (itemCount === 0) return null;

  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'absolute bottom-6 left-4 right-4 bg-primary rounded-xl p-4 flex-row justify-between items-center shadow-lg',
        className
      )}
    >
      <View className="flex-row items-center">
        <View className="bg-white/20 rounded-full w-7 h-7 items-center justify-center mr-3">
          <Text className="text-white font-bold">{itemCount}</Text>
        </View>
        <Text className="text-white font-semibold">View Cart</Text>
      </View>
      <Text className="text-white font-bold text-lg">
        {formatPrice(total, currency)}
      </Text>
    </Pressable>
  );
}

export default CartSummary;
