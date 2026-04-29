'use client';

import React from 'react';
import { cn } from '@/lib/cn';

type ContainerSize = 'sm' | 'md' | 'lg' | 'xl';

const maxWidthBySize: Record<ContainerSize, string> = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
};

type Props<T extends React.ElementType> = {
  as?: T;
  size?: ContainerSize;
  className?: string;
  children: React.ReactNode;
};

export function Container<T extends React.ElementType = 'div'>({
  as,
  size = 'xl',
  className,
  children,
}: Props<T> & Omit<React.ComponentPropsWithoutRef<T>, keyof Props<T>>) {
  const Component = (as ?? 'div') as React.ElementType;

  return (
    <Component
      className={cn('w-full mx-auto', maxWidthBySize[size], className)}
      style={{
        paddingLeft: 'max(var(--layout-page-x), env(safe-area-inset-left))',
        paddingRight: 'max(var(--layout-page-x), env(safe-area-inset-right))',
      }}
    >
      {children}
    </Component>
  );
}

