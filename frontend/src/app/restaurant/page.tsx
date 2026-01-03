'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { restaurantApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Loader2, UtensilsCrossed, ShoppingCart, Leaf, AlertCircle, Plus, Minus, Star, Clock, Flame, Sparkles, ChefHat, Wine } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useCartStore } from '@/lib/stores/cartStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
import { useContentTranslation } from '@/lib/translate';
import { motion, AnimatePresence } from 'framer-motion';

interface MenuItem {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  price: number | string;
  category: {
    id: string;
    name: string;
    name_ar?: string;
    name_fr?: string;
  };
  // Support both snake_case (from API) and camelCase
  preparation_time_minutes?: number;
  preparationTimeMinutes?: number;
  is_vegetarian?: boolean;
  isVegetarian?: boolean;
  is_vegan?: boolean;
  isVegan?: boolean;
  is_gluten_free?: boolean;
  isGlutenFree?: boolean;
  allergens?: string[];
  image_url?: string;
  imageUrl?: string;
  is_available?: boolean;
  isAvailable?: boolean;
  is_featured?: boolean;
  isFeatured?: boolean;
}

// Helper to normalize menu item data from API
function normalizeMenuItem(item: any): MenuItem {
  return {
    ...item,
    price: Number(item.price) || 0,
    preparationTimeMinutes: item.preparationTimeMinutes || item.preparation_time_minutes,
    isVegetarian: item.isVegetarian ?? item.is_vegetarian ?? false,
    isVegan: item.isVegan ?? item.is_vegan ?? false,
    isGlutenFree: item.isGlutenFree ?? item.is_gluten_free ?? false,
    imageUrl: item.imageUrl || item.image_url,
    isAvailable: item.isAvailable ?? item.is_available ?? true,
    isFeatured: item.isFeatured ?? item.is_featured ?? false,
  };
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 }
  }
};

// Category icons mapping
const categoryIcons: Record<string, string> = {
  appetizers: '🥗',
  mains: '🍽️',
  desserts: '🍰',
  beverages: '🍹',
  grills: '🥩',
  seafood: '🦐',
  pasta: '🍝',
  salads: '🥬',
  soups: '🍲',
  sandwiches: '🥪',
  default: '🍴'
};

export default function RestaurantMenuPage() {
  const t = useTranslations('restaurant');
  const tCommon = useTranslations('common');
  const { settings } = useSiteSettings();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const currency = useSettingsStore((s) => s.currency);
  const { translateContent, isRTL } = useContentTranslation();

  // Use the cart store instead of local state
  const restaurantItems = useCartStore((s) => s.restaurantItems);
  const addToRestaurant = useCartStore((s) => s.addToRestaurant);
  const removeFromRestaurant = useCartStore((s) => s.removeFromRestaurant);
  const getRestaurantTotal = useCartStore((s) => s.getRestaurantTotal);
  const getRestaurantCount = useCartStore((s) => s.getRestaurantCount);

  const cartTotal = getRestaurantTotal();
  const cartCount = getRestaurantCount();

  const { data, isLoading, error } = useQuery({
    queryKey: ['restaurant-menu'],
    queryFn: () => restaurantApi.getMenu(),
  });

  // Normalize menu items from API (snake_case → camelCase)
  const rawItems = data?.data?.data?.items || [];
  const menuItems: MenuItem[] = rawItems.map(normalizeMenuItem);
  const categories = data?.data?.data?.categories || [];

  // Filter items
  let filteredItems = selectedCategory
    ? menuItems.filter((item) => item.category.id === selectedCategory)
    : menuItems;
  
  if (showFeaturedOnly) {
    filteredItems = filteredItems.filter((item) => item.isFeatured);
  }

  const featuredItems = menuItems.filter((item) => item.isFeatured).slice(0, 3);

  const addToCart = (item: MenuItem) => {
    const translatedName = translateContent(item, 'name');
    addToRestaurant({
      id: item.id,
      name: translatedName,
      price: Number(item.price),
      category: translateContent(item.category, 'name'),
      imageUrl: item.imageUrl,
    });
    toast.success(t('addedToCart', { item: translatedName }));
  };

  const getItemQuantity = (itemId: string) => {
    const item = restaurantItems.find((i) => i.id === itemId);
    return item?.quantity || 0;
  };

  const getCategoryIcon = (categoryName: string) => {
    const key = categoryName.toLowerCase().replace(/\s+/g, '');
    return categoryIcons[key] || categoryIcons.default;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
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
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <ChefHat className="w-6 h-6 text-orange-400 opacity-50" />
            </motion.div>
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">{t('loadingMenu')}</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-red-500 to-amber-500 dark:from-orange-800 dark:via-red-700 dark:to-amber-600 pt-24 pb-20">
        {/* Decorative Elements - Spread across header */}
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
              className="absolute text-5xl opacity-10"
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

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 100" fill="none" className="w-full h-auto">
            <motion.path
              d="M0,50 C360,100 720,0 1080,50 C1260,75 1360,75 1440,50 L1440,100 L0,100 Z"
              className="fill-amber-50 dark:fill-slate-900"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
            />
          </svg>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-white" />
              <span className="text-white/90 text-sm font-medium">{t('authenticLebanese')}</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
              {settings.restaurantName || t('menu')}
            </h1>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
              {t('menuSubtitle')}
            </p>

            {/* Quick Stats */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center gap-8 mt-8"
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{menuItems.length}+</div>
                <div className="text-white/80 text-sm">{t('dishes')}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{categories.length}</div>
                <div className="text-white/80 text-sm">{t('categories')}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-3xl font-bold text-white">
                  <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                  4.9
                </div>
                <div className="text-white/80 text-sm">{t('rating')}</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-6 relative z-10">
        {/* Featured Dishes Section */}
        {featuredItems.length > 0 && !selectedCategory && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="w-6 h-6 text-orange-500" />
                {t('featuredDishes')}
              </h2>
              <button
                onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
                className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${
                  showFeaturedOnly 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200'
                }`}
              >
                {showFeaturedOnly ? t('showAll') : t('viewFeatured')}
              </button>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {featuredItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -8 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
                  <div className="relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-xl border border-orange-100 dark:border-slate-700">
                    <div className="h-48 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 relative overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={translateContent(item, 'name')}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <motion.span 
                            className="text-6xl"
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            {getCategoryIcon(item.category.name)}
                          </motion.span>
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> {t('featured')}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-1.5 rounded-full font-bold text-orange-600 dark:text-orange-400">
                          {formatCurrency(item.price, currency)}
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
                        {translateContent(item, 'name')}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                        {translateContent(item, 'description')}
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => addToCart(item)}
                        disabled={!item.isAvailable}
                        className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/30 hover:shadow-xl transition-all disabled:opacity-50"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Plus className="w-4 h-4" />
                          {t('addToCart')}
                        </span>
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Category Pills */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <div className="flex flex-wrap gap-3 justify-center">
            <motion.button
              onClick={() => setSelectedCategory(null)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                px-6 py-3 rounded-full font-semibold transition-all duration-300 shadow-md
                ${!selectedCategory 
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-orange-500/30' 
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
                }
              `}
            >
              <span className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4" />
                {tCommon('all')}
              </span>
            </motion.button>
            {categories.map((category: any) => (
              <motion.button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  px-6 py-3 rounded-full font-semibold transition-all duration-300 shadow-md
                  ${selectedCategory === category.id 
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-orange-500/30' 
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
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
        </motion.div>

        {/* Menu Grid */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={selectedCategory || 'all'}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredItems.map((item) => (
              <motion.div 
                key={item.id} 
                variants={cardVariants}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group"
              >
                <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 border border-slate-100 dark:border-slate-700 h-full flex flex-col">
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
                          className="text-6xl"
                          animate={{ rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          {getCategoryIcon(item.category.name)}
                        </motion.span>
                      </div>
                    )}
                    
                    {/* Price Badge */}
                    <div className="absolute top-3 right-3">
                      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1.5 rounded-full font-bold text-sm shadow-lg">
                        {formatCurrency(item.price, currency)}
                      </div>
                    </div>

                    {/* Featured Badge */}
                    {item.isFeatured && (
                      <div className="absolute top-3 left-3">
                        <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> {t('featured')}
                        </span>
                      </div>
                    )}

                    {/* Availability Overlay */}
                    {!item.isAvailable && (
                      <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                        <span className="bg-red-500 text-white px-4 py-2 rounded-full font-semibold text-sm">
                          {t('unavailable')}
                        </span>
                      </div>
                    )}

                    {/* Prep Time */}
                    {item.preparationTimeMinutes && (
                      <div className="absolute bottom-3 left-3">
                        <span className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {item.preparationTimeMinutes} {t('minutes')}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Content Section */}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">
                          {translateContent(item, 'name')}
                        </h3>
                      </div>
                      
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                        {translateContent(item, 'description')}
                      </p>

                      {/* Dietary Tags */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {item.isVegetarian && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            <Leaf className="w-3 h-3" /> {t('vegetarian')}
                          </span>
                        )}
                        {item.isVegan && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            {t('vegan')}
                          </span>
                        )}
                        {item.isGlutenFree && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            {t('glutenFree')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="mt-auto">
                      {getItemQuantity(item.id) > 0 ? (
                        <motion.div 
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className="flex items-center justify-center gap-4 bg-orange-50 dark:bg-slate-700 rounded-xl px-4 py-3"
                        >
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => removeFromRestaurant(item.id)}
                            className="w-10 h-10 rounded-full bg-white dark:bg-slate-600 shadow-md flex items-center justify-center text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-slate-500 transition-colors"
                          >
                            <Minus className="w-5 h-5" />
                          </motion.button>
                          <span className="font-bold text-xl text-slate-900 dark:text-white min-w-[32px] text-center">
                            {getItemQuantity(item.id)}
                          </span>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => addToCart(item)}
                            disabled={!item.isAvailable}
                            className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-md flex items-center justify-center text-white disabled:opacity-50"
                          >
                            <Plus className="w-5 h-5" />
                          </motion.button>
                        </motion.div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => addToCart(item)}
                          disabled={!item.isAvailable}
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <Plus className="w-5 h-5" />
                          {item.isAvailable ? t('addToCart') : t('unavailable')}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 max-w-md mx-auto shadow-xl">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <UtensilsCrossed className="w-20 h-20 text-orange-400 mx-auto mb-6" />
              </motion.div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {tCommon('noItemsFound')}
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {t('tryDifferentCategory')}
              </p>
            </div>
          </motion.div>
        )}
      </main>

      {/* Floating Cart Bar */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50"
          >
            <div className="bg-gradient-to-r from-orange-500 via-red-500 to-amber-500 rounded-2xl shadow-2xl shadow-orange-500/30 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <ShoppingCart className="w-8 h-8 text-white" />
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-white text-orange-600 rounded-full flex items-center justify-center text-xs font-bold"
                    >
                      {cartCount}
                    </motion.div>
                  </div>
                  <div className="text-white">
                    <p className="text-sm opacity-90">{t('itemsInCart', { count: cartCount })}</p>
                    <p className="text-xl font-bold">{formatCurrency(cartTotal, currency)}</p>
                  </div>
                </div>
                <Link href="/restaurant/cart">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white text-orange-600 px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    {t('proceedToCheckout')}
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
