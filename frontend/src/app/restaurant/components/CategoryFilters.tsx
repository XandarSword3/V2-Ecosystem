'use client';

import { motion } from 'framer-motion';
import { UtensilsCrossed, Leaf } from 'lucide-react';
import { MenuItem, getCategoryIcon } from './types';

export interface CategoryFiltersProps {
  categories: MenuItem['category'][];
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  dietaryFilters: { vegetarian: boolean; vegan: boolean; glutenFree: boolean };
  onToggleDietary: (filter: 'vegetarian' | 'vegan' | 'glutenFree') => void;
  hasDietaryItems: boolean;
  translateContent: (item: any, field: string) => string;
  t: (key: string, values?: any) => string;
  tCommon: (key: string, values?: any) => string;
}

export function CategoryFilters({
  categories,
  selectedCategory,
  onSelectCategory,
  dietaryFilters,
  onToggleDietary,
  hasDietaryItems,
  translateContent,
  t,
  tCommon,
}: CategoryFiltersProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-10"
    >
      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-4 border border-white/30 dark:border-slate-700/50 shadow-lg">
        <div className="flex flex-wrap gap-3 justify-center">
          <motion.button
            onClick={() => onSelectCategory(null)}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={`
              px-6 py-3 rounded-full font-semibold transition-all duration-300
              ${!selectedCategory
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
                : 'bg-white/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-600 border border-slate-200/50 dark:border-slate-600/50'
              }
            `}
          >
            <span className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4" />
              {tCommon('all')}
            </span>
          </motion.button>
          {categories.map((category) => (
            <motion.button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className={`
                px-6 py-3 rounded-full font-semibold transition-all duration-300
                ${selectedCategory === category.id
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-white/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-600 border border-slate-200/50 dark:border-slate-600/50'
                }
              `}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">{getCategoryIcon(category.name)}</span>
                {translateContent(category, 'name')}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Dietary Filters */}
        {hasDietaryItems && (
          <div className="flex flex-wrap gap-2 justify-center mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-600/50">
            <span className="text-sm text-slate-500 dark:text-slate-400 self-center mr-2">
              <Leaf className="w-4 h-4 inline mr-1" />
              {t('dietaryFilters') || 'Dietary:'}
            </span>
            <motion.button
              onClick={() => onToggleDietary('vegetarian')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                ${dietaryFilters.vegetarian
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40'
                }
              `}
            >
              🥬 {t('vegetarian') || 'Vegetarian'}
            </motion.button>
            <motion.button
              onClick={() => onToggleDietary('vegan')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                ${dietaryFilters.vegan
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                }
              `}
            >
              🌱 {t('vegan') || 'Vegan'}
            </motion.button>
            <motion.button
              onClick={() => onToggleDietary('glutenFree')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                ${dietaryFilters.glutenFree
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                }
              `}
            >
              🌾 {t('glutenFree') || 'Gluten-Free'}
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
