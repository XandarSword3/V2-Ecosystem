'use client';

import { motion } from 'framer-motion';
import { Loader2, ChefHat, AlertCircle, UtensilsCrossed } from 'lucide-react';
import { FloatingCard } from '@/components/effects/Card3D';
import { GradientText } from '@/components/effects/TextEffects';

const bgClass =
  'min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900';

interface TranslationFn {
  (key: string, values?: Record<string, string | number>): string;
}

export function RestaurantLoading({ t }: { t: TranslationFn }) {
  return (
    <div className={bgClass}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="relative">
          <Loader2 className="w-12 h-12 animate-spin text-orange-600 mx-auto mb-4" />
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <ChefHat className="w-6 h-6 text-orange-400 opacity-50" />
          </motion.div>
        </div>
        <p className="text-slate-600 dark:text-slate-400 font-medium">{t('loadingMenu')}</p>
      </motion.div>
    </div>
  );
}

export function RestaurantError({ tCommon }: { tCommon: TranslationFn }) {
  return (
    <div className={bgClass}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl"
      >
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{tCommon('error')}</h2>
        <p className="text-slate-600 dark:text-slate-400">{tCommon('tryAgainLater')}</p>
      </motion.div>
    </div>
  );
}

export function RestaurantEmptyState({ t, tCommon }: { t: TranslationFn; tCommon: TranslationFn }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-20"
    >
      <FloatingCard className="max-w-md mx-auto">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/30 dark:border-slate-700/50">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <UtensilsCrossed className="w-20 h-20 text-orange-400 mx-auto mb-6 drop-shadow-lg" />
          </motion.div>
          <GradientText
            from="from-orange-500"
            via="via-red-500"
            to="to-amber-500"
            className="text-2xl font-bold mb-3 block"
          >
            {tCommon('noItemsFound')}
          </GradientText>
          <p className="text-slate-600 dark:text-slate-400">{t('tryDifferentCategory')}</p>
        </div>
      </FloatingCard>
    </motion.div>
  );
}
