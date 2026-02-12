'use client';

import { motion } from 'framer-motion';
import { Star, Plus } from 'lucide-react';
import { TiltCard } from '@/components/effects/Card3D';
import { GradientText, RevealHeading } from '@/components/effects/TextEffects';
import { Flame } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Currency } from '@/lib/stores/settingsStore';
import { MenuItem, getCategoryIcon } from './types';

export interface FeaturedDishesProps {
  items: MenuItem[];
  currency: Currency | string;

  showFeaturedOnly: boolean;
  onToggleFeatured: () => void;
  onItemClick: (item: MenuItem) => void;
  translateContent: (item: any, field: string) => string;
  t: (key: string) => string;
}

export function FeaturedDishes({
  items,
  currency,
  showFeaturedOnly,
  onToggleFeatured,
  onItemClick,
  translateContent,
  t,
}: FeaturedDishesProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-12"
    >
      <div className="flex items-center justify-between mb-8">
        <RevealHeading className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" />
          <GradientText from="from-orange-500" via="via-red-500" to="to-amber-500">
            {t('featuredDishes')}
          </GradientText>
        </RevealHeading>
        <motion.button
          onClick={onToggleFeatured}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`text-sm font-medium px-5 py-2.5 rounded-full transition-all backdrop-blur-md ${
            showFeaturedOnly
              ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
              : 'bg-white/80 dark:bg-slate-800/80 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-700 border border-orange-200/50 dark:border-slate-600/50'
          }`}
        >
          {showFeaturedOnly ? t('showAll') : t('viewFeatured')}
        </motion.button>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {items.map((item, index) => (
          <TiltCard key={item.id} intensity={8} className="h-full">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
              className="relative group h-full"
            >
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-red-500 to-amber-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-60 transition-opacity duration-500" />

              <div className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl border border-white/20 dark:border-slate-700/50 h-full flex flex-col">
                {/* Image Section */}
                <div className="h-52 relative overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={translateContent(item, 'name')}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-100 via-amber-100 to-red-100 dark:from-orange-900/30 dark:via-amber-900/30 dark:to-red-900/30 flex items-center justify-center">
                      <motion.span
                        className="text-7xl drop-shadow-lg"
                        animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        {getCategoryIcon(item.category.name)}
                      </motion.span>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                  {/* Featured Badge */}
                  <div className="absolute top-4 left-4">
                    <motion.span
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-500/30"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" /> {t('featured')}
                    </motion.span>
                  </div>

                  {/* Price Badge */}
                  <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                    {item.discountPrice ? (
                      <>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="bg-emerald-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg"
                        >
                          {formatCurrency(item.discountPrice, currency)}
                        </motion.div>
                        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-slate-400 line-through">
                          {formatCurrency(item.price, currency)}
                        </div>
                      </>
                    ) : (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg shadow-orange-500/30"
                      >
                        {formatCurrency(item.price, currency)}
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2">
                    {translateContent(item, 'name')}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-5 flex-1">
                    {translateContent(item, 'description')}
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onItemClick(item)}
                    disabled={!item.isAvailable}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 via-red-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all disabled:opacity-50 group/btn"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5 group-hover/btn:rotate-90 transition-transform duration-300" />
                      {t('addToCart')}
                    </span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </TiltCard>
        ))}
      </div>
    </motion.section>
  );
}
