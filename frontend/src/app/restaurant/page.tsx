'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { restaurantApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Loader2, UtensilsCrossed, ShoppingCart, Leaf, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface MenuItem {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  price: number;
  category: {
    id: string;
    name: string;
  };
  preparationTimeMinutes?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  allergens?: string[];
  imageUrl?: string;
  isAvailable: boolean;
  isFeatured: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
  specialInstructions?: string;
}

export default function RestaurantMenuPage() {
  const t = useTranslations('restaurant');
  const tCommon = useTranslations('common');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['restaurant-menu'],
    queryFn: () => restaurantApi.getMenu(),
  });

  const menuItems: MenuItem[] = data?.data?.data?.items || [];
  const categories = data?.data?.data?.categories || [];

  const filteredItems = selectedCategory
    ? menuItems.filter((item) => item.category.id === selectedCategory)
    : menuItems;

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} added to cart`);
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter((i) => i.id !== itemId);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{t('menu')}</h1>
          <p className="text-slate-600 dark:text-slate-400">{t('menuSubtitle')}</p>
        </div>

        {/* Category Filter */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`btn ${!selectedCategory ? 'btn-primary' : 'btn-outline'} whitespace-nowrap`}
            >
              {tCommon('all')}
            </button>
            {categories.map((category: any) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`btn ${selectedCategory === category.id ? 'btn-primary' : 'btn-outline'} whitespace-nowrap`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div key={item.id} className="card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              {item.imageUrl && (
                <div className="h-48 bg-slate-200 dark:bg-slate-700 relative">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  {item.isFeatured && (
                    <span className="absolute top-2 left-2 badge badge-warning">
                      {t('featured')}
                    </span>
                  )}
                </div>
              )}
              <div className="card-body">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{item.name}</h3>
                    {item.nameAr && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-arabic">{item.nameAr}</p>
                    )}
                  </div>
                  <span className="text-lg font-bold text-primary-600">
                    {formatCurrency(item.price)}
                  </span>
                </div>
                {item.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mb-4">
                  {item.isVegetarian && (
                    <span className="badge badge-success flex items-center">
                      <Leaf className="w-3 h-3 mr-1" /> {t('vegetarian')}
                    </span>
                  )}
                  {item.isVegan && (
                    <span className="badge badge-success">{t('vegan')}</span>
                  )}
                  {item.isGlutenFree && (
                    <span className="badge badge-info">{t('glutenFree')}</span>
                  )}
                </div>
                <button
                  onClick={() => addToCart(item)}
                  disabled={!item.isAvailable}
                  className="btn btn-primary w-full"
                >
                  {item.isAvailable ? t('addToCart') : t('unavailable')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <UtensilsCrossed className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">{tCommon('noItemsFound')}</h3>
            <p className="text-slate-600 dark:text-slate-400">{t('tryDifferentCategory')}</p>
          </div>
        )}
      </main>

      {/* Cart Summary Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-lg p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('itemsInCart', { count: cartCount })}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(cartTotal)}</p>
            </div>
            <Link href="/restaurant/checkout" className="btn btn-primary">
              {t('proceedToCheckout')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
