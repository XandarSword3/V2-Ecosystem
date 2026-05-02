'use client';

/**
 * Cinematic Loading Screen - Enhanced 5 Stage Sequence
 * 
 * Stage 1 (0-500ms): Void - Complete darkness, anticipation builds
 * Stage 2 (500-2000ms): Orbital Rings - Golden ratio rings with constellation lines
 * Stage 3 (2000-3500ms): Aurora Field - Multi-layered mesh gradient with light rays
 * Stage 4 (3500-5500ms): Typography Reveal - Resort name with letter cascade
 * Stage 5 (5500-8000ms): Particle Bloom - Orbiting sparkles, glow intensifies
 * Exit (8000ms+): Dramatic curtain rise with blur and brightness flash
 */

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';

interface LoadingScreenProps {
  minDuration?: number;
}

// Stage timing - MUCH SLOWER for visibility (milliseconds)
const STAGE_TIMING = {
  void: 0,
  rings: 500,
  aurora: 2000,
  typography: 3500,
  particles: 5500,
  complete: 8000,
} as const;

// Golden ratio
const PHI = 1.618;

// Aurora mesh gradient with film grain
const AuroraField = ({ visible }: { visible: boolean }) => {
  if (!visible) return null;
  
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Primary gradient orbs */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 40%, var(--color-primary) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 20%, color-mix(in srgb, var(--color-primary) 70%, #a855f7) 0%, transparent 50%),
            radial-gradient(ellipse 70% 60% at 60% 80%, color-mix(in srgb, var(--color-primary) 60%, #3b82f6) 0%, transparent 50%)
          `,
          filter: 'blur(80px)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          x: ['0%', '5%', '-5%', '0%'],
          y: ['0%', '-5%', '5%', '0%'],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Secondary glow layer */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 60%)',
        }}
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      {/* Film grain noise overlay */}
      <div 
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Light rays from center */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 h-full origin-top"
            style={{
              width: '2px',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, transparent 60%)',
              transform: `translateX(-50%) rotate(${i * 30}deg)`,
              marginTop: '-10%',
            }}
            animate={{
              opacity: [0.1, 0.3, 0.1],
              scaleY: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 4,
              delay: i * 0.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

// Centered orbital ring
const OrbitalRing = ({ 
  index, 
  total, 
  color 
}: { 
  index: number; 
  total: number; 
  color: string;
}) => {
  const baseSize = 200;
  const size = baseSize * Math.pow(PHI, index / 2.5);
  const delay = index * 0.3;
  const duration = 20 + index * 5;
  const reverse = index % 2 === 1;
  
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: '50%',
        top: '50%',
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderColor: color,
        borderWidth: index === 0 ? '2px' : '1px',
        borderStyle: 'solid',
      }}
      initial={{ 
        opacity: 0, 
        scale: 0.5,
        rotate: 0,
      }}
      animate={{ 
        opacity: [0.2, 0.5, 0.2],
        scale: 1,
        rotate: reverse ? -360 : 360,
      }}
      transition={{
        opacity: { duration: 3, repeat: Infinity, ease: 'easeInOut', delay },
        scale: { duration: 1, ease: [0.22, 1, 0.36, 1] },
        rotate: { duration, repeat: Infinity, ease: 'linear', delay },
      }}
    />
  );
};

// Orbiting particle system with trails
const OrbitingParticles = ({ count = 50 }: { count?: number }) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (i / count) * 360,
      radius: 150 + Math.random() * 200,
      size: Math.random() * 4 + 2,
      speed: 0.5 + Math.random() * 1,
      delay: Math.random() * 2,
      orbitTilt: Math.random() * 30 - 15,
    }));
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
            background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 70%)',
            boxShadow: '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.4)',
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.8, 0.4, 0.8, 0],
            x: [
              Math.cos((p.angle * Math.PI) / 180) * p.radius,
              Math.cos(((p.angle + 90) * Math.PI) / 180) * p.radius,
              Math.cos(((p.angle + 180) * Math.PI) / 180) * p.radius,
              Math.cos(((p.angle + 270) * Math.PI) / 180) * p.radius,
              Math.cos(((p.angle + 360) * Math.PI) / 180) * p.radius,
            ],
            y: [
              Math.sin((p.angle * Math.PI) / 180) * p.radius * 0.3,
              Math.sin(((p.angle + 90) * Math.PI) / 180) * p.radius * 0.3,
              Math.sin(((p.angle + 180) * Math.PI) / 180) * p.radius * 0.3,
              Math.sin(((p.angle + 270) * Math.PI) / 180) * p.radius * 0.3,
              Math.sin(((p.angle + 360) * Math.PI) / 180) * p.radius * 0.3,
            ],
            scale: [0.5, 1.2, 1, 1.2, 0.5],
          }}
          transition={{
            duration: 8 / p.speed,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
};

// Rising sparkles from bottom
const RisingSparkles = ({ count = 40 }: { count?: number }) => {
  const sparkles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 2,
      size: Math.random() * 3 + 1,
    }));
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {sparkles.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            bottom: -20,
            width: s.size,
            height: s.size,
            background: 'white',
            boxShadow: '0 0 10px white, 0 0 20px rgba(255,255,255,0.5)',
          }}
          initial={{ opacity: 0, y: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [-window.innerHeight * 0.3, -window.innerHeight * 0.6, -window.innerHeight],
            scale: [0, 1, 0.5],
            x: [0, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 50],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
};

// Typography reveal with 3D letter cascade
const TypographyReveal = ({ 
  text, 
  delay = 0,
  className = '',
}: { 
  text: string; 
  delay?: number;
  className?: string;
}) => {
  const letters = text.split('');
  
  return (
    <div className={`flex justify-center flex-wrap ${className}`} style={{ perspective: '1000px' }}>
      {letters.map((letter, i) => (
        <motion.span
          key={i}
          className="inline-block font-bold text-4xl md:text-6xl lg:text-7xl"
          style={{
            color: 'var(--color-loading-text, white)',
            textShadow: '0 4px 30px rgba(0,0,0,0.4), 0 0 60px rgba(255,255,255,0.1)',
            transformStyle: 'preserve-3d',
          }}
          initial={{ 
            y: 80, 
            opacity: 0,
            rotateX: -90,
            scale: 0.8,
          }}
          animate={{ 
            y: 0, 
            opacity: 1,
            rotateX: 0,
            scale: 1,
          }}
          transition={{
            duration: 0.8,
            delay: delay + i * 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {letter === ' ' ? '\u00A0' : letter}
        </motion.span>
      ))}
    </div>
  );
};

// Reduced motion fallback
const ReducedMotionLoader = ({ resortName }: { resortName: string }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900">
    <div className="text-center">
      <div className="text-3xl font-bold text-white mb-4">{resortName}</div>
      <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden mx-auto">
        <motion.div
          className="h-full bg-white rounded-full"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  </div>
);

export function LoadingScreen({ minDuration = 4000 }: LoadingScreenProps) {
  const t = useTranslations('common');
  const { settings } = useSiteSettings();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'void' | 'rings' | 'aurora' | 'typography' | 'particles' | 'complete'>('void');
  const enableLoadingAnimation = useSettingsStore((s) => s.enableLoadingAnimation);
  const shouldReduceMotion = useReducedMotion();
  const startTimeRef = useRef<number>(0);
  
  // CMS branding
  const resortName = settings.resortName?.trim() || 'Resort Experience';
  const tagline = settings.tagline?.trim() || t('loading');
  const logoText = resortName.substring(0, 2).toUpperCase();
  const primaryColor = 'var(--color-primary, #6366f1)';
  
  // Mount effect
  useEffect(() => {
    setMounted(true);
    startTimeRef.current = Date.now();
  }, []);
  
  // Stage progression - independent of loading state
  useEffect(() => {
    if (!mounted) return;
    
    const timers = [
      setTimeout(() => setStage('rings'), STAGE_TIMING.rings),
      setTimeout(() => setStage('aurora'), STAGE_TIMING.aurora),
      setTimeout(() => setStage('typography'), STAGE_TIMING.typography),
      setTimeout(() => setStage('particles'), STAGE_TIMING.particles),
      setTimeout(() => setStage('complete'), STAGE_TIMING.complete),
    ];
    
    return () => timers.forEach(clearTimeout);
  }, [mounted]);
  
  // Progress calculation - ALWAYS runs regardless of settings state
  useEffect(() => {
    if (!mounted) return;
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / minDuration) * 100, 99);
      setProgress(newProgress);
      
      if (elapsed < minDuration) {
        requestAnimationFrame(updateProgress);
      } else {
        setProgress(100);
        setTimeout(() => setIsLoading(false), 500);
      }
    };
    
    const rafId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(rafId);
  }, [minDuration, mounted]);
  
  // Skip animation if disabled
  useEffect(() => {
    if (enableLoadingAnimation === false) {
      setIsLoading(false);
    }
  }, [enableLoadingAnimation]);
  
  // Don't render on server
  if (!mounted) {
    return (
      <div 
        className="fixed inset-0 z-[9999] bg-slate-950"
        style={{ background: 'var(--color-loading-bg, #020617)' }}
      />
    );
  }
  
  // Reduced motion fallback
  if (shouldReduceMotion) {
    return isLoading ? <ReducedMotionLoader resortName={resortName} /> : null;
  }
  
  return (
    <AnimatePresence mode="wait">
      {isLoading && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            scale: 1.05,
            filter: 'blur(30px) brightness(2)',
          }}
          transition={{ 
            duration: 1.2, 
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ background: 'var(--color-loading-bg, #020617)' }}
        >
          {/* Vignette overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.5) 100%)',
            }}
          />
          
          {/* STAGE 2: Orbital Rings - PROPERLY CENTERED */}
          <AnimatePresence>
            {stage !== 'void' && stage !== 'complete' && (
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.5 }}
                transition={{ duration: 1 }}
              >
                {/* Constellation lines connecting rings */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.3 }}
                    transition={{ delay: 1, duration: 1 }}
                  >
                    {[0, 1, 2, 3].map((i) => {
                      const angle = (i * 90 + 45) * (Math.PI / 180);
                      return (
                        <motion.line
                          key={i}
                          x1="50%"
                          y1="50%"
                          x2={`${50 + Math.cos(angle) * 20}%`}
                          y2={`${50 + Math.sin(angle) * 20}%`}
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="1"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ delay: 0.5 + i * 0.2, duration: 1.5 }}
                        />
                      );
                    })}
                  </motion.g>
                </svg>
                
                {/* Rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {[0, 1, 2, 3].map((i) => (
                    <OrbitalRing 
                      key={i} 
                      index={i} 
                      total={4} 
                      color={primaryColor}
                    />
                  ))}
                </div>
                
                {/* Center glow pulse */}
                <motion.div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: 20,
                    height: 20,
                    background: primaryColor,
                    boxShadow: `0 0 60px ${primaryColor}, 0 0 100px ${primaryColor}80`,
                  }}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* STAGE 3: Aurora Field */}
          <AuroraField visible={stage === 'aurora' || stage === 'typography' || stage === 'particles'} />
          
          {/* Main content container */}
          <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
            
            {/* Logo reveal - glassmorphic */}
            <AnimatePresence>
              {(stage === 'typography' || stage === 'particles' || stage === 'complete') && (
                <motion.div
                  className="mb-10"
                  initial={{ opacity: 0, scale: 0.5, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50, scale: 0.8 }}
                  transition={{ 
                    duration: 1, 
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <motion.div 
                    className="w-28 h-28 md:w-36 md:h-36 mx-auto rounded-full flex items-center justify-center text-3xl md:text-4xl font-bold relative"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 100%)',
                      backdropFilter: 'blur(20px)',
                      border: '2px solid rgba(255,255,255,0.3)',
                      color: 'white',
                      boxShadow: `
                        0 25px 50px -12px rgba(0,0,0,0.5),
                        inset 0 1px 1px rgba(255,255,255,0.2),
                        0 0 80px ${primaryColor}40
                      `,
                    }}
                    animate={{
                      boxShadow: [
                        `0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.2), 0 0 60px ${primaryColor}30`,
                        `0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.2), 0 0 100px ${primaryColor}60`,
                        `0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.2), 0 0 60px ${primaryColor}30`,
                      ],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {logoText}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* STAGE 4: Typography Reveal */}
            <AnimatePresence>
              {(stage === 'typography' || stage === 'particles' || stage === 'complete') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <TypographyReveal 
                    text={resortName} 
                    delay={0}
                    className="mb-5"
                  />
                  
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2, duration: 0.6 }}
                    className="text-lg md:text-xl text-white/60 tracking-wide"
                  >
                    {tagline}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* STAGE 5: Particle Bloom */}
            {stage === 'particles' && (
              <>
                <OrbitingParticles count={60} />
                <RisingSparkles count={50} />
              </>
            )}
            
            {/* Progress bar - ALWAYS visible after stage 1 */}
            <motion.div
              className="mt-16 w-72 md:w-96 mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: stage !== 'void' ? 1 : 0, y: stage !== 'void' ? 0 : 20 }}
              transition={{ duration: 0.5 }}
            >
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full relative overflow-hidden"
                  style={{ 
                    background: `linear-gradient(90deg, ${primaryColor}, color-mix(in srgb, ${primaryColor} 80%, white))`,
                    boxShadow: `0 0 20px ${primaryColor}`,
                  }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                >
                  {/* Shimmer effect on progress bar */}
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                    }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  />
                </motion.div>
              </div>
              
              <motion.div
                className="mt-3 text-sm text-center text-white/40 font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: stage !== 'void' ? 1 : 0 }}
                transition={{ delay: 0.3 }}
              >
                {Math.round(progress)}%
              </motion.div>
            </motion.div>
          </div>
          
          {/* Bottom gradient fade */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
            style={{
              background: `linear-gradient(to top, ${primaryColor}15, transparent)`,
            }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Wrapper component for layout integration
interface LoadingScreenWrapperProps {
  children: React.ReactNode;
  minDuration?: number;
}

export function LoadingScreenWrapper({ children, minDuration = 4000 }: LoadingScreenWrapperProps) {
  return (
    <>
      <LoadingScreen minDuration={minDuration} />
      {children}
    </>
  );
}

export default LoadingScreen;
