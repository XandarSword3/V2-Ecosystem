'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

// Gradient animated text
interface GradientTextProps {
  children: string;
  className?: string;
  animate?: boolean;
  from?: string;
  via?: string;
  to?: string;
}

export function GradientText({ 
  children, 
  className, 
  animate = true,
  from,
  via,
  to,
}: GradientTextProps) {
  // Build gradient - use custom colors if provided, otherwise use CSS variables
  const gradientStyle = from && to 
    ? {
        backgroundImage: via 
          ? `linear-gradient(90deg, ${from.replace('from-', '')} 0%, ${via.replace('via-', '')} 50%, ${to.replace('to-', '')} 100%)`
          : `linear-gradient(90deg, ${from.replace('from-', '')} 0%, ${to.replace('to-', '')} 100%)`
      }
    : {
        backgroundImage: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary), var(--color-accent), var(--color-primary))',
      };

  // Convert Tailwind class names to actual colors
  const tailwindToColor = (cls: string): string => {
    const colorMap: Record<string, string> = {
      // Cyan
      'cyan-400': '#22d3ee', 'cyan-500': '#06b6d4', 'cyan-600': '#0891b2',
      // Teal
      'teal-400': '#2dd4bf', 'teal-500': '#14b8a6', 'teal-600': '#0d9488',
      // Emerald/Green
      'emerald-400': '#34d399', 'emerald-500': '#10b981', 'emerald-600': '#059669',
      'green-400': '#4ade80', 'green-500': '#22c55e', 'green-600': '#16a34a',
      // Blue
      'blue-400': '#60a5fa', 'blue-500': '#3b82f6', 'blue-600': '#2563eb',
      // Orange/Amber
      'orange-400': '#fb923c', 'orange-500': '#f97316', 'orange-600': '#ea580c',
      'amber-400': '#fbbf24', 'amber-500': '#f59e0b', 'amber-600': '#d97706',
      // Pink/Rose
      'pink-400': '#f472b6', 'pink-500': '#ec4899', 'pink-600': '#db2777',
      'rose-400': '#fb7185', 'rose-500': '#f43f5e',
      // Slate
      'slate-600': '#475569', 'slate-700': '#334155', 'slate-800': '#1e293b',
    };
    // Strip prefix
    const color = cls.replace(/^(from-|via-|to-)/, '');
    return colorMap[color] || cls;
  };

  const computedStyle = from && to 
    ? {
        backgroundImage: via 
          ? `linear-gradient(90deg, ${tailwindToColor(from)} 0%, ${tailwindToColor(via)} 50%, ${tailwindToColor(to)} 100%)`
          : `linear-gradient(90deg, ${tailwindToColor(from)} 0%, ${tailwindToColor(to)} 100%)`
      }
    : {
        backgroundImage: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary), var(--color-accent), var(--color-primary))',
      };

  return (
    <span
      className={cn(
        'bg-clip-text text-transparent',
        animate && 'animate-gradient bg-[length:400%_100%]',
        className
      )}
      style={computedStyle}
    >
      {children}
    </span>
  );
}

// Text that reveals character by character
interface TypewriterTextProps {
  text: string;
  className?: string;
  delay?: number;
  speed?: number;
}

export function TypewriterText({
  text,
  className,
  delay = 0,
  speed = 0.05,
}: TypewriterTextProps) {
  const characters = text.split('');

  return (
    <span className={className}>
      {characters.map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.1,
            delay: delay + index * speed,
          }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}

// Staggered text animation word by word
interface StaggerTextProps {
  children: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  staggerDelay?: number;
  once?: boolean;
}

export function StaggerText({
  children,
  className,
  wordClassName,
  delay = 0,
  staggerDelay = 0.1,
  once = true,
}: StaggerTextProps) {
  const words = children.split(' ');

  const container: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: delay,
      },
    },
  };

  const wordAnimation: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        damping: 12,
        stiffness: 100,
      },
    },
  };

  return (
    <motion.span
      className={cn('inline-flex flex-wrap gap-x-[0.25em]', className)}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once }}
    >
      {words.map((word, index) => (
        <motion.span
          key={index}
          variants={wordAnimation}
          className={cn('inline-block', wordClassName)}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

// Animated heading with line reveal
interface RevealHeadingProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function RevealHeading({
  children,
  className,
  as: Component = 'h2',
}: RevealHeadingProps) {
  return (
    <div className="overflow-hidden">
      <motion.div
        initial={{ y: '100%' }}
        whileInView={{ y: 0 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <Component className={className}>{children}</Component>
      </motion.div>
    </div>
  );
}

// Blur reveal text
interface BlurRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function BlurReveal({ children, className, delay = 0 }: BlurRevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ filter: 'blur(10px)', opacity: 0 }}
      whileInView={{ filter: 'blur(0px)', opacity: 1 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.8,
        delay,
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.div>
  );
}

// Highlighted text with animated underline
interface HighlightTextProps {
  children: string;
  className?: string;
  highlightColor?: string;
}

export function HighlightText({
  children,
  className,
  highlightColor = 'var(--color-accent)',
}: HighlightTextProps) {
  return (
    <span className={cn('relative inline-block', className)}>
      {children}
      <motion.span
        className="absolute bottom-0 left-0 h-[0.15em] w-full"
        style={{ backgroundColor: highlightColor, opacity: 0.4 }}
        initial={{ scaleX: 0, transformOrigin: 'left' }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
      />
    </span>
  );
}

// Letter by letter hover effect
interface HoverLettersProps {
  children: string;
  className?: string;
}

export function HoverLetters({ children, className }: HoverLettersProps) {
  return (
    <span className={cn('inline-flex', className)}>
      {children.split('').map((char, index) => (
        <motion.span
          key={index}
          className="inline-block"
          whileHover={{
            y: -5,
            color: 'var(--color-primary)',
            transition: { duration: 0.1 },
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
}
