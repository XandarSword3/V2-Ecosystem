'use client';

/**
 * GlassSearch - Glassmorphic search input for modules
 * CMS-configurable: placeholder, accent color
 */

import { motion } from 'framer-motion';
import { Search, X, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface GlassSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function GlassSearch({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}: GlassSearchProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      className={`relative max-w-md mx-auto ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      {/* Animated glow background */}
      <motion.div
        className="absolute -inset-1 rounded-full opacity-0"
        animate={{
          opacity: isFocused ? 1 : 0,
          scale: isFocused ? 1.02 : 1,
        }}
        transition={{ duration: 0.2 }}
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(139,92,246,0.2) 100%)',
          filter: 'blur(8px)',
        }}
      />

      {/* Main input container */}
      <div
        className="relative flex items-center rounded-full overflow-hidden transition-all duration-300"
        style={{
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${isFocused ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.4)'}`,
          boxShadow: isFocused
            ? '0 8px 32px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.6)'
            : '0 4px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        {/* Search icon with animation */}
        <motion.div
          className="absolute left-4 text-slate-400"
          animate={{
            scale: isFocused ? 1.1 : 1,
            color: isFocused ? '#6366f1' : '#94a3b8',
          }}
          transition={{ duration: 0.2 }}
        >
          <Search className="w-5 h-5" />
        </motion.div>

        {/* Input */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="w-full pl-12 pr-10 py-3.5 bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
        />

        {/* Clear button */}
        <AnimatePresence>
          {value && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onChange('')}
              className="absolute right-3 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Sparkle decoration */}
      <motion.div
        className="absolute -right-2 -top-2 text-primary-400"
        animate={{
          scale: isFocused ? [1, 1.2, 1] : 1,
          rotate: isFocused ? [0, 15, -15, 0] : 0,
        }}
        transition={{ duration: 0.5 }}
      >
        <Sparkles className="w-4 h-4" />
      </motion.div>
    </motion.div>
  );
}

import { AnimatePresence } from 'framer-motion';
