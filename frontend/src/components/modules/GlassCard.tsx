'use client';

/**
 * GlassCard - Glassmorphic card with hover effects and animations
 * CMS-configurable: accent color, variant (featured/standard)
 */

import { motion } from 'framer-motion';
import { useState } from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  isFeatured?: boolean;
  accentColor?: string;
  onClick?: () => void;
  imageUrl?: string;
  hoverScale?: number;
}

export function GlassCard({
  children,
  className = '',
  isFeatured = false,
  accentColor = '#6366f1',
  onClick,
  imageUrl,
  hoverScale = 1.02,
}: GlassCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -8, scale: hoverScale }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative rounded-2xl overflow-hidden cursor-pointer
        ${className}
      `}
      style={{
        background: isFeatured
          ? 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.5) 100%)',
        backdropFilter: 'blur(20px)',
        border: isFeatured
          ? `2px solid ${accentColor}40`
          : '1px solid rgba(255,255,255,0.5)',
        boxShadow: isHovered
          ? `0 25px 50px -12px rgba(0,0,0,0.25), 0 0 30px ${accentColor}20`
          : '0 10px 30px -10px rgba(0,0,0,0.15)',
      }}
    >
      {/* Featured ribbon */}
      {isFeatured && (
        <motion.div
          className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1"
          style={{
            background: `linear-gradient(135deg, ${accentColor} 0%, color-mix(in srgb, ${accentColor} 80%, white) 100%)`,
            boxShadow: `0 4px 15px ${accentColor}50`,
          }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          Featured
        </motion.div>
      )}

      {/* Image section */}
      {imageUrl && (
        <div className="relative h-48 overflow-hidden">
          <motion.img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            animate={{
              scale: isHovered ? 1.1 : 1,
            }}
            transition={{ duration: 0.5 }}
          />
          {/* Gradient overlay */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent"
            style={{ backdropFilter: isHovered ? 'blur(2px)' : 'none' }}
          />
        </div>
      )}

      {/* Glow effect on hover */}
      <motion.div
        className="absolute inset-0 opacity-0 pointer-events-none"
        animate={{ opacity: isHovered ? 0.5 : 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${accentColor}15, transparent 40%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-6">
        {children}
      </div>

      {/* Bottom shine line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl"
        animate={{
          opacity: isHovered ? 1 : 0.5,
        }}
        style={{
          background: isFeatured
            ? `linear-gradient(90deg, transparent, ${accentColor}60, transparent)`
            : 'transparent',
        }}
      />
    </motion.div>
  );
}
