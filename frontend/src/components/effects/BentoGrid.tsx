/**
 * BentoGrid — effects removed, neutral passthroughs retained.
 * Index signature accepts any prop the original components accepted.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

export function BentoGrid({ children, className = '', style }: Props) {
  return <div className={`grid ${className}`} style={style}>{children}</div>;
}

export function BentoCard({ children, className = '', style }: Props) {
  return <div className={className} style={style}>{children}</div>;
}

export function BentoFeatureCard({ children, className = '', style, title, description }: Props & { title?: string; description?: string }) {
  return (
    <div className={className} style={style}>
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
