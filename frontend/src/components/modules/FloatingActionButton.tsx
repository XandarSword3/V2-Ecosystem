'use client';

/**
 * FloatingActionButton - Sticky floating button for cart/actions
 * CMS-configurable: position, accent color, icon, count badge
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ArrowUp, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';

interface FloatingActionButtonProps {
  count?: number;
  onClick: () => void;
  accentColor?: string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  label?: string;
  showOnScroll?: boolean;
}

export function FloatingActionButton({
  count = 0,
  onClick,
  accentColor = '#6366f1',
  position = 'bottom-right',
  label,
  showOnScroll = false,
}: FloatingActionButtonProps) {
  const [isVisible, setIsVisible] = useState(!showOnScroll);
  const [isPulsing, setIsPulsing] = useState(false);

  // Track scroll for visibility
  useEffect(() => {
    if (!showOnScroll) return;

    const handleScroll = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showOnScroll]);

  // Pulse animation when count increases
  useEffect(() => {
    if (count > 0) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 500);
      return () => clearTimeout(timer);
    }
  }, [count]);

  const positionClasses = {
    'bottom-right': 'right-4 sm:right-6 lg:right-8',
    'bottom-left': 'left-4 sm:left-6 lg:left-8',
    'bottom-center': 'left-1/2 -translate-x-1/2',
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          className={`fixed bottom-4 sm:bottom-6 lg:bottom-8 ${positionClasses[position]} z-50`}
        >
          <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              boxShadow: isPulsing
                ? [`0 0 0 0 ${accentColor}40`, `0 0 0 20px ${accentColor}00`]
                : `0 10px 40px -10px ${accentColor}60`,
            }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 px-6 py-4 rounded-full text-white font-semibold shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${accentColor} 0%, color-mix(in srgb, ${accentColor} 85%, white) 100%)`,
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.3)',
            }}
          >
            {/* Icon with bounce */}
            <motion.div
              animate={isPulsing ? { y: [0, -4, 0] } : {}}
              transition={{ duration: 0.3 }}
            >
              <ShoppingCart className="w-5 h-5" />
            </motion.div>

            {/* Label */}
            {label && <span className="hidden sm:inline">{label}</span>}

            {/* Count badge */}
            <AnimatePresence mode="popLayout">
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="flex items-center justify-center min-w-[24px] h-6 px-2 bg-white text-slate-900 rounded-full text-sm font-bold shadow-lg"
                >
                  {count > 99 ? '99+' : count}
                </motion.span>
              )}
            </AnimatePresence>

            {/* Arrow indicator */}
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
            >
              <ArrowUp className="w-4 h-4 opacity-70" />
            </motion.div>
          </motion.button>

          {/* Glow effect */}
          <motion.div
            className="absolute inset-0 -z-10 rounded-full blur-xl opacity-50"
            style={{
              background: accentColor,
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
