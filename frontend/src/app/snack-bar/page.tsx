'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { snackApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useCartStore } from '@/lib/stores/cartStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
import { useContentTranslation } from '@/lib/translate';
import { Loader2, Cookie, ShoppingCart, AlertCircle, Plus, Minus, Sparkles, UtensilsCrossed } from 'lucide-react';
import { JsonLd, generateSnackBarSchema, generateBreadcrumbSchema } from '@/lib/structured-data';
import { toast } from 'sonner';
import { FloatingCard } from '@/components/effects/Card3D';
import { SpotlightCard } from '@/components/effects/GlowingBorder';
import { GradientText } from '@/components/effects/TextEffects';
import { AnimatedCounter } from '@/components/effects/AnimatedCounter';

interface SnackItem {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  price: number;
  category: 'sandwich' | 'drink' | 'snack' | 'ice_cream';
  imageUrl?: string;
  image_url?: string;
  isAvailable?: boolean;
  is_available?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

const categoryIcons: Record<string, string> = {
  sandwich: '🥪',
  drink: '🥤',
  snack: '🍟',
  ice_cream: '🍦',
};

export default function SnackBarPage() {
  const t = useTranslations('snackBar');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { translateContent } = useContentTranslation();
  const { settings } = useSiteSettings();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const currency = useSettingsStore((s) => s.currency);

  // Use the cart store
  const snackItems = useCartStore((s) => s.snackItems);
  const addToSnack = useCartStore((s) => s.addToSnack);
  const removeFromSnack = useCartStore((s) => s.removeFromSnack);
  const getSnackTotal = useCartStore((s) => s.getSnackTotal);
  const getSnackCount = useCartStore((s) => s.getSnackCount);

  const cartTotal = getSnackTotal();
  const cartCount = getSnackCount();

  const categoryLabels: Record<string, string> = {
    sandwich: t('categories.sandwiches'),
    drink: t('categories.drinks'),
    snack: t('categories.snacks'),
    ice_cream: t('categories.iceCream'),
  };

  // Note: snack_items table doesn't have module_id - it's a shared menu
  const { data, isLoading, error } = useQuery({
    queryKey: ['snack-items'],
    queryFn: () => snackApi.getItems(),
  });

  const items: SnackItem[] = data?.data?.data || [];

  const categories = Array.from(new Set(items.map((item) => item.category)));
  const filteredItems = selectedCategory
    ? items.filter((item) => item.category === selectedCategory)
    : items;

  const addToCart = (item: SnackItem) => {
    addToSnack({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      imageUrl: item.imageUrl,
    });
    toast.success(t('addedToCart', { name: translateContent(item, 'name') }));
  };

  const getItemQuantity = (itemId: string) => {
    const item = snackItems.find((i) => i.id === itemId);
    return item?.quantity || 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin text-amber-600 mx-auto mb-4" />
            <motion.div 
              className="absolute inset-0 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Cookie className="w-6 h-6 text-amber-400 opacity-50" />
            </motion.div>
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">{tCommon('loading')}</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <FloatingCard>
          <div className="text-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-12 rounded-3xl shadow-2xl border border-white/30">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{tCommon('error')}</h2>
            <p className="text-slate-600 dark:text-slate-400">{tCommon('tryAgainLater')}</p>
          </div>
        </FloatingCard>
      </div>
    );
  }

  // Static SEO data for bots
  const snackBarSchema = generateSnackBarSchema({
    name: settings.snackBarName || 'V2 Snack Bar',
    description: 'Quick bites and refreshing beverages at V2 Resort. Sandwiches, drinks, snacks, and ice cream available poolside.',
    url: 'https://v2-ecosystem.vercel.app/snack-bar',
    priceRange: '$',
    menuItems: items.slice(0, 10).map(item => ({
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
    })),
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://v2-ecosystem.vercel.app/' },
    { name: 'Snack Bar', url: 'https://v2-ecosystem.vercel.app/snack-bar' },
  ]);

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <JsonLd data={[snackBarSchema, breadcrumbSchema]} />
      
      {/* Static content for bots/LLMs that don't run JavaScript */}
      <noscript>
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
          <h1>V2 Resort Snack Bar</h1>
          <p>Quick bites and refreshing beverages at V2 Resort in Lebanon. Perfect for a poolside snack or light meal.</p>
          
          <h2>Menu Categories</h2>
          <ul>
            <li><strong>Sandwiches</strong> - Fresh, delicious sandwiches made to order</li>
            <li><strong>Drinks</strong> - Cold beverages and refreshments</li>
            <li><strong>Snacks</strong> - Light bites and appetizers</li>
            <li><strong>Ice Cream</strong> - Cool treats for hot days</li>
          </ul>
          
          <h2>About Our Menu</h2>
          <p>We offer a variety of quick bites and refreshments perfect for enjoying by the pool. From freshly made sandwiches to cold drinks and sweet ice cream treats, our snack bar has something for everyone.</p>
          <p>All items are prepared fresh and available for immediate pickup or poolside delivery.</p>
          
          <h2>Location</h2>
          <p>Located poolside at V2 Resort for your convenience. Open during pool hours.</p>
          
          <h2>Contact</h2>
          <p>For snack bar inquiries: info@v2resort.com | +961 XX XXX XXX</p>
          
          <p><a href="/">← Return to V2 Resort Home</a></p>
        </div>
      </noscript>
      
    <div className="min-h-screen bg-gradient-to-br from-amber-50/50 via-orange-50/50 to-yellow-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Animated Hero Section with Aurora */}
      <div className="relative overflow-hidden pt-24 pb-20">
        {/* Aurora Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 dark:from-amber-700 dark:via-orange-700 dark:to-yellow-600">
          {/* Animated Blobs */}
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-40"
            style={{ background: 'radial-gradient(circle, rgba(251, 191, 36, 0.6) 0%, transparent 70%)' }}
            animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-1/2 right-1/4 w-80 h-80 rounded-full opacity-40"
            style={{ background: 'radial-gradient(circle, rgba(249, 115, 22, 0.6) 0%, transparent 70%)' }}
            animate={{ x: [0, -40, 0], y: [0, -50, 0], scale: [1, 1.3, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <motion.div
            className="absolute bottom-1/4 left-1/2 w-72 h-72 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(234, 179, 8, 0.6) 0%, transparent 70%)' }}
            animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
        </div>

        {/* Floating Food Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[
            { emoji: '🍕', x: 8, y: 20, duration: 18 },
            { emoji: '🍔', x: 75, y: 15, duration: 22 },
            { emoji: '🌭', x: 30, y: 65, duration: 16 },
            { emoji: '🍟', x: 90, y: 50, duration: 20 },
            { emoji: '🥤', x: 55, y: 10, duration: 24 },
            { emoji: '🍦', x: 15, y: 75, duration: 19 },
            { emoji: '🥪', x: 65, y: 80, duration: 21 },
            { emoji: '🍩', x: 40, y: 35, duration: 17 },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="absolute text-4xl opacity-20"
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
              animate={{ 
                y: [0, -25, 0, 25, 0],
                x: [0, 20, 0, -20, 0],
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

        {/* Wave Decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" className="w-full h-auto">
            <path
              d="M0,60 C360,120 720,0 1080,60 C1260,90 1360,90 1440,60 L1440,120 L0,120 Z"
              className="fill-amber-50/50 dark:fill-slate-900"
            />
          </svg>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md rounded-full px-5 py-2.5 mb-6 border border-white/30"
            >
              <Sparkles className="w-5 h-5 text-yellow-200" />
              <span className="text-white font-medium">{t('freshlyMade')}</span>
            </motion.div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-lg">
              {settings.snackBarName || t('title')}
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-10">
              {t('subtitle')}
            </p>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              {[
                { value: items.length, label: t('menuItems'), icon: '🍽️' },
                { value: categories.length, label: t('categoriesLabel'), icon: '📂' },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ y: -4, scale: 1.05 }}
                  className="bg-white/20 backdrop-blur-xl rounded-2xl px-8 py-4 border border-white/30 text-white"
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-2xl">{stat.icon}</span>
                    <span className="text-3xl font-bold">
                      <AnimatedCounter value={stat.value} duration={2} />
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
        {/* Category Pills - Glass Container */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-10"
        >
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-4 border border-white/30 dark:border-slate-700/50 shadow-lg">
            <div className="flex flex-wrap gap-3 justify-center">
              <motion.button
                onClick={() => setSelectedCategory(null)}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  px-6 py-3 rounded-full font-semibold transition-all duration-300
                  ${!selectedCategory 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30' 
                    : 'bg-white/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600 border border-slate-200/50 dark:border-slate-600/50 backdrop-blur-sm'
                  }
                `}
              >
              <span className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4" />
                {t('allItems')}
              </span>
            </motion.button>
            {categories.map((category) => (
              <motion.button
                key={category}
                onClick={() => setSelectedCategory(category)}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  px-6 py-3 rounded-full font-semibold transition-all duration-300
                  ${selectedCategory === category 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30' 
                    : 'bg-white/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-600 border border-slate-200/50 dark:border-slate-600/50 backdrop-blur-sm'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  <span className="text-lg">{categoryIcons[category]}</span>
                  {categoryLabels[category] || category}
                </span>
              </motion.button>
            ))}
            </div>
          </div>
        </motion.div>

        {/* Items Grid */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={selectedCategory || 'all'}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {filteredItems.map((item, index) => (
              <motion.div 
                key={item.id} 
                variants={cardVariants}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group"
              >
                <SpotlightCard
                  spotlightColor="rgba(245, 158, 11, 0.15)"
                  className="h-full rounded-2xl overflow-hidden"
                >
                  <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl h-full rounded-2xl overflow-hidden border border-white/30 dark:border-slate-700/50 shadow-lg hover:shadow-2xl transition-all duration-500">
                    {/* Image Section */}
                    <div className="relative h-40 overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={translateContent(item, 'name')}
                          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-100 via-orange-100 to-yellow-100 dark:from-amber-900/30 dark:via-orange-900/30 dark:to-yellow-900/30 flex items-center justify-center">
                          <motion.span 
                            className="text-6xl"
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            {categoryIcons[item.category] || '🍽️'}
                          </motion.span>
                        </div>
                      )}
                      
                      {/* Price Badge - Enhanced */}
                      <div className="absolute top-3 right-3">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-full font-bold text-sm shadow-lg shadow-amber-500/30">
                          {formatCurrency(item.price, currency)}
                        </div>
                      </div>

                      {/* Category Badge - Glass */}
                      <div className="absolute top-3 left-3">
                        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xl border border-white/30">
                          {categoryIcons[item.category]}
                      </div>
                    </div>

                    {/* Availability Overlay */}
                    {!(item.isAvailable ?? item.is_available ?? true) && (
                      <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                        <span className="bg-red-500 text-white px-4 py-2 rounded-full font-semibold text-sm">
                          {t('unavailable')}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Content Section */}
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1 line-clamp-1">
                      {translateContent(item, 'name')}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                        {translateContent(item, 'description')}
                      </p>
                    )}
                    
                    {/* Quantity Controls */}
                    <div className="flex items-center justify-center">
                      {getItemQuantity(item.id) > 0 ? (
                        <motion.div 
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className="flex items-center gap-4 bg-amber-50/80 dark:bg-slate-700/80 backdrop-blur-sm rounded-full px-3 py-2"
                        >
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => removeFromSnack(item.id)}
                            className="w-8 h-8 rounded-full bg-white/90 dark:bg-slate-600 shadow-md flex items-center justify-center text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-slate-500 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </motion.button>
                          <span className="font-bold text-lg text-slate-900 dark:text-white min-w-[24px] text-center">
                            {getItemQuantity(item.id)}
                          </span>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => addToCart(item)}
                            disabled={!(item.isAvailable ?? item.is_available ?? true)}
                            className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30 flex items-center justify-center text-white disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                          </motion.button>
                        </motion.div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => addToCart(item)}
                          disabled={!(item.isAvailable ?? item.is_available ?? true)}
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 hover:shadow-xl flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          {t('order.addToCart')}
                        </motion.button>
                      )}
                    </div>
                  </div>
                  </div>
                </SpotlightCard>
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
            <FloatingCard className="max-w-md mx-auto">
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl p-12 shadow-xl border border-white/30">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Cookie className="w-20 h-20 text-amber-400 mx-auto mb-6" />
                </motion.div>
                <h3 className="text-2xl font-bold mb-2">
                  <GradientText from="from-amber-500" to="to-orange-500">
                    {tCommon('noItemsFound')}
                  </GradientText>
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {t('tryDifferentCategory')}
                </p>
              </div>
            </FloatingCard>
          </motion.div>
        )}
      </main>

      {/* Floating Cart Bar with Glow Effect */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50"
          >
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-400 rounded-2xl blur-xl opacity-50 animate-pulse" />
            
            {/* Main Cart Bar */}
            <div className="relative bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 rounded-2xl p-1 shadow-2xl shadow-orange-500/40">
              <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <ShoppingCart className="w-7 h-7 text-white" />
                      </div>
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-white text-amber-600 rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
                      >
                        {cartCount}
                      </motion.div>
                    </div>
                    <div className="text-white">
                      <p className="text-sm text-white/80">{cartCount} {tCommon('items')}</p>
                      <p className="text-xl font-bold">{formatCurrency(cartTotal, currency)}</p>
                    </div>
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => router.push('/snack-bar/cart')}
                    className="bg-white/95 backdrop-blur-sm text-amber-600 px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:bg-white transition-all duration-300"
                  >
                    {t('placeOrder')}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
