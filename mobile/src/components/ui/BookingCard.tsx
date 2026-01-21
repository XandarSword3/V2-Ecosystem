/**
 * BookingCard Component
 * 
 * Displays booking/reservation information for pool, chalets, restaurant, etc.
 * Supports multiple states (upcoming, ongoing, completed, cancelled).
 */
import { View, Text, Pressable, ViewProps } from 'react-native';
import { cn } from '../../lib/utils';
import { Badge, BadgeProps } from './Badge';
import { Button } from './Button';

export type BookingStatus = 
  | 'pending'
  | 'confirmed'
  | 'ongoing'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type BookingType = 
  | 'pool'
  | 'chalet'
  | 'restaurant'
  | 'snack'
  | 'spa'
  | 'event';

export interface BookingData {
  id: string;
  type: BookingType;
  title: string;
  status: BookingStatus;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  guestCount?: number;
  totalAmount?: number;
  reference?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface BookingCardProps extends Omit<ViewProps, 'children'> {
  /**
   * Booking data
   */
  booking: BookingData;
  /**
   * Currency symbol
   */
  currency?: string;
  /**
   * Display variant
   */
  variant?: 'default' | 'compact' | 'detailed';
  /**
   * Show action buttons
   */
  showActions?: boolean;
  /**
   * Callback when card is pressed
   */
  onPress?: (booking: BookingData) => void;
  /**
   * Callback when cancel is pressed
   */
  onCancel?: (booking: BookingData) => void;
  /**
   * Callback when reschedule is pressed
   */
  onReschedule?: (booking: BookingData) => void;
  /**
   * Callback when check-in is pressed
   */
  onCheckIn?: (booking: BookingData) => void;
  /**
   * Loading state
   */
  loading?: boolean;
  /**
   * Additional className
   */
  className?: string;
}

/**
 * Get badge variant for booking status
 */
function getStatusBadgeVariant(status: BookingStatus): BadgeProps['variant'] {
  const statusVariants: Record<BookingStatus, BadgeProps['variant']> = {
    pending: 'warning',
    confirmed: 'success',
    ongoing: 'info',
    completed: 'default',
    cancelled: 'error',
    expired: 'outline',
  };
  return statusVariants[status];
}

/**
 * Get display label for booking status
 */
function getStatusLabel(status: BookingStatus): string {
  const labels: Record<BookingStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    ongoing: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  return labels[status];
}

/**
 * Get icon name for booking type
 */
function getTypeIcon(type: BookingType): string {
  const icons: Record<BookingType, string> = {
    pool: '🏊',
    chalet: '🏠',
    restaurant: '🍽️',
    snack: '🍿',
    spa: '💆',
    event: '🎉',
  };
  return icons[type];
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time range
 */
function formatTimeRange(start?: string, end?: string): string {
  if (!start) return '';
  return end ? `${start} - ${end}` : start;
}

/**
 * Format price with currency
 */
function formatPrice(price: number, currency = '$'): string {
  return `${currency}${price.toFixed(2)}`;
}

/**
 * Booking card component for reservation display
 */
export function BookingCard({
  booking,
  currency = '$',
  variant = 'default',
  showActions = true,
  onPress,
  onCancel,
  onReschedule,
  onCheckIn,
  loading = false,
  className,
  ...props
}: BookingCardProps) {
  const canCancel = ['pending', 'confirmed'].includes(booking.status);
  const canReschedule = ['pending', 'confirmed'].includes(booking.status);
  const canCheckIn = booking.status === 'confirmed';

  const handlePress = () => {
    if (onPress) {
      onPress(booking);
    }
  };

  if (variant === 'compact') {
    return (
      <Pressable
        onPress={handlePress}
        className={cn(
          'flex-row items-center bg-card rounded-lg border border-border p-3',
          className
        )}
        {...props}
      >
        <Text className="text-xl mr-3">{getTypeIcon(booking.type)}</Text>
        <View className="flex-1">
          <Text className="font-medium text-foreground" numberOfLines={1}>
            {booking.title}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {formatDate(booking.date)}
            {booking.startTime && ` • ${booking.startTime}`}
          </Text>
        </View>
        <Badge
          label={getStatusLabel(booking.status)}
          variant={getStatusBadgeVariant(booking.status)}
          size="sm"
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        'bg-card rounded-xl border border-border overflow-hidden',
        className
      )}
      {...props}
    >
      {/* Header */}
      <View className="flex-row justify-between items-start p-4 pb-2">
        <View className="flex-row items-center flex-1">
          <Text className="text-2xl mr-3">{getTypeIcon(booking.type)}</Text>
          <View className="flex-1">
            <Text className="font-semibold text-foreground text-lg" numberOfLines={1}>
              {booking.title}
            </Text>
            {booking.reference && (
              <Text className="text-xs text-muted-foreground">
                Ref: {booking.reference}
              </Text>
            )}
          </View>
        </View>
        <Badge
          label={getStatusLabel(booking.status)}
          variant={getStatusBadgeVariant(booking.status)}
        />
      </View>

      {/* Details */}
      <View className="px-4 pb-4">
        <View className="flex-row flex-wrap">
          <DetailItem
            icon="📅"
            label="Date"
            value={formatDate(booking.date)}
          />
          {(booking.startTime || booking.endTime) && (
            <DetailItem
              icon="🕐"
              label="Time"
              value={formatTimeRange(booking.startTime, booking.endTime)}
            />
          )}
          {booking.location && (
            <DetailItem
              icon="📍"
              label="Location"
              value={booking.location}
            />
          )}
          {booking.guestCount !== undefined && (
            <DetailItem
              icon="👥"
              label="Guests"
              value={booking.guestCount.toString()}
            />
          )}
        </View>

        {booking.notes && (
          <Text className="text-sm text-muted-foreground mt-2 italic">
            {booking.notes}
          </Text>
        )}

        {/* Total Amount */}
        {booking.totalAmount !== undefined && (
          <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-border">
            <Text className="text-muted-foreground">Total</Text>
            <Text className="font-bold text-lg text-primary">
              {formatPrice(booking.totalAmount, currency)}
            </Text>
          </View>
        )}

        {/* Actions */}
        {showActions && (canCancel || canReschedule || canCheckIn) && (
          <View className="flex-row gap-2 mt-4">
            {canCheckIn && onCheckIn && (
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onPress={() => onCheckIn(booking)}
                loading={loading}
                title="Check In"
              />
            )}
            {canReschedule && onReschedule && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onPress={() => onReschedule(booking)}
                disabled={loading}
                title="Reschedule"
              />
            )}
            {canCancel && onCancel && (
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onPress={() => onCancel(booking)}
                disabled={loading}
                title="Cancel"
              />
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

/**
 * Detail item for booking information
 */
interface DetailItemProps {
  icon: string;
  label: string;
  value: string;
}

function DetailItem({ icon, label, value }: DetailItemProps) {
  return (
    <View className="flex-row items-center mr-4 mb-2">
      <Text className="mr-1">{icon}</Text>
      <Text className="text-muted-foreground text-sm">{label}: </Text>
      <Text className="text-foreground text-sm font-medium">{value}</Text>
    </View>
  );
}

/**
 * Empty state for no bookings
 */
export interface EmptyBookingsProps extends ViewProps {
  type?: BookingType | 'all';
  onCreateBooking?: () => void;
  className?: string;
}

export function EmptyBookings({
  type = 'all',
  onCreateBooking,
  className,
  ...props
}: EmptyBookingsProps) {
  const messages: Record<BookingType | 'all', { title: string; subtitle: string }> = {
    all: {
      title: 'No Bookings Yet',
      subtitle: 'Start exploring our services and make your first reservation',
    },
    pool: {
      title: 'No Pool Reservations',
      subtitle: 'Book a pool slot and enjoy our swimming facilities',
    },
    chalet: {
      title: 'No Chalet Bookings',
      subtitle: 'Reserve a private chalet for a perfect day',
    },
    restaurant: {
      title: 'No Restaurant Reservations',
      subtitle: 'Book a table and enjoy our fine dining experience',
    },
    snack: {
      title: 'No Orders',
      subtitle: 'Order delicious snacks and refreshments',
    },
    spa: {
      title: 'No Spa Appointments',
      subtitle: 'Book a spa treatment and relax',
    },
    event: {
      title: 'No Event Bookings',
      subtitle: 'Join our exciting events and activities',
    },
  };

  const { title, subtitle } = messages[type];

  return (
    <View
      className={cn('p-8 items-center justify-center', className)}
      {...props}
    >
      <Text className="text-4xl mb-4">📅</Text>
      <Text className="text-lg font-semibold text-foreground text-center mb-2">
        {title}
      </Text>
      <Text className="text-muted-foreground text-center mb-4">
        {subtitle}
      </Text>
      {onCreateBooking && (
        <Button onPress={onCreateBooking} title="Make a Booking" />
      )}
    </View>
  );
}

/**
 * Booking list section header
 */
export interface BookingSectionHeaderProps extends ViewProps {
  title: string;
  count?: number;
  className?: string;
}

export function BookingSectionHeader({
  title,
  count,
  className,
  ...props
}: BookingSectionHeaderProps) {
  return (
    <View
      className={cn('flex-row justify-between items-center py-2 px-4', className)}
      {...props}
    >
      <Text className="font-semibold text-foreground">{title}</Text>
      {count !== undefined && (
        <Text className="text-muted-foreground text-sm">{count}</Text>
      )}
    </View>
  );
}

export default BookingCard;
