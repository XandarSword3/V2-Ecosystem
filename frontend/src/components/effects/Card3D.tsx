/**
 * Card3D — effects removed, neutral passthroughs retained.
 * Index signature accepts any prop the original components accepted.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

export function Card3D({ children, className = '', style }: Props) {
  return <div className={className} style={style}>{children}</div>;
}

export function TiltCard({ children, className = '', style }: Props) {
  return <div className={className} style={style}>{children}</div>;
}

export function FloatingCard({ children, className = '', style }: Props) {
  return <div className={className} style={style}>{children}</div>;
}
