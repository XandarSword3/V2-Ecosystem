'use client';

import { useQuery } from '@tanstack/react-query';
import { restaurantApi } from '@/lib/api';
import { Loader2, AlertCircle, Sparkles, Star, UtensilsCrossed, ShoppingCart, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCartStore } from '@/lib/stores/cartStore';
import { useContentTranslation } from '@/lib/translate';
import { motion, AnimatePresence } from 'framer-motion';
import { Module } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { toast } from 'sonner';

interface MenuServiceProps {
  module: Module;
}

export function MenuService({ module }: MenuServiceProps) {
  const t = useTranslations('restaurant');
  const tCommon = useTranslations('common');
  const { translateContent } = useContentTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const currency = useSettingsStore((s) => s.currency);

  // Use the cart store
  const restaurantItems = useCartStore((s) => s.restaurantItems);
  const addToRestaurant = useCartStore((s) => s.addToRestaurant);
  const removeFromRestaurant = useCartStore((s) => s.removeFromRestaurant);
  const getRestaurantTotal = useCartStore((s) => s.getRestaurantTotal);
  const getRestaurantCount = useCartStore((s) => s.getRestaurantCount());

  const { data, isLoading, error } = useQuery({
    queryKey: ['menu', module.id],
    queryFn: () => restaurantApi.getMenu(module.id),
  });

  const categories = data?.data?.data?.categories || [];
  const items = data?.data?.data?.items || [];

  const filteredItems = selectedCategory
    ? items.filter((item: any) => item.category_id === selectedCategory)
    : items;

  const addToCart = (item: any) => {
    addToRestaurant({
      id: item.id,
      name: item.name,
      price: item.price,
      moduleId: module.id, // Add module ID to cart item if needed for separation
    });
    toast.success(t('addedToCart', { name: translateContent(item, 'name') }));
  };

  const removeFromCart = (itemId: string) => {
    removeFromRestaurant(itemId);
  };

  const getItemQuantity = (itemId: string) => {
    const item = restaurantItems.find((i) => i.id === itemId);
    return item?.quantity || 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p>{tCommon('error')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-600 to-primary-800 pt-24 pb-20">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-white" />
              <span className="text-white/90 text-sm font-medium">{module.description || t('authenticLebanese')}</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
              {module.name}
            </h1>
          </motion.div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-6 relative z-10">
        {/* Categories */}
        <div className="flex flex-wrap gap-3 justify-center mb-10">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-6 py-3 rounded-full font-semibold transition-all ${
              !selectedCategory 
                ? 'bg-primary-600 text-white shadow-lg' 
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            All
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-6 py-3 rounded-full font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-primary-600 text-white shadow-lg' 
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              {translateContent(cat, 'name')}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item: any) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden"
            >
              {item.image_url && (
                <div className="h-48 overflow-hidden">
                  <img 
                    src={item.image_url} 
                    alt={translateContent(item, 'name')}
                    className="w-full h-full object-cover transition-transform hover:scale-110 duration-500"
                  />
                </div>
              )}
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {translateContent(item, 'name')}
                  </h3>
                  <span className="text-lg font-bold text-primary-600">
                    {formatCurrency(item.price, currency)}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                  {translateContent(item, 'description')}
                </p>
                
                <div className="flex items-center justify-between mt-4">
                  {getItemQuantity(item.id) > 0 ? (
                    <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-medium w-4 text-center">{getItemQuantity(item.id)}</span>
                      <button 
                        onClick={() => addToCart(item)}
                        className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      {t('addToCart')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
