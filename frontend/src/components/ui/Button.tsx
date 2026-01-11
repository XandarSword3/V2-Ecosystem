'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/cn';
import { forwardRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'glass' | 'premium';
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
  glow?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 
    hover:from-primary-600 hover:via-primary-700 hover:to-primary-800 
    text-white shadow-lg shadow-primary-500/30
    dark:from-primary-500 dark:via-primary-600 dark:to-primary-700
    dark:shadow-primary-500/20
    backdrop-blur-sm
  `,
  secondary: `
    bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl
    border border-white/40 dark:border-slate-700/50
    text-slate-800 dark:text-slate-200
    hover:bg-white/90 dark:hover:bg-slate-700/90
    shadow-lg shadow-slate-900/5 dark:shadow-black/20
  `,
  outline: `
    border-2 border-slate-300/60 dark:border-slate-600/60 
    bg-white/30 dark:bg-slate-800/30 backdrop-blur-lg
    text-slate-700 dark:text-slate-300
    hover:bg-white/60 dark:hover:bg-slate-700/60
    hover:border-primary-400 dark:hover:border-primary-500
  `,
  ghost: `
    text-slate-600 dark:text-slate-400
    hover:bg-white/60 dark:hover:bg-slate-800/60
    hover:text-slate-900 dark:hover:text-slate-100
    backdrop-blur-sm
  `,
  danger: `
    bg-gradient-to-r from-red-500 via-red-600 to-red-700
    hover:from-red-600 hover:via-red-700 hover:to-red-800
    text-white shadow-lg shadow-red-500/30
    backdrop-blur-sm
  `,
  success: `
    bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700
    hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-800
    text-white shadow-lg shadow-emerald-500/30
    backdrop-blur-sm
  `,
  glass: `
    bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl
    border border-white/40 dark:border-slate-700/40
    text-slate-800 dark:text-slate-200
    hover:bg-white/80 dark:hover:bg-slate-800/80
    shadow-xl shadow-slate-900/5 dark:shadow-black/20
    hover:shadow-2xl
  `,
  premium: `
    bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500
    hover:from-violet-600 hover:via-purple-600 hover:to-fuchsia-600
    text-white shadow-lg shadow-purple-500/30
    backdrop-blur-sm
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-sm gap-1.5 rounded-lg',
  md: 'px-5 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-7 py-3.5 text-base gap-2.5 rounded-xl',
  xl: 'px-9 py-4.5 text-lg gap-3 rounded-2xl',
  icon: 'h-10 w-10 p-2 rounded-xl flex items-center justify-center',
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
      glow = false,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const hoverAnimation = bouncy
      ? {
          scale: 1.05,
          y: -2,
          transition: { type: 'spring' as const, stiffness: 400, damping: 15 },
        }
      : {
          scale: 1.02,
          y: -1,
          transition: { duration: 0.2, ease: 'easeOut' as const },
        };

    const tapAnimation = bouncy
      ? { scale: 0.95 }
      : { scale: 0.98, y: 0 };

    return (
      <motion.button
        ref={ref}
        whileHover={!disabled && !isLoading ? hoverAnimation : undefined}
        whileTap={!disabled && !isLoading ? tapAnimation : undefined}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-semibold',
          'transition-all duration-300 focus-visible:outline-none focus-visible:ring-2',
          'focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
          'disabled:opacity-50 disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          glow && 'shadow-glow-primary hover:shadow-glow-lg',
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

// Glass Button Component for premium UI
export const GlassButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  ({ className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="glass"
        className={cn('hover:shadow-2xl', className)}
        {...props}
      />
    );
  }
);

GlassButton.displayName = 'GlassButton';
