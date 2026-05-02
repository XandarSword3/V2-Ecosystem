'use client';

/**
 * CategoryPills - Animated category navigation for modules
 * CMS-configurable: categories, active color
 */

import { motion } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

interface Category {
  id: string | null;
  name: string;
  icon?: React.ReactNode;
  count?: number;
}

interface CategoryPillsProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
  accentColor?: string;
}

export function CategoryPills({
  categories,
  selectedId,
  onSelect,
  className = '',
  accentColor = '#6366f1',
}: CategoryPillsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Update indicator position when selection changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const selectedButton = container.querySelector(`[data-category-id="${selectedId}"]`) as HTMLElement;
    if (selectedButton) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = selectedButton.getBoundingClientRect();
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left + container.scrollLeft,
        width: buttonRect.width,
      });
    }
  }, [selectedId]);

  return (
    <div className={`relative ${className}`}>
      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="flex flex-wrap justify-center gap-2 sm:gap-3 p-1"
      >
        {categories.map((category) => {
          const isSelected = selectedId === category.id;
          const hasCount = category.count !== undefined && category.count > 0;

          return (
            <motion.button
              key={category.id ?? 'all'}
              data-category-id={category.id}
              onClick={() => onSelect(category.id)}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-medium text-sm sm:text-base
                transition-colors duration-300 z-10
                flex items-center gap-2
                ${isSelected
                  ? 'text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }
              `}
              style={{
                background: isSelected ? 'transparent' : 'rgba(255,255,255,0.5)',
                backdropFilter: isSelected ? 'none' : 'blur(8px)',
              }}
            >
              {/* Icon */}
              {category.icon && (
                <motion.span
                  animate={{
                    scale: isSelected ? 1.1 : 1,
                    rotate: isSelected ? [0, -10, 10, 0] : 0,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {category.icon}
                </motion.span>
              )}

              {/* Name */}
              <span>{category.name}</span>

              {/* Count badge */}
              {hasCount && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`
                    ml-1 px-2 py-0.5 text-xs rounded-full
                    ${isSelected ? 'bg-white/30 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}
                  `}
                >
                  {category.count}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Sliding background indicator */}
      <motion.div
        className="absolute top-1 bottom-1 rounded-full -z-0 pointer-events-none"
        animate={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          opacity: selectedId !== undefined ? 1 : 0,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
        style={{
          background: `linear-gradient(135deg, ${accentColor} 0%, color-mix(in srgb, ${accentColor} 80%, white) 100%)`,
          boxShadow: `0 4px 15px ${accentColor}50`,
        }}
      />

      {/* Ambient glow */}
      <motion.div
        className="absolute -inset-4 rounded-2xl opacity-0 -z-10"
        animate={{
          opacity: selectedId !== undefined ? 0.3 : 0,
        }}
        transition={{ duration: 0.3 }}
        style={{
          background: `radial-gradient(ellipse at center, ${accentColor}30 0%, transparent 70%)`,
          filter: 'blur(20px)',
        }}
      />
    </div>
  );
}
