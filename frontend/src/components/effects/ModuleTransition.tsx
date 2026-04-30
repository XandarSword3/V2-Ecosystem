'use client';

/**
 * Module Transition System
 * 
 * Premium transition effects when navigating between different module spaces.
 * Uses "Curtain of Atmosphere" concept with module-specific signature effects.
 * 
 * White-label safe: All colors derived from CSS variables.
 */

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode, useRef, useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ModuleTransitionProps {
  children: ReactNode;
}

type AtmosphereType = 'core' | 'culinary' | 'aquatic' | 'sanctuary' | 'casual' | 'portal' | 'discovery';
type Direction = 'forward' | 'back' | 'same';

interface AtmosphereConfig {
  type: AtmosphereType;
  primary: string;
  secondary: string;
  texture: 'grain' | 'noise' | 'waves' | 'fabric' | 'dots' | 'minimal' | 'geometric';
}

// ============================================================================
// Atmosphere Resolver - Route to atmosphere mapping (White-label safe)
// ============================================================================

/**
 * Resolve route to atmosphere configuration
 * Uses CSS color-mix() for dynamic color shifts without hardcoded values
 */
const getAtmosphere = (route: string): AtmosphereConfig => {
  // Helper to create color mix CSS
  const warmShift = 'color-mix(in srgb, var(--color-accent) 70%, var(--color-primary) 30%)';
  const coolShift = 'color-mix(in srgb, var(--color-primary) 80%, var(--color-secondary) 20%)';
  const blendPrimaryAccent = 'color-mix(in srgb, var(--color-primary) 50%, var(--color-accent) 50%)';

  if (route === '/' || route === '') {
    return {
      type: 'core',
      primary: 'var(--color-primary)',
      secondary: 'var(--color-secondary)',
      texture: 'grain',
    };
  }

  if (route.startsWith('/restaurant')) {
    return {
      type: 'culinary',
      primary: warmShift,
      secondary: 'var(--color-primary)',
      texture: 'noise',
    };
  }

  if (route.startsWith('/pool')) {
    return {
      type: 'aquatic',
      primary: 'var(--color-secondary)',
      secondary: 'var(--color-primary)',
      texture: 'waves',
    };
  }

  if (route.startsWith('/chalets')) {
    return {
      type: 'sanctuary',
      primary: coolShift,
      secondary: 'var(--color-surface)',
      texture: 'fabric',
    };
  }

  if (route.startsWith('/snack-bar')) {
    return {
      type: 'casual',
      primary: 'var(--color-accent)',
      secondary: 'var(--color-secondary)',
      texture: 'dots',
    };
  }

  if (route.startsWith('/login') || route.startsWith('/register') || 
      route.startsWith('/forgot-password') || route.startsWith('/reset-password')) {
    return {
      type: 'portal',
      primary: 'var(--color-primary)',
      secondary: 'var(--color-text-muted)',
      texture: 'minimal',
    };
  }

  // Dynamic [slug] routes and catch-all
  return {
    type: 'discovery',
    primary: blendPrimaryAccent,
    secondary: 'var(--color-secondary)',
    texture: 'geometric',
  };
};

// ============================================================================
// Direction Detection
// ============================================================================

/**
 * Determine navigation direction based on route depth change
 */
const getDirection = (from: string, to: string): Direction => {
  const fromDepth = from.split('/').filter(Boolean).length;
  const toDepth = to.split('/').filter(Boolean).length;

  if (toDepth > fromDepth) return 'forward';
  if (toDepth < fromDepth) return 'back';
  return 'same';
};

// ============================================================================
// Signature Effects Components
// ============================================================================

/**
 * Restaurant - "Steam Rise" - Vertical wisps rising
 */
const SteamWisps = ({ primary }: { primary: string }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(4)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 rounded-full"
        style={{
          background: `linear-gradient(to top, transparent, ${primary}, transparent)`,
          opacity: 0.2,
          left: `${20 + i * 20}%`,
          bottom: '-20%',
          height: '40%',
        }}
        animate={{
          y: [0, -100, -200],
          opacity: [0, 0.3, 0],
        }}
        transition={{
          duration: 8,
          delay: i * 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
);

/**
 * Pool - "Ripple Spread" - Expanding concentric circles
 */
const RippleEffect = ({ secondary }: { secondary: string }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
    {[...Array(3)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full border-2"
        style={{
          borderColor: secondary,
          opacity: 0.3,
        }}
        initial={{ width: 0, height: 0 }}
        animate={{
          width: ['0vmax', '100vmax'],
          height: ['0vmax', '100vmax'],
          opacity: [0.5, 0],
        }}
        transition={{
          duration: 2,
          delay: i * 0.5,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
    ))}
  </div>
);

/**
 * Chalets - "Forest Breeze" - Horizontal organic drift
 */
const ForestDrift = ({ primary }: { primary: string }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(6)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute"
        style={{
          background: `linear-gradient(90deg, transparent, ${primary}, transparent)`,
          opacity: 0.15,
          width: '30%',
          height: '2px',
          top: `${15 + i * 15}%`,
          left: '-30%',
        }}
        animate={{
          x: ['0vw', '130vw'],
        }}
        transition={{
          duration: 15 + i * 3,
          delay: i * 2,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    ))}
  </div>
);

/**
 * Snack Bar - "Pop Fizz" - Popping circles
 */
const PopFizz = ({ primary }: { primary: string }) => {
  const [pops, setPops] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    const newPops = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
    }));
    setPops(newPops);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pops.map((pop) => (
        <motion.div
          key={pop.id}
          className="absolute rounded-full"
          style={{
            background: primary,
            left: `${pop.x}%`,
            top: `${pop.y}%`,
          }}
          initial={{ width: 0, height: 0, opacity: 0 }}
          animate={{
            width: [0, 20, 0],
            height: [0, 20, 0],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 1,
            delay: Math.random() * 2,
            repeat: Infinity,
            repeatDelay: 1 + Math.random(),
          }}
        />
      ))}
    </div>
  );
};

/**
 * Home - "Horizon Glow" - Breathing horizontal band
 */
const HorizonGlow = ({ primary }: { primary: string }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <motion.div
      className="w-full h-1/3"
      style={{
        background: `linear-gradient(to bottom, transparent, ${primary}, transparent)`,
        opacity: 0.4,
      }}
      animate={{
        scaleY: [1, 1.1, 1],
        opacity: [0.3, 0.5, 0.3],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  </div>
);

/**
 * Dynamic - "Constellation Connect" - Connecting dots
 */
const ConstellationConnect = ({ primary, secondary }: { primary: string; secondary: string }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          background: primary,
          width: 6,
          height: 6,
          left: `${10 + (i * 11)}%`,
          top: `${20 + (Math.sin(i) * 20 + 20)}%`,
          opacity: 0.5,
        }}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.3, 0.7, 0.3],
        }}
        transition={{
          duration: 3,
          delay: i * 0.3,
          repeat: Infinity,
        }}
      />
    ))}
    {/* Connecting lines */}
    <svg className="absolute inset-0 w-full h-full">
      <motion.path
        d="M 10% 40% Q 30% 20% 50% 40% T 90% 40%"
        stroke={secondary}
        strokeWidth="1"
        fill="none"
        strokeOpacity={0.2}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
      />
    </svg>
  </div>
);

/**
 * Portal - Minimal clean effect
 */
const PortalMinimal = ({ primary }: { primary: string }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <motion.div
      className="w-64 h-64 rounded-full"
      style={{
        border: `2px solid ${primary}`,
        opacity: 0.3,
      }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.2, 0.4, 0.2],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  </div>
);

/**
 * Render the appropriate signature effect based on atmosphere type
 */
const SignatureEffect = ({ atmosphere }: { atmosphere: AtmosphereConfig }) => {
  switch (atmosphere.type) {
    case 'culinary':
      return <SteamWisps primary={atmosphere.primary} />;
    case 'aquatic':
      return <RippleEffect secondary={atmosphere.secondary} />;
    case 'sanctuary':
      return <ForestDrift primary={atmosphere.primary} />;
    case 'casual':
      return <PopFizz primary={atmosphere.primary} />;
    case 'core':
      return <HorizonGlow primary={atmosphere.primary} />;
    case 'discovery':
      return <ConstellationConnect primary={atmosphere.primary} secondary={atmosphere.secondary} />;
    case 'portal':
      return <PortalMinimal primary={atmosphere.primary} />;
    default:
      return null;
  }
};

// ============================================================================
// Curtain Animation Variants
// ============================================================================

const curtainVariants = {
  // Forward: curtain from right (LTR) or left (RTL)
  forwardEnter: {
    clipPath: 'circle(0% at 100% 50%)',
    opacity: 1,
  },
  forwardVisible: {
    clipPath: 'circle(150% at 100% 50%)',
    transition: { duration: 0.4, ease: [0.77, 0, 0.175, 1] as const },
  },
  forwardExit: {
    clipPath: 'circle(0% at 0% 50%)',
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const, delay: 0.2 },
  },

  // Back: curtain from left (LTR) or right (RTL)
  backEnter: {
    clipPath: 'circle(0% at 0% 50%)',
    opacity: 1,
  },
  backVisible: {
    clipPath: 'circle(150% at 0% 50%)',
    transition: { duration: 0.4, ease: [0.77, 0, 0.175, 1] as const },
  },
  backExit: {
    clipPath: 'circle(0% at 100% 50%)',
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const, delay: 0.2 },
  },

  // Same level: curtain from bottom
  sameEnter: {
    clipPath: 'circle(0% at 50% 100%)',
    opacity: 1,
  },
  sameVisible: {
    clipPath: 'circle(150% at 50% 100%)',
    transition: { duration: 0.4, ease: [0.77, 0, 0.175, 1] as const },
  },
  sameExit: {
    clipPath: 'circle(0% at 50% 0%)',
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const, delay: 0.2 },
  },
};

const contentVariants = {
  initial: { scale: 0.98, opacity: 0.9 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const, delay: 0.4 },
  },
  exit: {
    scale: 0.98,
    opacity: 0.9,
    transition: { duration: 0.2 },
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function ModuleTransition({ children }: ModuleTransitionProps) {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState<Direction>('forward');
  const [atmosphere, setAtmosphere] = useState<AtmosphereConfig>(getAtmosphere(pathname));
  
  const enableTransitions = useSettingsStore((s) => s.enableTransitions);
  const animationsEnabled = useSettingsStore((s) => s.animationsEnabled);
  const reducedMotionSetting = useSettingsStore((s) => s.reducedMotion);
  const prefersReducedMotion = useReducedMotion();

  const motionEnabled =
    enableTransitions && animationsEnabled && !reducedMotionSetting && !prefersReducedMotion;

  // Track route changes and trigger transitions
  useEffect(() => {
    if (pathname === prevPathRef.current) return;

    const newDirection = getDirection(prevPathRef.current, pathname);
    const newAtmosphere = getAtmosphere(pathname);

    setDirection(newDirection);
    setAtmosphere(newAtmosphere);
    setIsTransitioning(true);

    prevPathRef.current = pathname;

    // Clear transitioning state after animation completes
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 1400);

    return () => clearTimeout(timer);
  }, [pathname]);

  // If transitions disabled, just render children
  if (!motionEnabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Main content with subtle entrance animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={contentVariants}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* Curtain overlay during transition */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            className="fixed inset-0 z-[100] pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, ${atmosphere.primary} 0%, ${atmosphere.secondary} 100%)`,
            }}
            variants={curtainVariants}
            initial={`${direction}Enter`}
            animate={`${direction}Visible`}
            exit={`${direction}Exit`}
          >
            {/* Module signature effect */}
            <SignatureEffect atmosphere={atmosphere} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ModuleTransition;
