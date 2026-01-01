'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { WeatherEffect as WeatherEffectType } from '@/lib/theme-config';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  delay: number;
}

function generateParticles(count: number, type: WeatherEffectType): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: type === 'rain' ? 2 + Math.random() * 2 : type === 'snow' ? 3 + Math.random() * 5 : 20 + Math.random() * 40,
    speed: type === 'rain' ? 1 + Math.random() * 0.5 : type === 'snow' ? 0.5 + Math.random() * 0.5 : 0.1 + Math.random() * 0.1,
    opacity: type === 'rain' ? 0.3 + Math.random() * 0.3 : type === 'snow' ? 0.4 + Math.random() * 0.4 : 0.3 + Math.random() * 0.3,
    delay: Math.random() * 5,
  }));
}

function RainEffect() {
  const particles = generateParticles(100, 'rain');
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((drop) => (
        <motion.div
          key={drop.id}
          className="absolute bg-blue-400/40"
          style={{
            left: `${drop.x}%`,
            width: `${drop.size}px`,
            height: `${drop.size * 8}px`,
            borderRadius: '50%',
          }}
          initial={{ y: '-10%', opacity: 0 }}
          animate={{
            y: '110vh',
            opacity: [0, drop.opacity, drop.opacity, 0],
          }}
          transition={{
            duration: 1 / drop.speed,
            repeat: Infinity,
            delay: drop.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

function SnowEffect() {
  const particles = generateParticles(60, 'snow');
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((flake) => (
        <motion.div
          key={flake.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${flake.x}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            boxShadow: '0 0 10px rgba(255,255,255,0.8)',
          }}
          initial={{ y: '-5%', x: 0, opacity: 0 }}
          animate={{
            y: '105vh',
            x: [0, 20, -20, 10, -10, 0],
            opacity: [0, flake.opacity, flake.opacity, 0],
            rotate: 360,
          }}
          transition={{
            duration: 8 / flake.speed,
            repeat: Infinity,
            delay: flake.delay,
            ease: 'linear',
            x: {
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
        />
      ))}
    </div>
  );
}

function CloudsEffect() {
  const clouds = generateParticles(8, 'clouds');
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {clouds.map((cloud) => (
        <motion.div
          key={cloud.id}
          className="absolute"
          style={{
            top: `${10 + cloud.y * 0.3}%`,
            width: `${cloud.size * 4}px`,
            height: `${cloud.size * 2}px`,
          }}
          initial={{ x: '-20%', opacity: 0 }}
          animate={{
            x: '120vw',
            opacity: [0, cloud.opacity, cloud.opacity, 0],
          }}
          transition={{
            duration: 40 / cloud.speed,
            repeat: Infinity,
            delay: cloud.delay * 4,
            ease: 'linear',
          }}
        >
          {/* Cloud shape using multiple circles */}
          <div className="relative w-full h-full">
            <div className="absolute bg-white/70 rounded-full w-1/2 h-full left-1/4 bottom-0 blur-sm" />
            <div className="absolute bg-white/60 rounded-full w-1/3 h-3/4 left-0 bottom-0 blur-sm" />
            <div className="absolute bg-white/60 rounded-full w-1/3 h-3/4 right-0 bottom-0 blur-sm" />
            <div className="absolute bg-white/50 rounded-full w-1/4 h-1/2 left-1/6 bottom-1/3 blur-sm" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function SunnyEffect() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Sun rays */}
      <motion.div
        className="absolute -top-20 -right-20 w-96 h-96"
        animate={{
          rotate: 360,
          scale: [1, 1.05, 1],
        }}
        transition={{
          rotate: { duration: 60, repeat: Infinity, ease: 'linear' },
          scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 w-2 h-40 bg-gradient-to-b from-yellow-300/30 to-transparent"
            style={{
              transform: `translateX(-50%) rotate(${i * 30}deg)`,
              transformOrigin: 'center top',
            }}
            animate={{
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </motion.div>
      
      {/* Floating sparkles - using deterministic positions */}
      {[
        { left: 15, top: 20 },
        { left: 35, top: 45 },
        { left: 55, top: 15 },
        { left: 25, top: 55 },
        { left: 70, top: 30 },
        { left: 85, top: 50 },
        { left: 45, top: 25 },
        { left: 60, top: 60 },
        { left: 30, top: 35 },
        { left: 75, top: 18 },
        { left: 20, top: 42 },
        { left: 50, top: 55 },
        { left: 40, top: 12 },
        { left: 65, top: 48 },
        { left: 80, top: 22 },
      ].map((pos, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-yellow-300 rounded-full"
          style={{
            left: `${pos.left}%`,
            top: `${pos.top}%`,
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1.5, 0.5],
          }}
          transition={{
            duration: 2 + (i % 3) * 0.7,
            repeat: Infinity,
            delay: (i % 5) * 0.6,
          }}
        />
      ))}
    </div>
  );
}

export function WeatherEffects() {
  const weatherEffect = useSettingsStore((s) => s.weatherEffect);
  const animationsEnabled = useSettingsStore((s) => s.animationsEnabled);
  
  if (!animationsEnabled || weatherEffect === 'none') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1] pointer-events-none">
      <AnimatePresence mode="wait">
        {weatherEffect === 'rain' && (
          <motion.div
            key="rain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <RainEffect />
          </motion.div>
        )}
        {weatherEffect === 'snow' && (
          <motion.div
            key="snow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <SnowEffect />
          </motion.div>
        )}
        {weatherEffect === 'clouds' && (
          <motion.div
            key="clouds"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <CloudsEffect />
          </motion.div>
        )}
        {weatherEffect === 'sunny' && (
          <motion.div
            key="sunny"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <SunnyEffect />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
