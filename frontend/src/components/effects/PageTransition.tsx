/**
 * PageTransition — effects removed, neutral passthrough retained.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: Props) {
  return <div className={className}>{children}</div>;
}

export default PageTransition;
