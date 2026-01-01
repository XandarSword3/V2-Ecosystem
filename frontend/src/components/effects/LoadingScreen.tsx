'use client';

/**
 * Grand Loading Screen
 * 
 * A luxurious loading animation that plays on initial app load.
 * Features the V2 Resort branding with elegant animations.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/lib/stores/settingsStore';

interface LoadingScreenProps {
  minDuration?: number; // Minimum time to show loading screen
}

export function LoadingScreen({ minDuration = 2000 }: LoadingScreenProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const enableLoadingAnimation = useSettingsStore((s) => s.enableLoadingAnimation);

  useEffect(() => {
    // Skip if animation is disabled
    if (!enableLoadingAnimation) {
      setIsLoading(false);
      return;
    }

    // Check if this is the first visit
    const hasVisited = sessionStorage.getItem('v2resort_visited');
    if (hasVisited) {
      setIsLoading(false);
      return;
    }

    // Animate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    // Set visited flag and hide loading after minimum duration
    const timer = setTimeout(() => {
      setIsLoading(false);
      sessionStorage.setItem('v2resort_visited', 'true');
    }, minDuration);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [minDuration, enableLoadingAnimation]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        >
          {/* Background decorations */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Floating circles */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-white/5"
                style={{
                  width: 100 + i * 50,
                  height: 100 + i * 50,
                  left: `${10 + i * 10}%`,
                  top: `${20 + i * 8}%`,
                }}
                animate={{
                  y: [-20, 20, -20],
                  x: [-10, 10, -10],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 4 + i,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.2,
                }}
              />
            ))}
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </div>

          {/* Main content */}
          <div className="relative z-10 text-center">
            {/* Logo animation */}
            <motion.div
              className="mb-8"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                duration: 1,
                type: 'spring',
                stiffness: 100,
                damping: 15,
              }}
            >
              <div className="relative inline-block">
                {/* Glow effect */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-white blur-3xl"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ transform: 'scale(1.5)' }}
                />
                
                {/* Logo */}
                <motion.div
                  className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/40 flex items-center justify-center"
                  animate={{ 
                    boxShadow: [
                      '0 0 20px rgba(255,255,255,0.3)',
                      '0 0 60px rgba(255,255,255,0.5)',
                      '0 0 20px rgba(255,255,255,0.3)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="text-5xl md:text-6xl font-bold text-white tracking-tight">V2</span>
                </motion.div>
              </div>
            </motion.div>

            {/* Text animations */}
            <motion.h1
              className="text-4xl md:text-5xl font-bold text-white mb-2"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              V2 Resort
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-white/80 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              Experience Luxury
            </motion.p>

            {/* Progress bar */}
            <motion.div
              className="w-64 md:w-80 mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-white via-white to-white/60 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <motion.p
                className="text-white/60 text-sm mt-3"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Loading experience...
              </motion.p>
            </motion.div>
          </div>

          {/* Bottom wave decoration */}
          <motion.div
            className="absolute bottom-0 left-0 right-0"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <svg
              className="w-full h-24 fill-white/10"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
            >
              <motion.path
                d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,30 1440,60 L1440,120 L0,120 Z"
                animate={{
                  d: [
                    "M0,60 C360,120 720,0 1080,60 C1260,90 1380,30 1440,60 L1440,120 L0,120 Z",
                    "M0,90 C360,30 720,120 1080,60 C1260,30 1380,90 1440,60 L1440,120 L0,120 Z",
                    "M0,60 C360,120 720,0 1080,60 C1260,90 1380,30 1440,60 L1440,120 L0,120 Z",
                  ],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Smaller loading indicator for page-level loading
 */
export function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <motion.div
        className="flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <motion.p
          className="mt-4 text-slate-600 dark:text-slate-400"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Loading...
        </motion.p>
      </motion.div>
    </div>
  );
}

export default LoadingScreen;
