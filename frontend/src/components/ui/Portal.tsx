'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
  /** 
   * The DOM element to render the portal into.
   * Defaults to document.body which ensures modals are outside any 
   * transform/filter containers that break fixed positioning.
   */
  container?: HTMLElement;
}

/**
 * Portal component that renders children into a DOM node outside the parent hierarchy.
 * This is essential for modals to work correctly when parent elements have CSS transforms
 * or filters (like framer-motion animations) which break `position: fixed`.
 */
export function Portal({ children, container }: PortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) {
    return null;
  }

  const portalContainer = container || document.body;
  
  return createPortal(children, portalContainer);
}

export default Portal;
