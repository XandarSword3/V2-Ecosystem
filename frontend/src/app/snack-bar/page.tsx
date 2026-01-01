'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { snackApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Cookie, ShoppingCart, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SnackItem {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  price: number;
  category: 'sandwich' | 'drink' | 'snack' | 'ice_cream';
  imageUrl?: string;
  isAvailable: boolean;
}

interface CartItem extends SnackItem {
  quantity: number;
}

export default function SnackBarPage() {
  const t = useTranslations('snackBar');
  const tCommon = useTranslations('common');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoryLabels: Record<string, string> = {
    sandwich: `🥪 ${t('categories.sandwiches')}`,
    drink: `🥤 ${t('categories.drinks')}`,
    snack: `🍟 ${t('categories.snacks')}`,
    ice_cream: `🍦 ${t('categories.iceCream')}`,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['snack-items'],
    queryFn: () => snackApi.getItems(),
  });

  const items: SnackItem[] = data?.data?.data || [];

  const categories = [...new Set(items.map((item) => item.category))];
  const filteredItems = selectedCategory
    ? items.filter((item) => item.category === selectedCategory)
    : items;

  const addToCart = (item: SnackItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} added`);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-resort-sand dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
          <p className="text-slate-600 dark:text-slate-400">{tCommon('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-resort-sand dark:bg-slate-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{tCommon('error')}</h2>
          <p className="text-slate-600 dark:text-slate-400">{tCommon('tryAgainLater')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-resort-sand dark:bg-slate-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{t('title')}</h1>
          <p className="text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        </div>

        {/* Category Filter */}
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`btn ${!selectedCategory ? 'btn-primary' : 'btn-outline'}`}
          >
            {t('allItems')}
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`btn ${selectedCategory === category ? 'btn-primary' : 'btn-outline'}`}
            >
              {categoryLabels[category] || category}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {item.imageUrl ? (
                <div className="h-32 bg-slate-200 dark:bg-slate-700">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-32 bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 flex items-center justify-center">
                  <span className="text-4xl">
                    {item.category === 'sandwich' ? '🥪' :
                     item.category === 'drink' ? '🥤' :
                     item.category === 'ice_cream' ? '🍦' : '🍟'}
                  </span>
                </div>
              )}
              <div className="p-3">
                <h3 className="font-medium text-slate-900 dark:text-white truncate">{item.name}</h3>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                    {formatCurrency(item.price)}
                  </span>
                  <button
                    onClick={() => addToCart(item)}
                    disabled={!item.isAvailable}
                    className="btn btn-primary px-3 py-1 text-sm"
                  >
                    {t('order.addToCart')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <Cookie className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">{tCommon('noItemsFound')}</h3>
            <p className="text-slate-600 dark:text-slate-400">{t('tryDifferentCategory')}</p>
          </div>
        )}
      </main>

      {/* Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-lg p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{cartCount} {tCommon('items')}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(cartTotal)}</p>
            </div>
            <button className="btn btn-primary">
              {t('placeOrder')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
