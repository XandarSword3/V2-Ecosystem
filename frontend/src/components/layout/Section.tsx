'use client';

import React from 'react';
import { cn } from '@/lib/cn';

type SectionTone = 'default' | 'muted' | 'surface';

const toneClasses: Record<SectionTone, string> = {
  default: '',
  muted: 'bg-muted text-foreground',
  surface: 'bg-cms-surface text-foreground',
};

export function Section({
  as: Component = 'section',
  tone = 'default',
  className,
  children,
  ...props
}: {
  as?: React.ElementType;
  tone?: SectionTone;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<'section'>, 'as' | 'children'>) {
  return (
    <Component className={cn('py-section-y', toneClasses[tone], className)} {...props}>
      {children}
    </Component>
  );
}

