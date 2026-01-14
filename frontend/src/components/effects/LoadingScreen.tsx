'use client';

/**
 * Cinematic Loading Screen
 * 
 * A luxurious, premium loading animation that plays on initial app load.
 * Features dynamic resort branding with elegant staggered animations,
 * particle effects, and a sophisticated reveal sequence.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';

interface LoadingScreenProps {
  minDuration?: number;
}

// Particle component for floating elements
const Particle = ({ delay, duration, size, x, y }: { delay: number; duration: number; size: number; x: string; y: string }) => (
  <motion.div
    className="absolute rounded-full"
    style={{
      width: size,
      height: size,
      left: x,
      top: y,
      background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), rgba(255,255,255,0.1))',
      boxShadow: '0 0 20px rgba(255,255,255,0.2)',
    }}
    initial={{ opacity: 0, scale: 0 }}
    animate={{
      opacity: [0, 0.8, 0.4, 0.8, 0],
      scale: [0, 1, 1.2, 1, 0],
      y: [0, -30, -60, -90, -120],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  />
);

// Elegant ring animation around logo
const LogoRing = ({ delay, scale, reverse }: { delay: number; scale: number; reverse?: boolean }) => (
  <motion.div
    className="absolute inset-0 rounded-full border border-white/20"
    style={{ transform: `scale(${scale})` }}
    initial={{ opacity: 0, rotate: 0 }}
    animate={{
      opacity: [0, 0.5, 0],
      rotate: reverse ? -360 : 360,
    }}
    transition={{
      duration: 8,
      delay,
      repeat: Infinity,
      ease: 'linear',
    }}
  />
);

export function LoadingScreen({ minDuration = 2500 }: LoadingScreenProps) {
  const t = useTranslations('common');
  const { settings } = useSiteSettings();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  // Phase used for potential future animation choreography
  const [, setPhase] = useState<'entering' | 'loading' | 'exiting'>('entering');
  const enableLoadingAnimation = useSettingsStore((s) => s.enableLoadingAnimation);
  
  // Dynamic branding from CMS
  const resortName = settings.resortName || 'V2 Resort';
  const tagline = settings.tagline || 'Experience Luxury';
  const logoText = resortName.substring(0, 2).toUpperCase();
  
  // Generate particles only on client to avoid hydration mismatch
  const [particles, setParticles] = useState<Array<{
    id: number;
    delay: number;
    duration: number;
    size: number;
    x: string;
    y: string;
  }>>([]);

  // Split resort name for staggered animation
  const nameLetters = resortName.split('');

  // Generate particles on mount (client-side only)
  useEffect(() => {
    setMounted(true);
    setParticles(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        delay: Math.random() * 3,
        duration: 4 + Math.random() * 2,
        size: 4 + Math.random() * 8,
        x: `${Math.random() * 100}%`,
        y: `${60 + Math.random() * 40}%`,
      }))
    );
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!enableLoadingAnimation) {
      setIsLoading(false);
      return;
    }

    const hasVisited = sessionStorage.getItem('v2resort_visited');
    if (hasVisited) {
      setIsLoading(false);
      return;
    }

    // Smooth progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        // Ease out progress
        const remaining = 100 - prev;
        return prev + Math.min(remaining * 0.15, 8);
      });
    }, 100);

    // Phase transitions
    setTimeout(() => setPhase('loading'), 500);
    
    const timer = setTimeout(() => {
      setPhase('exiting');
      setTimeout(() => {
        setIsLoading(false);
        sessionStorage.setItem('v2resort_visited', 'true');
      }, 800);
    }, minDuration);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [minDuration, enableLoadingAnimation, mounted]);

  // Don't render anything on server or before mount
  if (!mounted) {
    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900" />
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            scale: 1.1,
            filter: 'blur(10px)',
          }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Animated gradient background */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900"
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />

          {/* Mesh gradient overlay */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(at 40% 20%, rgba(255,255,255,0.15) 0px, transparent 50%),
                               radial-gradient(at 80% 0%, rgba(255,255,255,0.1) 0px, transparent 50%),
                               radial-gradient(at 0% 50%, rgba(255,255,255,0.1) 0px, transparent 50%),
                               radial-gradient(at 80% 50%, rgba(255,255,255,0.08) 0px, transparent 50%),
                               radial-gradient(at 0% 100%, rgba(255,255,255,0.12) 0px, transparent 50%)`,
            }}
          />

          {/* Floating particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p) => (
              <Particle key={p.id} {...p} />
            ))}
          </div>

          {/* Ambient light rays */}
          <motion.div
            className="absolute inset-0 overflow-hidden opacity-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            transition={{ delay: 0.5, duration: 1 }}
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-[200%] w-1 bg-gradient-to-b from-transparent via-white to-transparent"
                style={{
                  left: `${20 + i * 15}%`,
                  top: '-50%',
                  transform: 'rotate(15deg)',
                }}
                animate={{
                  opacity: [0, 0.5, 0],
                  x: [0, 100, 200],
                }}
                transition={{
                  duration: 3,
                  delay: i * 0.5,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
              />
            ))}
          </motion.div>

          {/* Main content */}
          <div className="relative z-10 text-center px-4">
            {/* Logo container */}
            <motion.div
              className="mb-10 relative inline-block"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
              }}
              transition={{ 
                duration: 1.2,
                type: 'spring',
                stiffness: 80,
                damping: 15,
              }}
            >
              {/* Rotating rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <LogoRing delay={0} scale={1.3} />
                <LogoRing delay={0.5} scale={1.5} reverse />
                <LogoRing delay={1} scale={1.7} />
              </div>

              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
                  transform: 'scale(2)',
                }}
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1.8, 2.2, 1.8],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              
              {/* Logo circle */}
              <motion.div
                className="relative w-36 h-36 md:w-44 md:h-44 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%)',
                  backdropFilter: 'blur(12px)',
                  border: '2px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
                animate={{ 
                  boxShadow: [
                    '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 40px rgba(255,255,255,0.2)',
                    '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 80px rgba(255,255,255,0.4)',
                    '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 40px rgba(255,255,255,0.2)',
                  ],
                }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {/* Logo text with staggered letters */}
                <div className="flex">
                  {logoText.split('').map((letter, i) => (
                    <motion.span
                      key={i}
                      className="text-5xl md:text-6xl font-bold text-white"
                      style={{ textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* Resort name with staggered letters */}
            <div className="overflow-hidden mb-3">
              <motion.div className="flex justify-center flex-wrap">
                {nameLetters.map((letter, i) => (
                  <motion.span
                    key={i}
                    className="text-4xl md:text-5xl lg:text-6xl font-bold text-white inline-block"
                    style={{ textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: 0.6 + i * 0.04,
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    {letter === ' ' ? '\u00A0' : letter}
                  </motion.span>
                ))}
              </motion.div>
            </div>

            {/* Tagline */}
            <motion.p
              className="text-lg md:text-xl text-white/70 mb-10 tracking-wide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
            >
              {tagline}
            </motion.p>

            {/* Elegant progress indicator */}
            <motion.div
              className="w-72 md:w-96 mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              {/* Progress track */}
              <div className="relative h-[2px] bg-white/10 rounded-full overflow-hidden">
                {/* Animated shimmer */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
                {/* Progress fill */}
                <motion.div
                  className="absolute left-0 top-0 h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8))',
                    boxShadow: '0 0 20px rgba(255,255,255,0.5)',
                  }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              
              {/* Loading text */}
              <motion.div
                className="flex items-center justify-center gap-2 mt-4"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-white/50 text-sm tracking-widest uppercase">
                  {t('loading')}
                </span>
                <motion.span
                  className="flex gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1 h-1 bg-white/50 rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </motion.span>
              </motion.div>
            </motion.div>
          </div>

          {/* Bottom wave decoration - more elegant */}
          <motion.div
            className="absolute bottom-0 left-0 right-0"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
          >
            <svg
              className="w-full h-32 md:h-40"
              viewBox="0 0 1440 160"
              preserveAspectRatio="none"
            >
              <motion.path
                fill="rgba(255,255,255,0.05)"
                d="M0,80 C240,140 480,20 720,80 C960,140 1200,20 1440,80 L1440,160 L0,160 Z"
                animate={{
                  d: [
                    "M0,80 C240,140 480,20 720,80 C960,140 1200,20 1440,80 L1440,160 L0,160 Z",
                    "M0,100 C240,40 480,120 720,60 C960,20 1200,100 1440,80 L1440,160 L0,160 Z",
                    "M0,80 C240,140 480,20 720,80 C960,140 1200,20 1440,80 L1440,160 L0,160 Z",
                  ],
                }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.path
                fill="rgba(255,255,255,0.08)"
                d="M0,100 C360,140 720,60 1080,100 C1260,120 1380,80 1440,100 L1440,160 L0,160 Z"
                animate={{
                  d: [
                    "M0,100 C360,140 720,60 1080,100 C1260,120 1380,80 1440,100 L1440,160 L0,160 Z",
                    "M0,120 C360,80 720,140 1080,100 C1260,60 1380,120 1440,100 L1440,160 L0,160 Z",
                    "M0,100 C360,140 720,60 1080,100 C1260,120 1380,80 1440,100 L1440,160 L0,160 Z",
                  ],
                }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              />
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Loading Screen Wrapper
 * 
 * Wraps children and blocks them from rendering until loading is complete.
 * This prevents the hydration issue and ensures proper loading sequence.
 */
interface LoadingScreenWrapperProps {
  children: React.ReactNode;
  minDuration?: number;
}

export function LoadingScreenWrapper({ children, minDuration = 2500 }: LoadingScreenWrapperProps) {
  const [mounted, setMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const enableLoadingAnimation = useSettingsStore((s) => s.enableLoadingAnimation);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Check if animation is disabled or already visited
    if (!enableLoadingAnimation) {
      setShowContent(true);
      setIsAnimating(false);
      return;
    }

    const hasVisited = sessionStorage.getItem('v2resort_visited');
    if (hasVisited) {
      setShowContent(true);
      setIsAnimating(false);
      return;
    }

    // Show loading screen for minDuration, then reveal content
    const timer = setTimeout(() => {
      setIsAnimating(false);
      sessionStorage.setItem('v2resort_visited', 'true');
      // Small delay to let exit animation start before showing content
      setTimeout(() => {
        setShowContent(true);
      }, 100);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [mounted, minDuration, enableLoadingAnimation]);

  // Server render: show nothing (prevents hydration mismatch)
  if (!mounted) {
    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900" />
    );
  }

  return (
    <>
      {isAnimating && <LoadingScreenContent />}
      {showContent && children}
    </>
  );
}

/**
 * Internal loading screen content (the actual animation)
 */
function LoadingScreenContent() {
  const t = useTranslations('common');
  const { settings } = useSiteSettings();
  const [progress, setProgress] = useState(0);
  const [particles, setParticles] = useState<Array<{
    id: number;
    delay: number;
    duration: number;
    size: number;
    x: string;
    y: string;
  }>>([]);
  
  const resortName = settings.resortName || 'V2 Resort';
  const tagline = settings.tagline || 'Experience Luxury';
  const logoText = resortName.substring(0, 2).toUpperCase();
  const nameLetters = resortName.split('');

  useEffect(() => {
    // Generate particles on client only
    setParticles(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        delay: Math.random() * 3,
        duration: 4 + Math.random() * 2,
        size: 4 + Math.random() * 8,
        x: `${Math.random() * 100}%`,
        y: `${60 + Math.random() * 40}%`,
      }))
    );

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        const remaining = 100 - prev;
        return prev + Math.min(remaining * 0.15, 8);
      });
    }, 100);

    return () => clearInterval(progressInterval);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ 
        opacity: 0,
        scale: 1.1,
        filter: 'blur(10px)',
      }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900" />

      {/* Mesh gradient overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(at 40% 20%, rgba(255,255,255,0.15) 0px, transparent 50%),
                           radial-gradient(at 80% 0%, rgba(255,255,255,0.1) 0px, transparent 50%),
                           radial-gradient(at 0% 50%, rgba(255,255,255,0.1) 0px, transparent 50%),
                           radial-gradient(at 80% 50%, rgba(255,255,255,0.08) 0px, transparent 50%),
                           radial-gradient(at 0% 100%, rgba(255,255,255,0.12) 0px, transparent 50%)`,
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <Particle key={p.id} {...p} />
        ))}
      </div>

      {/* Ambient light rays */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-[200%] w-1 bg-gradient-to-b from-transparent via-white to-transparent"
            style={{
              left: `${20 + i * 15}%`,
              top: '-50%',
              transform: 'rotate(15deg)',
            }}
            animate={{
              opacity: [0, 0.5, 0],
              x: [0, 100, 200],
            }}
            transition={{
              duration: 3,
              delay: i * 0.5,
              repeat: Infinity,
              repeatDelay: 2,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center px-4">
        {/* Logo container */}
        <motion.div
          className="mb-10 relative inline-block"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 1.2,
            type: 'spring',
            stiffness: 80,
            damping: 15,
          }}
        >
          {/* Rotating rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <LogoRing delay={0} scale={1.3} />
            <LogoRing delay={0.5} scale={1.5} reverse />
            <LogoRing delay={1} scale={1.7} />
          </div>

          {/* Glow effect */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
              transform: 'scale(2)',
            }}
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1.8, 2.2, 1.8],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          
          {/* Logo circle */}
          <motion.div
            className="relative w-36 h-36 md:w-44 md:h-44 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%)',
              backdropFilter: 'blur(12px)',
              border: '2px solid rgba(255,255,255,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
            animate={{ 
              boxShadow: [
                '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 40px rgba(255,255,255,0.2)',
                '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 80px rgba(255,255,255,0.4)',
                '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3), 0 0 40px rgba(255,255,255,0.2)',
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Logo text */}
            <div className="flex">
              {logoText.split('').map((letter, i) => (
                <motion.span
                  key={i}
                  className="text-5xl md:text-6xl font-bold text-white"
                  style={{ textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                >
                  {letter}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Resort name with staggered letters */}
        <div className="overflow-hidden mb-3">
          <motion.div className="flex justify-center flex-wrap">
            {nameLetters.map((letter, i) => (
              <motion.span
                key={i}
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-white inline-block"
                style={{ textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  delay: 0.6 + i * 0.04,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </motion.span>
            ))}
          </motion.div>
        </div>

        {/* Tagline */}
        <motion.p
          className="text-lg md:text-xl text-white/70 mb-10 tracking-wide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          {tagline}
        </motion.p>

        {/* Progress indicator */}
        <motion.div
          className="w-72 md:w-96 mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <div className="relative h-[2px] bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8))',
                boxShadow: '0 0 20px rgba(255,255,255,0.5)',
              }}
              initial={{ width: '0%' }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          
          <motion.div
            className="flex items-center justify-center gap-2 mt-4"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-white/50 text-sm tracking-widest uppercase">
              {t('loading')}
            </span>
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1 h-1 bg-white/50 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom wave decoration */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          className="w-full h-32 md:h-40"
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
        >
          <motion.path
            fill="rgba(255,255,255,0.05)"
            d="M0,80 C240,140 480,20 720,80 C960,140 1200,20 1440,80 L1440,160 L0,160 Z"
            animate={{
              d: [
                "M0,80 C240,140 480,20 720,80 C960,140 1200,20 1440,80 L1440,160 L0,160 Z",
                "M0,100 C240,40 480,120 720,60 C960,20 1200,100 1440,80 L1440,160 L0,160 Z",
                "M0,80 C240,140 480,20 720,80 C960,140 1200,20 1440,80 L1440,160 L0,160 Z",
              ],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.path
            fill="rgba(255,255,255,0.08)"
            d="M0,100 C360,140 720,60 1080,100 C1260,120 1380,80 1440,100 L1440,160 L0,160 Z"
            animate={{
              d: [
                "M0,100 C360,140 720,60 1080,100 C1260,120 1380,80 1440,100 L1440,160 L0,160 Z",
                "M0,120 C360,80 720,140 1080,100 C1260,60 1380,120 1440,100 L1440,160 L0,160 Z",
                "M0,100 C360,140 720,60 1080,100 C1260,120 1380,80 1440,100 L1440,160 L0,160 Z",
              ],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
        </svg>
      </div>
    </motion.div>
  );
}

/**
 * Smaller loading indicator for page-level loading
 */
export function PageLoader() {
  const { settings } = useSiteSettings();
  const logoText = (settings.resortName || 'V2').substring(0, 2).toUpperCase();
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <motion.div
        className="flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        {/* Spinning logo */}
        <div className="relative">
          <motion.div
            className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg"
          >
            <span className="text-white font-bold text-xl">{logoText}</span>
          </motion.div>
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary-300 border-t-primary-600"
            animate={{ rotate: -360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <motion.p
          className="mt-4 text-slate-600 dark:text-slate-400 text-sm tracking-wide"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading...
        </motion.p>
      </motion.div>
    </div>
  );
}

// Keep old export for backwards compatibility - LoadingScreen is already exported above
export default LoadingScreen;
