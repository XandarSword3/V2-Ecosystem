'use client';

import { motion } from 'framer-motion';
import { Plus, Minus, Star, Clock, Leaf, Sparkles, Flame } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { MenuItem, cardVariants, getCategoryIcon } from './types';

export interface MenuItemCardProps {
  item: MenuItem;
  currency: string;
  quantity: number;
  onAdd: (item: MenuItem) => void;
  onRemove: (itemId: string) => void;
  translateContent: (item: any, field: string) => string;
  t: (key: string) => string;
}

export function MenuItemCard({
  item,
  currency,
  quantity,
  onAdd,
  onRemove,
  translateContent,
  t,
}: MenuItemCardProps) {
  return (
    <motion.div variants={cardVariants} className="group h-full">
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/30 dark:border-slate-700/50 h-full flex flex-col transition-all duration-500 hover:shadow-2xl hover:shadow-orange-500/10">
        {/* Image Section */}
        <div className="relative h-48 overflow-hidden">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={translateContent(item, 'name')}
              className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-orange-100 via-amber-100 to-red-100 dark:from-orange-900/30 dark:via-amber-900/30 dark:to-red-900/30 flex items-center justify-center">
              <motion.span
                className="text-6xl drop-shadow-md"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                {getCategoryIcon(item.category.name)}
              </motion.span>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Price Badge */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
            {item.discountPrice ? (
              <>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="bg-emerald-500 text-white px-3.5 py-1.5 rounded-full font-bold text-sm shadow-lg"
                >
                  {formatCurrency(item.discountPrice, currency)}
                </motion.div>
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-bold text-slate-400 line-through">
                  {formatCurrency(item.price, currency)}
                </div>
              </>
            ) : (
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3.5 py-1.5 rounded-full font-bold text-sm shadow-lg shadow-orange-500/20"
              >
                {formatCurrency(item.price, currency)}
              </motion.div>
            )}
          </div>

          {/* Featured Badge */}
          {item.isFeatured && (
            <div className="absolute top-3 left-3">
              <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-md">
                <Star className="w-3 h-3 fill-current" /> {t('featured')}
              </span>
            </div>
          )}

          {/* Availability Overlay */}
          {!item.isAvailable && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
              <span className="bg-red-500 text-white px-4 py-2 rounded-full font-semibold text-sm shadow-lg">
                {t('unavailable')}
              </span>
            </div>
          )}

          {/* Prep Time */}
          {item.preparationTimeMinutes && (
            <div className="absolute bottom-3 left-3">
              <span className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm">
                <Clock className="w-3.5 h-3.5" /> {item.preparationTimeMinutes} {t('minutes')}
              </span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-5 flex-1 flex flex-col">
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                {translateContent(item, 'name')}
              </h3>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
              {translateContent(item, 'description')}
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {item.isVegetarian && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100/80 dark:bg-green-900/30 text-green-700 dark:text-green-400 backdrop-blur-sm" title={t('vegetarian')}>
                  <Leaf className="w-3 h-3" />
                </span>
              )}
              {item.isVegan && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 backdrop-blur-sm" title={t('vegan')}>
                  <Sparkles className="w-3 h-3" />
                </span>
              )}
              {item.isGlutenFree && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 backdrop-blur-sm" title={t('glutenFree')}>
                  GF
                </span>
              )}
              {item.isSpicy && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-400 backdrop-blur-sm" title={t('spicy')}>
                  <Flame className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>

          {/* Quantity Controls */}
          <div className="mt-auto">
            {quantity > 0 ? (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center justify-center gap-4 bg-orange-50/80 dark:bg-slate-700/80 backdrop-blur-sm rounded-xl px-4 py-3"
              >
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onRemove(item.id)}
                  className="w-10 h-10 rounded-full bg-white dark:bg-slate-600 shadow-md flex items-center justify-center text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-slate-500 transition-colors"
                >
                  <Minus className="w-5 h-5" />
                </motion.button>
                <span className="font-bold text-xl text-slate-900 dark:text-white min-w-[32px] text-center">
                  {quantity}
                </span>
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onAdd(item)}
                  disabled={!item.isAvailable}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-md shadow-orange-500/30 flex items-center justify-center text-white disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </motion.button>
              </motion.div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onAdd(item)}
                disabled={!item.isAvailable}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-red-500 to-amber-500 text-white font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:shadow-orange-500/30 flex items-center justify-center gap-2 group/btn"
              >
                <Plus className="w-5 h-5 group-hover/btn:rotate-90 transition-transform duration-300" />
                {item.isAvailable ? t('addToCart') : t('unavailable')}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
