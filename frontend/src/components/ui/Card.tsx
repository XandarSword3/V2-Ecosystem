'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/cn';
import { ReactNode, forwardRef } from 'react';

interface CardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  hover?: boolean;
  glass?: boolean;
  gradient?: boolean;
  variant?: 'default' | 'glass' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, hover = true, glass = false, gradient = false, variant, padding = 'md', className, ...props }, ref) => {
    // Support both variant prop and individual glass/gradient props
    const isGlass = variant === 'glass' || glass;
    const isGradient = variant === 'gradient' || gradient;
    
    const baseStyles = cn(
      'rounded-2xl overflow-hidden',
      'transition-shadow duration-300',
      paddingStyles[padding]
    );

    const surfaceStyles = isGlass
      ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50'
      : isGradient
      ? 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700'
      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700';

    const shadowStyles = 'shadow-lg shadow-slate-900/5 dark:shadow-slate-900/20';

    if (!hover) {
      return (
        <div ref={ref} className={cn(baseStyles, surfaceStyles, shadowStyles, className)} {...(props as any)}>
          {children}
        </div>
      );
    }

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{
          y: -4,
          boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
          transition: { type: 'spring', stiffness: 400, damping: 25 },
        }}
        transition={{ duration: 0.3 }}
        className={cn(baseStyles, surfaceStyles, shadowStyles, 'cursor-pointer', className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4', className)}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn('text-xl font-semibold text-slate-900 dark:text-white', className)}>
      {children}
    </h3>
  );
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <p className={cn('text-sm text-slate-600 dark:text-slate-400 mt-1', className)}>
      {children}
    </p>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn('', className)}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-slate-200 dark:border-slate-700', className)}>
      {children}
    </div>
  );
}
