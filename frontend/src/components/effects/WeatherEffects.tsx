'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSiteSettings } from '@/lib/settings-context';
import { resortThemes, ResortTheme } from '@/lib/theme-config';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

// Generate random particles
function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 0.5 + 0.5,
    duration: Math.random() * 10 + 10,
    delay: Math.random() * 5,
    opacity: Math.random() * 0.5 + 0.3,
  }));
}

// Snow Effect Component
function SnowEffect() {
  const particles = useMemo(() => generateParticles(50), []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${p.x}%`,
            width: `${4 + p.size * 6}px`,
            height: `${4 + p.size * 6}px`,
            opacity: p.opacity,
            filter: 'blur(0.5px)',
          }}
          initial={{ y: '-10%', x: 0 }}
          animate={{
            y: '110vh',
            x: [0, 30, -20, 40, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
            x: {
              duration: p.duration / 2,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
        />
      ))}
    </div>
  );
}

// Rain Effect Component
function RainEffect() {
  const particles = useMemo(() => generateParticles(80), []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute bg-gradient-to-b from-primary-300/60 to-transparent"
          style={{
            left: `${p.x}%`,
            width: '2px',
            height: `${15 + p.size * 25}px`,
            opacity: p.opacity * 0.6,
          }}
          initial={{ y: '-5%' }}
          animate={{ y: '105vh' }}
          transition={{
            duration: p.duration * 0.3,
            delay: p.delay * 0.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

// Leaves Effect Component
function LeavesEffect() {
  const particles = useMemo(() => generateParticles(25), []);
  const leafColors = ['#22c55e', '#16a34a', '#84cc16', '#eab308', '#f97316'];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {particles.map((p, i) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            fontSize: `${16 + p.size * 16}px`,
            opacity: p.opacity * 0.7,
            color: leafColors[i % leafColors.length],
          }}
          initial={{ y: '-10%', rotate: 0, x: 0 }}
          animate={{
            y: '110vh',
            rotate: [0, 180, 360, 540, 720],
            x: [0, 80, -60, 100, 0],
          }}
          transition={{
            duration: p.duration * 1.5,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
            rotate: {
              duration: p.duration,
              repeat: Infinity,
              ease: 'linear',
            },
            x: {
              duration: p.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
        >
          🍂
        </motion.div>
      ))}
    </div>
  );
}

// Stars Effect Component (Twinkling stars for midnight theme)
function StarsEffect() {
  const particles = useMemo(() => generateParticles(100), []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${2 + p.size * 4}px`,
            height: `${2 + p.size * 4}px`,
            background: p.size > 0.8 ? 'white' : 'rgba(255, 255, 255, 0.8)',
            boxShadow: p.size > 0.8 
              ? '0 0 10px 2px rgba(255, 255, 255, 0.5)' 
              : '0 0 4px 1px rgba(255, 255, 255, 0.3)',
          }}
          animate={{
            opacity: [p.opacity * 0.3, p.opacity, p.opacity * 0.3],
            scale: [1, p.size > 0.8 ? 1.3 : 1.1, 1],
          }}
          transition={{
            duration: p.duration * 0.3,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
      {/* Shooting stars */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={`shooting-${i}`}
          className="absolute w-1 h-1 rounded-full bg-white"
          style={{
            boxShadow: '0 0 10px 2px rgba(255, 255, 255, 0.8), -20px 0 15px 1px rgba(255, 255, 255, 0.3)',
          }}
          initial={{ x: '0%', y: '0%', opacity: 0 }}
          animate={{
            x: ['10%', '90%'],
            y: ['5%', '40%'],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.5,
            delay: i * 8,
            repeat: Infinity,
            ease: 'easeOut',
            repeatDelay: 20,
          }}
        />
      ))}
    </div>
  );
}

// Fireflies Effect Component
function FirefliesEffect() {
  const particles = useMemo(() => generateParticles(30), []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${4 + p.size * 6}px`,
            height: `${4 + p.size * 6}px`,
            background: 'radial-gradient(circle, #fde047 0%, #facc15 50%, transparent 70%)',
            boxShadow: '0 0 15px 5px rgba(250, 204, 21, 0.4)',
          }}
          animate={{
            opacity: [0, p.opacity, 0],
            scale: [0.5, 1, 0.5],
            x: [0, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 50, 0],
            y: [0, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 40, 0],
          }}
          transition={{
            duration: p.duration * 0.8,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Waves Effect Component (Animated wave patterns)
function WavesEffect() {
  return (
    <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-[1] h-32 overflow-hidden text-primary-500">
      {/* Wave 1 */}
      <motion.svg
        className="absolute bottom-0 w-[200%]"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        style={{ height: '80px' }}
        animate={{ x: [0, '-50%'] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      >
        <path
          d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z"
          fill="currentColor"
          fillOpacity={0.15}
        />
      </motion.svg>
      {/* Wave 2 */}
      <motion.svg
        className="absolute bottom-0 w-[200%]"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        style={{ height: '60px' }}
        animate={{ x: ['-50%', 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      >
        <path
          d="M0,40 C360,100 720,0 1080,40 C1260,70 1350,70 1440,40 L1440,120 L0,120 Z"
          fill="currentColor"
          fillOpacity={0.2}
        />
      </motion.svg>
      {/* Wave 3 - Foam */}
      <motion.svg
        className="absolute bottom-0 w-[200%]"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        style={{ height: '40px' }}
        animate={{ x: [0, '-50%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      >
        <path
          d="M0,80 C180,100 360,60 540,80 C720,100 900,60 1080,80 C1260,100 1350,60 1440,80 L1440,120 L0,120 Z"
          fill="rgba(255, 255, 255, 0.3)"
        />
      </motion.svg>
    </div>
  );
}

// Main Weather Effects Component
export function WeatherEffects() {
  const { settings } = useSiteSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render on server
  if (!mounted) return null;

  // Check if weather effects are disabled in settings
  if (settings.showWeatherWidget === false) return null;

  // Get weather effect - prioritize CMS setting, then fall back to theme default
  const cmsEffect = settings.weatherEffect as string;
  const currentTheme = settings.theme as ResortTheme || 'beach';
  const theme = resortThemes[currentTheme] || resortThemes.beach;
  
  // Determine which effect to use
  let effect: string;
  if (cmsEffect === 'none') {
    // User explicitly disabled weather effects
    return null;
  } else if (cmsEffect && cmsEffect !== 'auto') {
    // User selected a specific effect in CMS
    effect = cmsEffect;
  } else {
    // Auto mode - use theme's default effect
    effect = theme.weatherEffect || 'none';
  }

  if (effect === 'none') return null;

  return (
    <AnimatePresence mode="wait">
      {effect === 'snow' && <SnowEffect key="snow" />}
      {effect === 'rain' && <RainEffect key="rain" />}
      {effect === 'leaves' && <LeavesEffect key="leaves" />}
      {effect === 'stars' && <StarsEffect key="stars" />}
      {effect === 'fireflies' && <FirefliesEffect key="fireflies" />}
      {effect === 'waves' && <WavesEffect key="waves" />}
    </AnimatePresence>
  );
}

export default WeatherEffects;
