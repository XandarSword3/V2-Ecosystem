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

// Premium effects
import { AuroraSection } from '@/components/effects/AuroraBackground';
import { Card3D, TiltCard, FloatingCard } from '@/components/effects/Card3D';
import { SpotlightCard } from '@/components/effects/GlowingBorder';
import { GradientText, RevealHeading } from '@/components/effects/TextEffects';
import { AnimatedCounter } from '@/components/effects/AnimatedCounter';

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
  is_spicy?: boolean;
  isSpicy?: boolean;
  discount_price?: number;
  discountPrice?: number;
  allergens?: string[];
  image_url?: string;
  imageUrl?: string;
  is_available?: boolean;
  isAvailable?: boolean;
  is_featured?: boolean;
  isFeatured?: boolean;
}

// Helper to normalize menu item data from API
interface RawMenuItem {
  id: string;
  name: string;
  price: number | string;
  category: { id: string; name: string };
  preparationTimeMinutes?: number;
  preparation_time_minutes?: number;
  isVegetarian?: boolean;
  is_vegetarian?: boolean;
  isVegan?: boolean;
  is_vegan?: boolean;
  isGlutenFree?: boolean;
  is_gluten_free?: boolean;
  isSpicy?: boolean;
  is_spicy?: boolean;
  discountPrice?: number;
  discount_price?: number | string;
  imageUrl?: string;
  image_url?: string;
  isAvailable?: boolean;
  is_available?: boolean;
  isFeatured?: boolean;
  is_featured?: boolean;
}
function normalizeMenuItem(item: RawMenuItem): MenuItem {
  const discountPriceNum = item.discountPrice !== undefined 
    ? Number(item.discountPrice) 
    : (item.discount_price !== undefined ? Number(item.discount_price) : undefined);
  
  return {
    ...item,
    price: Number(item.price) || 0,
    discount_price: discountPriceNum,
    preparationTimeMinutes: item.preparationTimeMinutes || item.preparation_time_minutes,
    isVegetarian: item.isVegetarian ?? item.is_vegetarian ?? false,
    isVegan: item.isVegan ?? item.is_vegan ?? false,
    isGlutenFree: item.isGlutenFree ?? item.is_gluten_free ?? false,
    isSpicy: item.isSpicy ?? item.is_spicy ?? false,
    discountPrice: discountPriceNum,
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
  const [dietaryFilters, setDietaryFilters] = useState<{
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
  }>({ vegetarian: false, vegan: false, glutenFree: false });
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

  // Filter items by category
  let filteredItems = selectedCategory
    ? menuItems.filter((item) => item.category.id === selectedCategory)
    : menuItems;

  // Apply dietary filters
  if (dietaryFilters.vegetarian) {
    filteredItems = filteredItems.filter((item) => item.isVegetarian);
  }
  if (dietaryFilters.vegan) {
    filteredItems = filteredItems.filter((item) => item.isVegan);
  }
  if (dietaryFilters.glutenFree) {
    filteredItems = filteredItems.filter((item) => item.isGlutenFree);
  }

  if (showFeaturedOnly) {
    filteredItems = filteredItems.filter((item) => item.isFeatured);
  }

  const featuredItems = menuItems.filter((item) => item.isFeatured).slice(0, 3);
  const hasDietaryItems = menuItems.some((item) => item.isVegetarian || item.isVegan || item.isGlutenFree);

  const toggleDietaryFilter = (filter: 'vegetarian' | 'vegan' | 'glutenFree') => {
    setDietaryFilters((prev) => ({ ...prev, [filter]: !prev[filter] }));
  };

  const addToCart = (item: MenuItem) => {
    const translatedName = translateContent(item, 'name');
    addToRestaurant({
      id: item.id,
      name: translatedName,
      price: Number(item.discountPrice || item.price),
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
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Hero Section with Aurora Effect */}
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
              {settings.restaurantName || t('menu')}
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-12">
              {t('menuSubtitle')}
            </p>

            {/* Stats Cards */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              {[
                { value: menuItems.length, suffix: '+', label: t('dishes'), icon: <UtensilsCrossed className="w-5 h-5" /> },
                { value: categories.length, label: t('categories'), icon: <ChefHat className="w-5 h-5" /> },
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-6 relative z-10">
        {/* Featured Dishes Section */}
        {featuredItems.length > 0 && !selectedCategory && (
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
                onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`text-sm font-medium px-5 py-2.5 rounded-full transition-all backdrop-blur-md ${showFeaturedOnly
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-white/80 dark:bg-slate-800/80 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-700 border border-orange-200/50 dark:border-slate-600/50'
                }`}
              >
                {showFeaturedOnly ? t('showAll') : t('viewFeatured')}
              </motion.button>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {featuredItems.map((item, index) => (
                <TiltCard
                  key={item.id}
                  intensity={8}
                  className="h-full"
                >
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
                          onClick={() => addToCart(item)}
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
        )}

        {/* Category Pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          {/* Glass container for pills */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-4 border border-white/30 dark:border-slate-700/50 shadow-lg">
            <div className="flex flex-wrap gap-3 justify-center">
              <motion.button
                onClick={() => setSelectedCategory(null)}
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
              {categories.map((category: MenuItem['category']) => (
                <motion.button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
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
                  onClick={() => toggleDietaryFilter('vegetarian')}
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
                  onClick={() => toggleDietaryFilter('vegan')}
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
                  onClick={() => toggleDietaryFilter('glutenFree')}
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

        {/* Menu Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory || 'all'}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredItems.map((item) => (
              <SpotlightCard
                key={item.id}
                className="h-full"
                spotlightColor="rgba(251, 146, 60, 0.15)"
              >
                <motion.div
                  variants={cardVariants}
                  className="group h-full"
                >
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
                      {getItemQuantity(item.id) > 0 ? (
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className="flex items-center justify-center gap-4 bg-orange-50/80 dark:bg-slate-700/80 backdrop-blur-sm rounded-xl px-4 py-3"
                        >
                          <motion.button
                            whileHover={{ scale: 1.15 }}
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
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => addToCart(item)}
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
                          onClick={() => addToCart(item)}
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
            </SpotlightCard>
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
                <p className="text-slate-600 dark:text-slate-400">
                  {t('tryDifferentCategory')}
                </p>
              </div>
            </FloatingCard>
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
            {/* Glow effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-orange-500 via-red-500 to-amber-500 rounded-3xl blur-xl opacity-40 animate-pulse" />
            
            <div className="relative bg-gradient-to-r from-orange-500 via-red-500 to-amber-500 rounded-2xl shadow-2xl shadow-orange-500/40 p-1">
              <div className="bg-white/10 backdrop-blur-xl rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <motion.div 
                      className="relative"
                      whileHover={{ scale: 1.1 }}
                    >
                      <ShoppingCart className="w-8 h-8 text-white drop-shadow-lg" />
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-white text-orange-600 rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
                      >
                        {cartCount}
                      </motion.div>
                    </motion.div>
                    <div className="text-white">
                      <p className="text-sm opacity-90">{t('itemsInCart', { count: cartCount })}</p>
                      <p className="text-2xl font-bold drop-shadow-md">{formatCurrency(cartTotal, currency)}</p>
                    </div>
                  </div>
                  <Link href="/restaurant/cart">
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className="bg-white text-orange-600 px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      {t('proceedToCheckout')}
                    </motion.button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
