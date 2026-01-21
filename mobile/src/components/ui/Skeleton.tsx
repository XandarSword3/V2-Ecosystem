/**
 * Skeleton Component
 * 
 * Placeholder loading states for content that is still loading.
 * Provides smooth pulse animations for better UX.
 */
import React, { useRef, useEffect } from 'react';
import { View, ViewProps, Animated, Easing } from 'react-native';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends ViewProps {
  /**
   * Width of the skeleton
   */
  width?: number | string;
  /**
   * Height of the skeleton
   */
  height?: number | string;
  /**
   * Border radius variant
   */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  /**
   * Whether to animate the skeleton
   */
  animate?: boolean;
  /**
   * Additional className
   */
  className?: string;
}

/**
 * Basic skeleton placeholder with optional animation
 */
export function Skeleton({
  width,
  height,
  variant = 'rectangular',
  animate = true,
  className,
  style,
  ...props
}: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (animate) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0.4,
            duration: 1000,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [animate, animatedValue]);

  const variants = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const dimensionStyle: any = {};
  if (width !== undefined) dimensionStyle.width = width;
  if (height !== undefined) dimensionStyle.height = height;

  return (
    <Animated.View
      style={[
        dimensionStyle,
        style,
        animate ? { opacity: animatedValue } : undefined,
      ]}
      className={cn(
        'bg-muted',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

/**
 * Skeleton for text content
 */
export function SkeletonText({
  lines = 1,
  lastLineWidth = 75,
  className,
  ...props
}: Omit<SkeletonProps, 'variant' | 'height'> & {
  lines?: number;
  lastLineWidth?: number;
}) {
  return (
    <View className={cn('gap-2', className)} {...props}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={
            index === lines - 1 && lines > 1 ? `${lastLineWidth}%` : '100%'
          }
          height={16}
        />
      ))}
    </View>
  );
}

/**
 * Skeleton for avatar/profile image
 */
export function SkeletonAvatar({
  size = 40,
  className,
  ...props
}: Omit<SkeletonProps, 'variant' | 'width' | 'height'> & {
  size?: number;
}) {
  return (
    <Skeleton
      variant="circular"
      width={size}
      height={size}
      className={className}
      {...props}
    />
  );
}

/**
 * Skeleton for a card-like component
 */
export function SkeletonCard({
  className,
  hasImage = true,
  ...props
}: Omit<SkeletonProps, 'variant'> & {
  hasImage?: boolean;
}) {
  return (
    <View
      className={cn('bg-card rounded-xl border border-border p-4', className)}
      {...props}
    >
      {hasImage && (
        <Skeleton
          variant="rounded"
          width="100%"
          height={120}
          className="mb-3"
        />
      )}
      <SkeletonText lines={1} className="mb-2" />
      <SkeletonText lines={2} lastLineWidth={60} />
    </View>
  );
}

/**
 * Skeleton for menu item display
 */
export function SkeletonMenuItem({ className }: { className?: string }) {
  return (
    <View
      className={cn(
        'flex-row bg-card rounded-xl border border-border p-3',
        className
      )}
    >
      <Skeleton variant="rounded" width={80} height={80} className="mr-3" />
      <View className="flex-1 justify-center">
        <Skeleton variant="text" width="70%" height={18} className="mb-2" />
        <Skeleton variant="text" width="90%" height={14} className="mb-1" />
        <Skeleton variant="text" width="30%" height={16} className="mt-2" />
      </View>
    </View>
  );
}

/**
 * Skeleton for booking card
 */
export function SkeletonBookingCard({ className }: { className?: string }) {
  return (
    <View
      className={cn(
        'bg-card rounded-xl border border-border p-4',
        className
      )}
    >
      <View className="flex-row justify-between items-start mb-3">
        <Skeleton variant="text" width={150} height={20} />
        <Skeleton variant="rounded" width={70} height={24} />
      </View>
      <Skeleton variant="text" width="80%" height={14} className="mb-2" />
      <Skeleton variant="text" width="60%" height={14} />
      <View className="flex-row justify-between mt-4 pt-3 border-t border-border">
        <Skeleton variant="text" width={80} height={16} />
        <Skeleton variant="text" width={60} height={18} />
      </View>
    </View>
  );
}

export default Skeleton;
