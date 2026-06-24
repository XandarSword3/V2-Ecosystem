/**
 * TextEffects — effects removed, neutral passthroughs retained.
 * Index signature accepts any prop the original components accepted.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

export function GradientText({ children, className = '', style }: Props) {
  return <span className={className} style={style}>{children}</span>;
}

export function StaggerText({ children, className = '', style }: Props) {
  return <span className={className} style={style}>{children}</span>;
}

export function RevealHeading({ children, className = '', style }: Props) {
  return <span className={className} style={style}>{children}</span>;
}

export function BlurReveal({ children, className = '', style }: Props) {
  return <div className={className} style={style}>{children}</div>;
}

export function HighlightText({ children, className = '', style }: Props) {
  return <span className={className} style={style}>{children}</span>;
}

export function HoverLetters({ children, className = '', style }: Props) {
  return <span className={className} style={style}>{children}</span>;
}

interface TypewriterProps {
  text: string;
  speed?: number;
  className?: string;
}

export function TypewriterText({ text, className = '' }: TypewriterProps) {
  return <span className={className}>{text}</span>;
}
