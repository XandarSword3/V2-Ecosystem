'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/cn';
import { ReactNode, forwardRef } from 'react';

interface CardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  hover?: boolean;
  glass?: boolean;
  gradient?: boolean;
  variant?: 'default' | 'glass' | 'gradient' | 'frosted' | 'premium';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  glow?: boolean;
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, hover = true, glass = false, gradient = false, variant, padding = 'md', glow = false, className, ...props }, ref) => {
    // Support both variant prop and individual glass/gradient props
    const isGlass = variant === 'glass' || glass;
    const isGradient = variant === 'gradient' || gradient;
    const isFrosted = variant === 'frosted';
    const isPremium = variant === 'premium';
    
    const baseStyles = cn(
      'rounded-2xl overflow-hidden',
      'transition-all duration-300',
      paddingStyles[padding]
    );

    const surfaceStyles = isFrosted
      ? 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/30 dark:border-slate-700/30'
      : isPremium
      ? 'bg-gradient-to-br from-white/90 via-white/80 to-white/70 dark:from-slate-800/90 dark:via-slate-800/80 dark:to-slate-900/70 backdrop-blur-xl border border-white/40 dark:border-slate-700/40'
      : isGlass
      ? 'bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/30 dark:border-slate-700/40'
      : isGradient
      ? 'bg-gradient-to-br from-white via-white/95 to-slate-50 dark:from-slate-800 dark:via-slate-800/95 dark:to-slate-900 border border-white/50 dark:border-slate-700/50 backdrop-blur-sm'
      : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border border-white/40 dark:border-slate-700/40';

    const shadowStyles = cn(
      'shadow-xl shadow-slate-900/5 dark:shadow-black/20',
      glow && 'shadow-glow-primary'
    );

    const glowStyles = glow ? 'ring-1 ring-primary-400/20 dark:ring-primary-500/20' : '';

    if (!hover) {
      return (
        <div ref={ref} className={cn(baseStyles, surfaceStyles, shadowStyles, glowStyles, className)} {...(props as any)}>
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
          y: -6,
          scale: 1.01,
          boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          transition: { type: 'spring', stiffness: 400, damping: 25 },
        }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(baseStyles, surfaceStyles, shadowStyles, glowStyles, 'cursor-pointer', className)}
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
  gradient?: boolean;
}

export function CardHeader({ children, className, gradient = false }: CardHeaderProps) {
  return (
    <div className={cn(
      'mb-4 pb-4 border-b',
      gradient 
        ? 'border-white/20 dark:border-slate-700/30 bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-slate-700/30'
        : 'border-slate-200/50 dark:border-slate-700/50',
      className
    )}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
  gradient?: boolean;
}

export function CardTitle({ children, className, gradient = false }: CardTitleProps) {
  return (
    <h3 className={cn(
      'text-xl font-bold',
      gradient 
        ? 'bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent'
        : 'text-slate-900 dark:text-white',
      className
    )}>
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
    <p className={cn('text-sm text-slate-600/90 dark:text-slate-400/90 mt-1.5 leading-relaxed', className)}>
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
  gradient?: boolean;
}

export function CardFooter({ children, className, gradient = false }: CardFooterProps) {
  return (
    <div className={cn(
      'mt-4 pt-4 border-t',
      gradient 
        ? 'border-white/20 dark:border-slate-700/30 bg-gradient-to-r from-transparent via-slate-50/50 to-transparent dark:via-slate-800/50'
        : 'border-slate-200/50 dark:border-slate-700/50',
      className
    )}>
      {children}
    </div>
  );
}

// Premium Glass Card variant for featured content
interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  intensity?: 'light' | 'medium' | 'strong';
  className?: string;
}

export function GlassCard({ children, intensity = 'medium', className, ...props }: GlassCardProps) {
  const intensityStyles = {
    light: 'bg-white/40 dark:bg-slate-900/40 backdrop-blur-lg border-white/20',
    medium: 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-white/30',
    strong: 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-white/40',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        y: -4,
        scale: 1.02,
        transition: { type: 'spring', stiffness: 400, damping: 25 },
      }}
      transition={{ duration: 0.4 }}
      className={cn(
        'rounded-3xl p-6 overflow-hidden',
        intensityStyles[intensity],
        'border dark:border-slate-700/40',
        'shadow-xl shadow-slate-900/5 dark:shadow-black/20',
        'hover:shadow-2xl',
        'transition-all duration-300',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
