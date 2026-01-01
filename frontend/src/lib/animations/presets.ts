// Framer Motion Animation Presets for V2 Resort
// Different animation styles: playful for customers, professional for staff/admin

import { Variants, Transition } from 'framer-motion';

// ============================================
// Transitions
// ============================================

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

export const smoothTransition: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
};

export const bouncyTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 15,
};

export const elegantTransition: Transition = {
  duration: 0.4,
  ease: [0.25, 0.46, 0.45, 0.94],
};

// ============================================
// Fade Animations
// ============================================

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: elegantTransition,
  },
  exit: { opacity: 0 },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: smoothTransition,
  },
  exit: { opacity: 0, y: -10 },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: smoothTransition,
  },
  exit: { opacity: 0, y: 10 },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: smoothTransition,
  },
  exit: { opacity: 0, x: -10 },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: smoothTransition,
  },
  exit: { opacity: 0, x: 10 },
};

// ============================================
// Scale Animations
// ============================================

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: springTransition,
  },
  exit: { opacity: 0, scale: 0.95 },
};

export const scaleInBouncy: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: bouncyTransition,
  },
  exit: { opacity: 0, scale: 0.9 },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 25,
    },
  },
  exit: { opacity: 0, scale: 0.8 },
};

// ============================================
// Page Transitions
// ============================================

export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: { 
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

export const pageSlideUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: {
      duration: 0.3,
      ease: 'easeIn',
    },
  },
};

// ============================================
// Stagger Animations (for lists/grids)
// ============================================

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: smoothTransition,
  },
};

export const staggerItemScale: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: springTransition,
  },
};

// ============================================
// Interactive/Hover Animations
// ============================================

export const cardHover = {
  rest: { 
    scale: 1, 
    y: 0,
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  },
  hover: { 
    scale: 1.02, 
    y: -4,
    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    transition: springTransition,
  },
  tap: { 
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

export const buttonHover = {
  rest: { scale: 1 },
  hover: { 
    scale: 1.02,
    transition: { duration: 0.2 },
  },
  tap: { 
    scale: 0.95,
    transition: { duration: 0.1 },
  },
};

export const buttonBouncyHover = {
  rest: { scale: 1, rotate: 0 },
  hover: { 
    scale: 1.05,
    transition: bouncyTransition,
  },
  tap: { 
    scale: 0.9,
    rotate: [0, -3, 3, 0],
    transition: { duration: 0.15 },
  },
};

// ============================================
// Special Effects
// ============================================

export const floatAnimation: Variants = {
  hidden: { y: 0 },
  visible: {
    y: [-5, 5, -5],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const pulseAnimation: Variants = {
  hidden: { scale: 1, opacity: 1 },
  visible: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const shimmerAnimation: Variants = {
  hidden: { 
    backgroundPosition: '-200% 0',
  },
  visible: {
    backgroundPosition: '200% 0',
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const spinAnimation: Variants = {
  hidden: { rotate: 0 },
  visible: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// ============================================
// Kitchen/Staff Animations (Professional)
// ============================================

export const orderCardSlide: Variants = {
  hidden: { opacity: 0, x: -50, scale: 0.95 },
  visible: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: { 
    opacity: 0, 
    x: 50, 
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

export const statusChange: Variants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 20,
    },
  },
};

export const counterAnimation: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
};

// ============================================
// Modal/Dialog Animations
// ============================================

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: { 
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: springTransition,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: 10,
    transition: { duration: 0.15 },
  },
};

export const slideUpModal: Variants = {
  hidden: { opacity: 0, y: '100%' },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: { 
    opacity: 0, 
    y: '100%',
    transition: { duration: 0.2 },
  },
};

// ============================================
// Notification Animations
// ============================================

export const notificationSlide: Variants = {
  hidden: { opacity: 0, x: 100, scale: 0.9 },
  visible: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 25,
    },
  },
  exit: { 
    opacity: 0, 
    x: 100, 
    scale: 0.9,
    transition: {
      duration: 0.2,
    },
  },
};

export const badgePop: Variants = {
  hidden: { opacity: 0, scale: 0 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 15,
    },
  },
};
