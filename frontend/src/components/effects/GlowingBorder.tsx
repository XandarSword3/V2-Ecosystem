/**
 * GlowingBorder — effects removed, neutral passthroughs retained.
 * Index signature accepts any prop the original components accepted.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

export function SpotlightCard({ children, className = '', style }: Props) {
  return <div className={className} style={style}>{children}</div>;
}

export function MagneticButton({ children, className = '', style }: Props) {
  return <div className={className} style={style}>{children}</div>;
}

export function GlowBorder({ children, className = '', style }: Props) {
  return <div className={className} style={style}>{children}</div>;
}

export const GlowingBorder = GlowBorder;
