'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, ReactNode } from 'react';

interface ParallaxHeroProps {
  children: ReactNode;
  gradient?: string;
  overlayOpacity?: number;
  height?: string;
  decorations?: boolean;
}

export default function ParallaxHero({
  children,
  gradient = 'from-blue-600 via-purple-600 to-indigo-700',
  overlayOpacity = 0.4,
  height = 'min-h-[70vh]',
  decorations = true,
}: ParallaxHeroProps) {
  const ref = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${height}`}>
      {/* Parallax Background */}
      <motion.div 
        className={`absolute inset-0 bg-gradient-to-br ${gradient}`}
        style={{ y, scale }}
      />

      {/* Overlay for depth */}
      <div 
        className="absolute inset-0 bg-black/20"
        style={{ opacity: overlayOpacity }}
      />

      {/* Mesh gradient overlay for depth */}
      <div className="absolute inset-0 opacity-50">
        <svg className="w-full h-full">
          <defs>
            <radialGradient id="meshGradient1" cx="20%" cy="30%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <radialGradient id="meshGradient2" cx="80%" cy="70%" r="40%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#meshGradient1)" />
          <rect width="100%" height="100%" fill="url(#meshGradient2)" />
        </svg>
      </div>

      {/* Decorative floating elements */}
      {decorations && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large blurred circles for depth */}
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full bg-white/10 blur-3xl"
            style={{ left: '-10%', top: '-20%' }}
            animate={{
              x: [0, 50, 0],
              y: [0, 30, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full bg-white/5 blur-2xl"
            style={{ right: '-5%', bottom: '10%' }}
            animate={{
              x: [0, -30, 0],
              y: [0, -40, 0],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 2,
            }}
          />

          {/* Small floating particles */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white/30 rounded-full"
              style={{
                left: `${8 + i * 8}%`,
                top: `${20 + Math.sin(i) * 30}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.6, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.3,
              }}
            />
          ))}
        </div>
      )}

      {/* Wave decoration at bottom */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" preserveAspectRatio="none" className="w-full h-auto">
          <motion.path
            d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z"
            className="fill-white dark:fill-slate-900"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
          <motion.path
            d="M0,80 C360,120 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z"
            className="fill-white/50 dark:fill-slate-900/50"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.5 }}
            transition={{ duration: 1.8, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
      </div>

      {/* Content */}
      <motion.div 
        className="relative z-10 h-full"
        style={{ opacity }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// Layered shadow card for 3D depth effect
export function LayeredCard({
  children,
  className = '',
  layers = 3,
  color = 'slate',
}: {
  children: ReactNode;
  className?: string;
  layers?: number;
  color?: 'slate' | 'blue' | 'green' | 'orange';
}) {
  const colorClasses = {
    slate: 'from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800',
    blue: 'from-blue-200 to-blue-300 dark:from-blue-900 dark:to-blue-800',
    green: 'from-emerald-200 to-emerald-300 dark:from-emerald-900 dark:to-emerald-800',
    orange: 'from-orange-200 to-orange-300 dark:from-orange-900 dark:to-orange-800',
  };

  return (
    <motion.div 
      className="relative"
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      {/* Back layers for depth */}
      {[...Array(layers)].map((_, i) => (
        <div
          key={i}
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${colorClasses[color]} opacity-${30 - i * 10}`}
          style={{
            transform: `translateY(${(i + 1) * 4}px) scale(${1 - (i + 1) * 0.02})`,
            zIndex: -i - 1,
          }}
        />
      ))}
      
      {/* Main card */}
      <div className={`relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl ${className}`}>
        {children}
      </div>
    </motion.div>
  );
}

// Neumorphic button style
export function NeumorphicButton({
  children,
  onClick,
  className = '',
  variant = 'primary',
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
}) {
  const variants = {
    primary: 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-[0_10px_40px_rgba(59,130,246,0.4)]',
    secondary: 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-[0_10px_40px_rgba(0,0,0,0.1)]',
  };

  return (
    <motion.button
      onClick={onClick}
      className={`
        relative px-8 py-4 rounded-2xl font-semibold
        ${variants[variant]}
        transition-all duration-300
        ${className}
      `}
      whileHover={{ 
        scale: 1.05,
        boxShadow: variant === 'primary' 
          ? '0 20px 60px rgba(59,130,246,0.5)' 
          : '0 20px 60px rgba(0,0,0,0.2)',
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Shine effect */}
      <motion.div
        className="absolute inset-0 rounded-2xl overflow-hidden"
        initial={false}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 0.5 }}
        />
      </motion.div>
      
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}

// Glassmorphism container
export function GlassContainer({
  children,
  className = '',
  blur = 'md',
}: {
  children: ReactNode;
  className?: string;
  blur?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const blurClasses = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl',
  };

  return (
    <div className={`
      relative overflow-hidden rounded-2xl
      bg-white/10 dark:bg-white/5
      ${blurClasses[blur]}
      border border-white/20 dark:border-white/10
      shadow-[0_8px_32px_rgba(0,0,0,0.12)]
      ${className}
    `}>
      {/* Top highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// Gradient text with animation
export function AnimatedGradientText({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.span
      className={`
        bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500
        bg-[length:200%_auto]
        bg-clip-text text-transparent
        ${className}
      `}
      animate={{
        backgroundPosition: ['0% center', '200% center'],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {children}
    </motion.span>
  );
}
