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

export function AnimatedSection({ children, className = '' }: Props) {
  return <div className={className}>{children}</div>;
}

export function StaggeredContainer({ children, className = '' }: Props) {
  return <div className={className}>{children}</div>;
}

export function StaggeredItem({ children, className = '' }: Props) {
  return <div className={className}>{children}</div>;
}

export function LuxuryReveal({ children, className = '' }: Props) {
  return <div className={className}>{children}</div>;
}

export function SlideReveal({ children, className = '' }: Props) {
  return <div className={className}>{children}</div>;
}

export default PageTransition;
