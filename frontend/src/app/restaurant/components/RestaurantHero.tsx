'use client';

import { motion } from 'framer-motion';
import { Sparkles, UtensilsCrossed, ChefHat, Star } from 'lucide-react';
import { AnimatedCounter } from '@/components/effects/AnimatedCounter';

export interface RestaurantHeroProps {
  restaurantName?: string;
  menuItemCount: number;
  categoryCount: number;
  t: (key: string) => string;
}

export function RestaurantHero({ restaurantName, menuItemCount, categoryCount, t }: RestaurantHeroProps) {
  return (
    <div className="relative overflow-hidden pt-24 pb-32">
      {/* Aurora gradient background */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 50%, var(--color-accent) 100%)',
            opacity: 0.9,
          }}
        />
        {/* Animated blobs */}
        <motion.div
          className="absolute -top-1/4 -left-1/4 w-[60%] h-[60%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-1/4 -right-1/4 w-[50%] h-[50%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.1, 1], x: [0, -30, 0], y: [0, -40, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Floating food emojis */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[
          { emoji: '🍽️', x: 5, y: 15, duration: 22 },
          { emoji: '🍷', x: 85, y: 25, duration: 18 },
          { emoji: '🥗', x: 25, y: 70, duration: 25 },
          { emoji: '🍝', x: 70, y: 10, duration: 20 },
          { emoji: '🥩', x: 50, y: 80, duration: 28 },
          { emoji: '🍰', x: 15, y: 45, duration: 24 },
        ].map((item, i) => (
          <motion.div
            key={i}
            className="absolute text-5xl opacity-20"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            animate={{
              y: [0, -30, 0, 30, 0],
              x: [0, 15, 0, -15, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: item.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {item.emoji}
          </motion.div>
        ))}
      </div>

      {/* Wave bottom border */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" className="w-full h-auto">
          <path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H0Z"
            className="fill-white dark:fill-slate-950"
          />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-xl rounded-full px-6 py-3 mb-8 border border-white/30">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="text-white font-medium">{t('authenticLebanese')}</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-lg">
            {restaurantName || t('menu')}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-12">
            {t('menuSubtitle')}
          </p>

          {/* Stats Cards */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            {[
              { value: menuItemCount, suffix: '+', label: t('dishes'), icon: <UtensilsCrossed className="w-5 h-5" /> },
              { value: categoryCount, label: t('categories'), icon: <ChefHat className="w-5 h-5" /> },
              { value: 4.9, label: t('rating'), icon: <Star className="w-5 h-5 fill-current" /> },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                whileHover={{ y: -4, scale: 1.05 }}
                className="bg-white/20 backdrop-blur-xl rounded-2xl px-8 py-4 border border-white/30 text-white"
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  {stat.icon}
                  <span className="text-3xl font-bold">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} duration={2} />
                  </span>
                </div>
                <div className="text-sm text-white/80">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
