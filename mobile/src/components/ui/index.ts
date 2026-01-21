/**
 * UI Components Index
 * 
 * Centralized exports for all UI components.
 */

// Basic UI
export { Button, buttonVariants, type ButtonProps } from './Button';
export { Card, CardContent, CardHeader, CardTitle, CardDescription } from './Card';
export { Input, type InputProps } from './Input';

// Status & Feedback
export { Badge, CountBadge, type BadgeProps, type CountBadgeProps } from './Badge';
export { 
  Skeleton, 
  SkeletonText, 
  SkeletonAvatar, 
  SkeletonCard, 
  SkeletonMenuItem, 
  SkeletonBookingCard,
  type SkeletonProps,
} from './Skeleton';

// Feature Components
export { 
  MenuItem, 
  QuantityControl,
  type MenuItemProps, 
  type MenuItemData,
  type MenuItemVariant,
  type MenuItemAddon,
} from './MenuItem';

export { 
  CartSummary, 
  FloatingCartButton,
  type CartSummaryProps,
  type CartItemData,
  type CartTotals,
  type FloatingCartButtonProps,
} from './CartSummary';

export { 
  BookingCard, 
  EmptyBookings, 
  BookingSectionHeader,
  type BookingCardProps,
  type BookingData,
  type BookingStatus,
  type BookingType,
  type EmptyBookingsProps,
  type BookingSectionHeaderProps,
} from './BookingCard';
