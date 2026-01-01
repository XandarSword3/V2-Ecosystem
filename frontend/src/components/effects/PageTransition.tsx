'use client';

/**
 * Page Transition Component
 * 
 * Provides smooth page transitions with configurable animations.
 * Can be toggled on/off via settings.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useSettingsStore } from '@/lib/stores/settingsStore';

interface PageTransitionProps {
  children: ReactNode;
}

// Animation variants
const pageVariants = {
  // Fade transition
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  // Slide from right
  slideRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  // Slide from bottom
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  // Scale and fade
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
  // Elegant reveal
  reveal: {
    initial: { opacity: 0, y: 50, filter: 'blur(10px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: -30, filter: 'blur(5px)' },
  },
};

const transitionConfig = {
  duration: 0.4,
  ease: [0.25, 0.46, 0.45, 0.94] as const, // Custom easing
};

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const enableTransitions = useSettingsStore((s) => s.enableTransitions);
  const transitionStyle = useSettingsStore((s) => s.transitionStyle);

  // Get the appropriate variant
  const variant = pageVariants[transitionStyle as keyof typeof pageVariants] || pageVariants.fade;

  // If transitions are disabled, just render children
  if (!enableTransitions) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variant}
        transition={transitionConfig}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Section animation component for staggered content
 */
interface AnimatedSectionProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function AnimatedSection({ children, delay = 0, className = '' }: AnimatedSectionProps) {
  const enableTransitions = useSettingsStore((s) => s.enableTransitions);

  if (!enableTransitions) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered children animation
 */
interface StaggeredContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggeredContainer({ children, className = '', staggerDelay = 0.1 }: StaggeredContainerProps) {
  const enableTransitions = useSettingsStore((s) => s.enableTransitions);

  if (!enableTransitions) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
