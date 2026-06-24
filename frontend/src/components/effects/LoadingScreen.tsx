/**
 * LoadingScreen — effects removed, neutral passthrough retained.
 * Full-screen loading overlay animation gone; renders children directly.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
}

export function LoadingScreenWrapper({ children }: Props) {
  return <>{children}</>;
}

export function LoadingScreen() {
  return null;
}

export default LoadingScreen;
