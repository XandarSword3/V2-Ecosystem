'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  decimals?: number;
  separator?: string;
  once?: boolean;
}

export function AnimatedCounter({
  value,
  duration = 2,
  delay = 0,
  prefix = '',
  suffix = '',
  className,
  decimals = 0,
  separator = ',',
  once = true,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once, margin: '-100px' });
  const [hasAnimated, setHasAnimated] = useState(false);

  const spring = useSpring(0, {
    mass: 1,
    stiffness: 75,
    damping: 15,
    duration: duration * 1000,
  });

  const display = useTransform(spring, (current) => {
    const fixed = current.toFixed(decimals);
    const [whole, decimal] = fixed.split('.');
    const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return decimals > 0 ? `${formatted}.${decimal}` : formatted;
  });

  useEffect(() => {
    if (isInView && (!once || !hasAnimated)) {
      const timeout = setTimeout(() => {
        spring.set(value);
        setHasAnimated(true);
      }, delay * 1000);
      return () => clearTimeout(timeout);
    }
  }, [isInView, value, delay, spring, once, hasAnimated]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}

// Stats display with animated counters
interface StatItemProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function AnimatedStat({
  value,
  label,
  prefix,
  suffix,
  icon,
  className,
}: StatItemProps) {
  return (
    <motion.div
      className={cn(
        'flex flex-col items-center text-center p-6 rounded-2xl',
        'bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl',
        'border border-white/30 dark:border-white/10',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5 }}
    >
      {icon && (
        <motion.div
          className="text-3xl text-primary-500 mb-3"
          whileHover={{ scale: 1.2, rotate: 10 }}
        >
          {icon}
        </motion.div>
      )}
      <div className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-2">
        <AnimatedCounter
          value={value}
          prefix={prefix}
          suffix={suffix}
          duration={2.5}
        />
      </div>
      <p className="text-slate-600 dark:text-slate-400 font-medium">{label}</p>
    </motion.div>
  );
}

// Stats row component
interface StatsRowProps {
  stats: Array<{
    value: number;
    label: string;
    prefix?: string;
    suffix?: string;
    icon?: React.ReactNode;
  }>;
  className?: string;
}

export function AnimatedStatsRow({ stats, className }: StatsRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6',
        className
      )}
    >
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <AnimatedStat {...stat} />
        </motion.div>
      ))}
    </div>
  );
}
