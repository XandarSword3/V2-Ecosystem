'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/cn';
import { forwardRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  bouncy?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-blue-600 to-blue-700 
    hover:from-blue-700 hover:to-blue-800 
    text-white shadow-lg shadow-blue-500/25
    dark:from-blue-500 dark:to-blue-600
    dark:hover:from-blue-600 dark:hover:to-blue-700
  `,
  secondary: `
    bg-gradient-to-r from-slate-600 to-slate-700
    hover:from-slate-700 hover:to-slate-800
    text-white shadow-lg shadow-slate-500/20
    dark:from-slate-500 dark:to-slate-600
  `,
  outline: `
    border-2 border-slate-300 dark:border-slate-600
    text-slate-700 dark:text-slate-300
    hover:bg-slate-100 dark:hover:bg-slate-800
    hover:border-slate-400 dark:hover:border-slate-500
  `,
  ghost: `
    text-slate-600 dark:text-slate-400
    hover:bg-slate-100 dark:hover:bg-slate-800
    hover:text-slate-900 dark:hover:text-slate-100
  `,
  danger: `
    bg-gradient-to-r from-red-600 to-red-700
    hover:from-red-700 hover:to-red-800
    text-white shadow-lg shadow-red-500/25
  `,
  success: `
    bg-gradient-to-r from-green-600 to-green-700
    hover:from-green-700 hover:to-green-800
    text-white shadow-lg shadow-green-500/25
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-xl',
  xl: 'px-8 py-4 text-lg gap-3 rounded-xl',
  icon: 'h-10 w-10 p-2 rounded-lg flex items-center justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      bouncy = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const hoverAnimation = bouncy
      ? {
          scale: 1.05,
          transition: { type: 'spring' as const, stiffness: 400, damping: 15 },
        }
      : {
          scale: 1.02,
          transition: { duration: 0.2 },
        };

    const tapAnimation = bouncy
      ? { scale: 0.9, rotate: [0, -2, 2, 0] }
      : { scale: 0.98 };

    return (
      <motion.button
        ref={ref}
        whileHover={!disabled && !isLoading ? hoverAnimation : undefined}
        whileTap={!disabled && !isLoading ? tapAnimation : undefined}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium',
          'transition-colors focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-blue-500 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && !isLoading && <span className="shrink-0">{rightIcon}</span>}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
