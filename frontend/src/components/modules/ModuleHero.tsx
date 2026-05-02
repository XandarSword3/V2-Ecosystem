'use client';

/**
 * ModuleHero - Reusable hero section for all module types
 * CMS-configurable: colors, badge text, animations
 */

import { motion } from 'framer-motion';
import { Sparkles, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ModuleHeroProps {
  title: string;
  description?: string;
  headerColor: string;
  accentColor: string;
  badgeText?: string;
  children?: React.ReactNode;
  showScrollIndicator?: boolean;
}

export function ModuleHero({
  title,
  description,
  headerColor,
  accentColor,
  badgeText,
  children,
  showScrollIndicator = true,
}: ModuleHeroProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      setMousePosition({
        x: (clientX / innerWidth - 0.5) * 20,
        y: (clientY / innerHeight - 0.5) * 20,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="relative min-h-[45vh] overflow-hidden">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${headerColor} 0%, ${accentColor} 50%, ${headerColor} 100%)`,
          backgroundSize: '400% 400%',
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Aurora overlay effect */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 30% 40%, rgba(255,255,255,0.3) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 70% 60%, rgba(255,255,255,0.2) 0%, transparent 50%)
          `,
          filter: 'blur(40px)',
        }}
      />

      {/* Parallax floating orbs */}
      <motion.div
        className="absolute w-64 h-64 rounded-full opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
          left: '10%',
          top: '20%',
          x: mousePosition.x * 2,
          y: mousePosition.y * 2,
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute w-48 h-48 rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
          right: '15%',
          bottom: '30%',
          x: -mousePosition.x * 1.5,
          y: -mousePosition.y * 1.5,
        }}
        animate={{
          scale: [1.2, 1, 1.2],
        }}
        transition={{ duration: 6, repeat: Infinity }}
      />

      {/* Glassmorphism noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-24 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Glassmorphic badge */}
          {badgeText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              }}
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </motion.div>
              <span className="text-white/90 text-sm font-medium">{badgeText}</span>
            </motion.div>
          )}

          {/* Title with letter animation */}
          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4"
            style={{
              textShadow: '0 4px 30px rgba(0,0,0,0.3)',
            }}
          >
            {title.split('').map((letter, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.03, duration: 0.4 }}
                className="inline-block"
              >
                {letter === ' ' ? '\u00A0' : letter}
              </motion.span>
            ))}
          </motion.h1>

          {/* Description */}
          {description && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-lg text-white/80 max-w-2xl mx-auto"
            >
              {description}
            </motion.p>
          )}

          {children}
        </motion.div>

        {/* Scroll indicator */}
        {showScrollIndicator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="text-white/60"
            >
              <ChevronDown className="w-6 h-6" />
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Bottom fade to content */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-50 dark:from-slate-900 to-transparent"
      />
    </div>
  );
}
