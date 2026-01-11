'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Card3DProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  intensity?: number;
  border?: boolean;
  shadow?: boolean;
  glare?: boolean;
}

export function Card3D({
  children,
  className,
  containerClassName,
  intensity = 15,
  border = true,
  shadow = true,
  glare = true,
}: Card3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 15 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 15 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [intensity, -intensity]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-intensity, intensity]);

  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ['0%', '100%']);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ['0%', '100%']);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <div
      className={cn('perspective-1000', containerClassName)}
      style={{ perspective: '1000px' }}
    >
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        className={cn(
          'relative rounded-2xl overflow-hidden transition-shadow duration-300',
          border && 'border border-white/20 dark:border-white/10',
          shadow && isHovered && 'shadow-2xl',
          className
        )}
      >
        {/* Card content */}
        <div className="relative z-10" style={{ transform: 'translateZ(50px)' }}>
          {children}
        </div>

        {/* Glare effect */}
        {glare && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.25) 0%, transparent 50%)`,
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          />
        )}

        {/* Edge highlight */}
        {border && (
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%, transparent 50%, rgba(255,255,255,0.1) 100%)',
            }}
          />
        )}
      </motion.div>
    </div>
  );
}

// Simple tilt card without the full 3D effect
interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  tiltAmount?: number;
  intensity?: number; // Alias for tiltAmount
}

export function TiltCard({ children, className, tiltAmount = 8, intensity }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Use intensity if provided, otherwise fall back to tiltAmount
  const actualTilt = intensity ?? tiltAmount;

  const mouseX = useSpring(x, { stiffness: 200, damping: 20 });
  const mouseY = useSpring(y, { stiffness: 200, damping: 20 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [actualTilt, -actualTilt]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-actualTilt, actualTilt]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width - 0.5;
    const yPct = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className={cn('cursor-pointer', className)}
    >
      {children}
    </motion.div>
  );
}

// Floating card that hovers up on mouse enter
interface FloatingCardProps {
  children: React.ReactNode;
  className?: string;
  floatAmount?: number;
}

export function FloatingCard({ children, className, floatAmount = 8 }: FloatingCardProps) {
  return (
    <motion.div
      className={cn('cursor-pointer', className)}
      whileHover={{
        y: -floatAmount,
        scale: 1.02,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
      }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
