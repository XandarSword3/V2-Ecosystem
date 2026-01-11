'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}

export function BentoGrid({ children, className, columns = 3 }: BentoGridProps) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  };

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 md:gap-6',
        gridCols[columns],
        className
      )}
    >
      {children}
    </div>
  );
}

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  colSpan?: 1 | 2;
  rowSpan?: 1 | 2;
  variant?: 'default' | 'glass' | 'gradient' | 'solid' | 'outline';
  href?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

export function BentoCard({
  children,
  className,
  colSpan = 1,
  rowSpan = 1,
  variant = 'glass',
  href,
  onClick,
  hoverEffect = true,
}: BentoCardProps) {
  const colSpanClasses = {
    1: 'md:col-span-1',
    2: 'md:col-span-2',
  };

  const rowSpanClasses = {
    1: 'md:row-span-1',
    2: 'md:row-span-2',
  };

  const variantClasses = {
    default: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800',
    glass: 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-glass',
    gradient: 'bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border border-white/20',
    solid: 'bg-gradient-to-br from-primary-500 to-primary-600 text-white border-none',
    outline: 'bg-transparent border-2 border-primary-500/30 hover:border-primary-500/50',
  };

  const content = (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-2xl p-6',
        colSpanClasses[colSpan],
        rowSpanClasses[rowSpan],
        variantClasses[variant],
        hoverEffect && 'transition-all duration-300',
        (href || onClick) && 'cursor-pointer',
        className
      )}
      whileHover={hoverEffect ? {
        y: -4,
        scale: 1.01,
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
      } : undefined}
      transition={{ duration: 0.2 }}
      onClick={onClick}
    >
      {/* Gradient overlay on hover */}
      {hoverEffect && (
        <div 
          className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary)10, var(--color-secondary)10)',
          }}
        />
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} className="group">
        {content}
      </a>
    );
  }

  return <div className="group">{content}</div>;
}

// Feature card for services
interface BentoFeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  image?: string;
  href?: string;
  colSpan?: 1 | 2;
  rowSpan?: 1 | 2;
  className?: string;
}

export function BentoFeatureCard({
  icon,
  title,
  description,
  image,
  href,
  colSpan = 1,
  rowSpan = 1,
  className,
}: BentoFeatureCardProps) {
  const isLarge = colSpan === 2 || rowSpan === 2;

  return (
    <BentoCard
      colSpan={colSpan}
      rowSpan={rowSpan}
      href={href}
      className={cn('group', className)}
    >
      {/* Background image */}
      {image && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 group-hover:opacity-30 transition-opacity duration-500"
          style={{ backgroundImage: `url(${image})` }}
        />
      )}

      {/* Content */}
      <div className={cn('flex flex-col h-full', isLarge ? 'gap-6' : 'gap-4')}>
        {/* Icon */}
        <motion.div
          className={cn(
            'flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500/10 to-primary-500/5',
            isLarge ? 'w-16 h-16' : 'w-12 h-12'
          )}
          whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
          transition={{ duration: 0.5 }}
        >
          <div className={cn('text-primary-500', isLarge ? 'text-3xl' : 'text-2xl')}>
            {icon}
          </div>
        </motion.div>

        {/* Text */}
        <div className="flex-1">
          <h3 className={cn(
            'font-bold text-slate-900 dark:text-white mb-2',
            isLarge ? 'text-2xl' : 'text-lg'
          )}>
            {title}
          </h3>
          <p className={cn(
            'text-slate-600 dark:text-slate-400',
            isLarge ? 'text-base' : 'text-sm'
          )}>
            {description}
          </p>
        </div>

        {/* Arrow indicator */}
        {href && (
          <motion.div
            className="flex items-center gap-2 text-primary-500 font-medium text-sm"
            whileHover={{ x: 5 }}
          >
            <span>Explore</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </motion.div>
        )}
      </div>
    </BentoCard>
  );
}
