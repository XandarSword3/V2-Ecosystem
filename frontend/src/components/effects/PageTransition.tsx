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

// Animation variants - Premium transitions
const pageVariants = {
  // Fade transition
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  // Slide from right
  slideRight: {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  },
  // Slide from bottom
  slideUp: {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -30 },
  },
  // Scale and fade
  scale: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.08 },
  },
  // Elegant reveal with blur - Default premium option
  reveal: {
    initial: { opacity: 0, y: 60, filter: 'blur(12px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: -40, filter: 'blur(8px)' },
  },
  // Cinematic zoom reveal
  cinematic: {
    initial: { 
      opacity: 0, 
      scale: 1.1, 
      filter: 'blur(20px) saturate(0.5)',
    },
    animate: { 
      opacity: 1, 
      scale: 1, 
      filter: 'blur(0px) saturate(1)',
    },
    exit: { 
      opacity: 0, 
      scale: 0.95, 
      filter: 'blur(10px) saturate(0.8)',
    },
  },
  // Dramatic sweep from side
  sweep: {
    initial: { 
      opacity: 0, 
      x: -100,
      skewX: -5,
    },
    animate: { 
      opacity: 1, 
      x: 0,
      skewX: 0,
    },
    exit: { 
      opacity: 0, 
      x: 100,
      skewX: 5,
    },
  },
  // Luxury fade with scale
  luxury: {
    initial: { 
      opacity: 0, 
      scale: 0.96,
      y: 30,
      filter: 'blur(8px)',
    },
    animate: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      filter: 'blur(0px)',
    },
    exit: { 
      opacity: 0, 
      scale: 1.02,
      y: -20,
      filter: 'blur(6px)',
    },
  },
};

const transitionConfig = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1] as const, // Smooth cubic bezier (expo out)
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
      initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ 
        duration: 0.7, 
        delay, 
        ease: [0.22, 1, 0.36, 1],
      }}
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
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1 },
      }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Premium card reveal animation
 * Use for cards that should have a luxury reveal effect
 */
export function LuxuryReveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const enableTransitions = useSettingsStore((s) => s.enableTransitions);

  if (!enableTransitions) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ 
        opacity: 0, 
        y: 60, 
        scale: 0.9,
        filter: 'blur(10px)',
      }}
      whileInView={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
        filter: 'blur(0px)',
      }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ 
        duration: 0.8, 
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Horizontal slide reveal
 * Use for content that should slide in from the side
 */
export function SlideReveal({ 
  children, 
  className = '', 
  direction = 'left',
  delay = 0 
}: { 
  children: ReactNode; 
  className?: string; 
  direction?: 'left' | 'right';
  delay?: number;
}) {
  const enableTransitions = useSettingsStore((s) => s.enableTransitions);

  if (!enableTransitions) {
    return <div className={className}>{children}</div>;
  }

  const xOffset = direction === 'left' ? -80 : 80;

  return (
    <motion.div
      className={className}
      initial={{ 
        opacity: 0, 
        x: xOffset,
        filter: 'blur(8px)',
      }}
      whileInView={{ 
        opacity: 1, 
        x: 0,
        filter: 'blur(0px)',
      }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ 
        duration: 0.7, 
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
