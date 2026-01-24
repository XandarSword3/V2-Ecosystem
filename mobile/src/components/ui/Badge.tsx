/**
 * Badge Component
 * 
 * Used for status indicators, counts, and tags throughout the app.
 * Supports multiple variants and sizes for different contexts.
 */
import { View, Text, ViewProps } from 'react-native';
import { cn } from '../../lib/utils';

export interface BadgeProps extends ViewProps {
  /**
   * Visual variant of the badge
   */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  /**
   * Size of the badge
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Badge label text
   */
  label: string;
  /**
   * Optional className for custom styling
   */
  className?: string;
}

/**
 * Badge component for status indicators and labels
 */
export function Badge({
  variant = 'default',
  size = 'md',
  label,
  className,
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-primary/20 border-primary/40',
    success: 'bg-green-500/20 border-green-500/40',
    warning: 'bg-yellow-500/20 border-yellow-500/40',
    error: 'bg-red-500/20 border-red-500/40',
    info: 'bg-blue-500/20 border-blue-500/40',
    outline: 'bg-transparent border-border',
  };

  const textColors = {
    default: 'text-primary',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
    outline: 'text-foreground',
  };

  const sizes = {
    sm: 'px-1.5 py-0.5',
    md: 'px-2 py-1',
    lg: 'px-3 py-1.5',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <View
      className={cn(
        'rounded-full border inline-flex',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      <Text className={cn('font-medium', textColors[variant], textSizes[size])}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Counter Badge for notification counts
 */
export interface CountBadgeProps extends Omit<ViewProps, 'children'> {
  count: number;
  max?: number;
  variant?: 'primary' | 'error';
  className?: string;
}

export function CountBadge({
  count,
  max = 99,
  variant = 'primary',
  className,
  ...props
}: CountBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  const variants = {
    primary: 'bg-primary',
    error: 'bg-red-500',
  };

  return (
    <View
      className={cn(
        'min-w-[20px] h-5 rounded-full justify-center items-center px-1',
        variants[variant],
        className
      )}
      {...props}
    >
      <Text className="text-white text-xs font-bold text-center">
        {displayCount}
      </Text>
    </View>
  );
}

export default Badge;
