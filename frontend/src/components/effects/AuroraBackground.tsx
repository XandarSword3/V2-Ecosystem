'use client';

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AuroraBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  showRadialGradient?: boolean;
  intensity?: 'subtle' | 'medium' | 'strong';
}

export function AuroraBackground({
  children,
  className,
  showRadialGradient = true,
  intensity = 'medium',
}: AuroraBackgroundProps) {
  const intensityMap = {
    subtle: 'opacity-30',
    medium: 'opacity-50',
    strong: 'opacity-70',
  };

  return (
    <div
      className={cn(
        'relative flex flex-col min-h-screen overflow-hidden bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
        className
      )}
    >
      {/* Aurora blobs */}
      <div className={cn('absolute inset-0', intensityMap[intensity])}>
        {/* Primary blob */}
        <motion.div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, 100, 50, 0],
            y: [0, 50, 100, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Secondary blob */}
        <motion.div
          className="absolute top-1/4 -right-40 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, -80, -40, 0],
            y: [0, 80, 40, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Accent blob */}
        <motion.div
          className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, 60, -30, 0],
            y: [0, -60, -30, 0],
            scale: [1, 1.2, 0.95, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Extra ambient blob */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-primary) 0%, var(--color-secondary) 50%, transparent 70%)',
            filter: 'blur(120px)',
            opacity: 0.3,
          }}
          animate={{
            scale: [1, 1.05, 0.98, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {/* Radial gradient overlay for depth */}
      {showRadialGradient && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 80% at 50% -20%, transparent 50%, rgba(255,255,255,0.8) 100%)',
          }}
        />
      )}

      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// Simpler aurora section for use within pages
interface AuroraSectionProps {
  children?: React.ReactNode;
  className?: string;
}

export function AuroraSection({ children, className }: AuroraSectionProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Gradient blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute -top-1/2 -left-1/4 w-[60%] h-[100%] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div 
          className="absolute -bottom-1/2 -right-1/4 w-[50%] h-[80%] rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
