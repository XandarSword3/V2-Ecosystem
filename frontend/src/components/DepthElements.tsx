'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ReactNode, useRef } from 'react';

interface ParallaxSectionProps {
  children: ReactNode;
  backgroundImage?: string;
  backgroundGradient?: string;
  overlayOpacity?: number;
  speed?: number;
  className?: string;
}

export default function ParallaxSection({
  children,
  backgroundImage,
  backgroundGradient = 'from-slate-900 via-slate-800 to-slate-900',
  overlayOpacity = 0.6,
  speed = 0.5,
  className = '',
}: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  
  const y = useTransform(scrollYProgress, [0, 1], ['0%', `${speed * 30}%`]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.3]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.1, 1, 1.1]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {/* Parallax Background */}
      <motion.div 
        className="absolute inset-0 z-0"
        style={{ y, scale }}
      >
        {backgroundImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${backgroundGradient}`} />
        )}
        
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />
      </motion.div>

      {/* Decorative floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-64 h-64 rounded-full"
            style={{
              background: `radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)`,
              left: `${(i * 15) % 100}%`,
              top: `${(i * 20) % 100}%`,
            }}
            animate={{
              x: [0, 30, 0],
              y: [0, -30, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <motion.div 
        className="relative z-20"
        style={{ opacity }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// Additional depth components
export function GlassCard({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string 
}) {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className={`
        relative overflow-hidden rounded-2xl
        bg-white/10 backdrop-blur-md
        border border-white/20
        shadow-[0_8px_32px_rgba(0,0,0,0.12)]
        before:absolute before:inset-0 
        before:bg-gradient-to-br before:from-white/20 before:to-transparent 
        before:pointer-events-none
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}

export function DepthCard({
  children,
  depth = 2,
  className = '',
}: {
  children: ReactNode;
  depth?: 1 | 2 | 3;
  className?: string;
}) {
  const depthStyles = {
    1: 'shadow-lg hover:shadow-xl',
    2: 'shadow-xl hover:shadow-2xl',
    3: 'shadow-2xl hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)]',
  };

  return (
    <motion.div
      whileHover={{ 
        y: -depth * 3,
        rotateX: 2,
        rotateY: -2,
      }}
      transition={{ type: 'spring', stiffness: 200 }}
      className={`
        relative rounded-2xl bg-white dark:bg-slate-800
        ${depthStyles[depth]}
        transform-gpu perspective-1000
        transition-all duration-300
        ${className}
      `}
      style={{
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Top highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      
      {children}
    </motion.div>
  );
}

export function FloatingElement({
  children,
  delay = 0,
  amplitude = 10,
  duration = 3,
}: {
  children: ReactNode;
  delay?: number;
  amplitude?: number;
  duration?: number;
}) {
  return (
    <motion.div
      animate={{
        y: [0, -amplitude, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

export function GlowEffect({
  color = 'blue',
  size = 'md',
  className = '',
}: {
  color?: 'blue' | 'orange' | 'green' | 'purple' | 'pink';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const colors = {
    blue: 'from-blue-500/30 to-cyan-500/30',
    orange: 'from-orange-500/30 to-amber-500/30',
    green: 'from-emerald-500/30 to-teal-500/30',
    purple: 'from-purple-500/30 to-pink-500/30',
    pink: 'from-pink-500/30 to-rose-500/30',
  };

  const sizes = {
    sm: 'w-32 h-32',
    md: 'w-64 h-64',
    lg: 'w-96 h-96',
  };

  return (
    <motion.div
      className={`absolute rounded-full bg-gradient-to-r ${colors[color]} ${sizes[size]} blur-3xl pointer-events-none ${className}`}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

export function TextGradient({
  children,
  from = 'from-blue-500',
  via,
  to = 'to-purple-500',
  className = '',
}: {
  children: ReactNode;
  from?: string;
  via?: string;
  to?: string;
  className?: string;
}) {
  return (
    <span
      className={`bg-gradient-to-r ${from} ${via || ''} ${to} bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  );
}
