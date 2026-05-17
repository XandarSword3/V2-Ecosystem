'use client';

import React from 'react';
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
  const opacityMap = {
    subtle: 0.15,
    medium: 0.25,
    strong: 0.4,
  };

  return (
    <div
      className={cn(
        'relative flex flex-col min-h-screen overflow-hidden bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
        className
      )}
    >
      {/* Static aurora gradient — no JS animation, no blur filters, GPU-friendly */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: opacityMap[intensity] }}
      >
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-1/4 -right-40 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-accent, var(--color-primary)) 0%, transparent 70%)',
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
