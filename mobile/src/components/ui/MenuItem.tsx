/**
 * MenuItem Component
 * 
 * Displays a menu item from restaurant or snack bar with image,
 * name, description, price, and add-to-cart functionality.
 */
import { View, Text, Image, Pressable, ViewProps } from 'react-native';
import { cn } from '../../lib/utils';
import { Badge } from './Badge';
import { Button } from './Button';

export interface MenuItemVariant {
  id: string;
  name: string;
  priceModifier: number;
}

export interface MenuItemAddon {
  id: string;
  name: string;
  price: number;
}

export interface MenuItemData {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
  available?: boolean;
  preparationTime?: number;
  calories?: number;
  tags?: string[];
  variants?: MenuItemVariant[];
  addons?: MenuItemAddon[];
}

export interface MenuItemProps extends Omit<ViewProps, 'children'> {
  /**
   * Menu item data
   */
  item: MenuItemData;
  /**
   * Currency symbol
   */
  currency?: string;
  /**
   * Display variant
   */
  variant?: 'horizontal' | 'vertical' | 'compact';
  /**
   * Whether item can be added to cart
   */
  showAddButton?: boolean;
  /**
   * Callback when add button is pressed
   */
  onAdd?: (item: MenuItemData) => void;
  /**
   * Callback when item is pressed
   */
  onPress?: (item: MenuItemData) => void;
  /**
   * Quantity in cart (if any)
   */
  quantity?: number;
  /**
   * Callback for quantity change
   */
  onQuantityChange?: (item: MenuItemData, quantity: number) => void;
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
 * Menu item component for displaying food/drink items
 */
export function MenuItem({
  item,
  currency = '$',
  variant = 'horizontal',
  showAddButton = true,
  onAdd,
  onPress,
  quantity = 0,
  onQuantityChange,
  className,
  ...props
}: MenuItemProps) {
  const isAvailable = item.available !== false;

  const handlePress = () => {
    if (isAvailable && onPress) {
      onPress(item);
    }
  };

  const handleAdd = () => {
    if (isAvailable && onAdd) {
      onAdd(item);
    }
  };

  if (variant === 'compact') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={!isAvailable}
        className={cn(
          'flex-row items-center py-3 px-4 border-b border-border',
          !isAvailable && 'opacity-50',
          className
        )}
        {...props}
      >
        <View className="flex-1">
          <Text className="font-medium text-foreground">{item.name}</Text>
          <Text className="text-sm text-primary font-semibold mt-1">
            {formatPrice(item.price, currency)}
          </Text>
        </View>
        {showAddButton && isAvailable && (
          <Button size="sm" variant="outline" onPress={handleAdd} title="Add" />
        )}
      </Pressable>
    );
  }

  if (variant === 'vertical') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={!isAvailable}
        className={cn(
          'bg-card rounded-xl border border-border overflow-hidden',
          !isAvailable && 'opacity-50',
          className
        )}
        {...props}
      >
        {item.imageUrl && (
          <Image
            source={{ uri: item.imageUrl }}
            className="w-full h-32"
            resizeMode="cover"
          />
        )}
        <View className="p-3">
          <Text className="font-semibold text-foreground mb-1" numberOfLines={1}>
            {item.name}
          </Text>
          {item.description && (
            <Text className="text-sm text-muted-foreground mb-2" numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View className="flex-row justify-between items-center">
            <Text className="text-primary font-bold">
              {formatPrice(item.price, currency)}
            </Text>
            {showAddButton && isAvailable && (
              <Button size="sm" onPress={handleAdd} title="Add" />
            )}
          </View>
        </View>
        {!isAvailable && (
          <View className="absolute top-2 right-2">
            <Badge variant="error" label="Unavailable" size="sm" />
          </View>
        )}
      </Pressable>
    );
  }

  // Horizontal (default)
  return (
    <Pressable
      onPress={handlePress}
      disabled={!isAvailable}
      className={cn(
        'flex-row bg-card rounded-xl border border-border p-3',
        !isAvailable && 'opacity-50',
        className
      )}
      {...props}
    >
      {item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          className="w-20 h-20 rounded-lg mr-3"
          resizeMode="cover"
        />
      )}
      <View className="flex-1">
        <View className="flex-row justify-between items-start">
          <Text className="font-semibold text-foreground flex-1 mr-2" numberOfLines={1}>
            {item.name}
          </Text>
          {item.tags?.map((tag) => (
            <Badge key={tag} label={tag} variant="info" size="sm" className="ml-1" />
          ))}
        </View>
        
        {item.description && (
          <Text className="text-sm text-muted-foreground mt-1" numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View className="flex-row items-center mt-2">
          {item.preparationTime && (
            <Text className="text-xs text-muted-foreground mr-3">
              {item.preparationTime} min
            </Text>
          )}
          {item.calories && (
            <Text className="text-xs text-muted-foreground">
              {item.calories} cal
            </Text>
          )}
        </View>

        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-primary font-bold text-lg">
            {formatPrice(item.price, currency)}
          </Text>
          
          {showAddButton && isAvailable && (
            quantity > 0 && onQuantityChange ? (
              <QuantityControl
                quantity={quantity}
                onIncrease={() => onQuantityChange(item, quantity + 1)}
                onDecrease={() => onQuantityChange(item, quantity - 1)}
              />
            ) : (
              <Button size="sm" onPress={handleAdd} title="Add" />
            )
          )}
        </View>
      </View>
      
      {!isAvailable && (
        <View className="absolute top-2 right-2">
          <Badge variant="error" label="Unavailable" size="sm" />
        </View>
      )}
    </Pressable>
  );
}

/**
 * Quantity control component for cart items
 */
interface QuantityControlProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  min?: number;
  max?: number;
}

export function QuantityControl({
  quantity,
  onIncrease,
  onDecrease,
  min = 0,
  max = 99,
}: QuantityControlProps) {
  return (
    <View className="flex-row items-center bg-secondary rounded-lg">
      <Pressable
        onPress={onDecrease}
        disabled={quantity <= min}
        className="px-3 py-1"
      >
        <Text
          className={cn(
            'text-lg font-bold',
            quantity <= min ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          −
        </Text>
      </Pressable>
      <Text className="text-foreground font-semibold min-w-[24px] text-center">
        {quantity}
      </Text>
      <Pressable
        onPress={onIncrease}
        disabled={quantity >= max}
        className="px-3 py-1"
      >
        <Text
          className={cn(
            'text-lg font-bold',
            quantity >= max ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}

export default MenuItem;
