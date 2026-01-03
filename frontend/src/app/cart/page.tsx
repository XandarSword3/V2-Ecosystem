'use client';

import { useCartStore } from '@/lib/stores/cartStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { formatCurrency } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, ArrowRight, UtensilsCrossed, Cookie, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function CartPage() {
  const t = useTranslations('common');
  const tRestaurant = useTranslations('restaurant');
  const tSnack = useTranslations('snackBar');
  const currency = useSettingsStore((s) => s.currency);

  const restaurantItems = useCartStore((s) => s.restaurantItems);
  const snackItems = useCartStore((s) => s.snackItems);
  
  const removeFromRestaurant = useCartStore((s) => s.removeFromRestaurant);
  const updateRestaurantQuantity = useCartStore((s) => s.updateRestaurantQuantity);
  const getRestaurantTotal = useCartStore((s) => s.getRestaurantTotal);
  
  const removeFromSnack = useCartStore((s) => s.removeFromSnack);
  const updateSnackQuantity = useCartStore((s) => s.updateSnackQuantity);
  const getSnackTotal = useCartStore((s) => s.getSnackTotal);

  const restaurantTotal = getRestaurantTotal();
  const snackTotal = getSnackTotal();
  const isEmpty = restaurantItems.length === 0 && snackItems.length === 0;

  if (isEmpty) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <ShoppingCart className="w-12 h-12 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Your cart is empty
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8 text-center max-w-md">
          Looks like you haven't added anything yet. Browse our menus to find something delicious!
        </p>
        <div className="flex gap-4">
          <Link href="/restaurant">
            <Button variant="outline" className="gap-2">
              <UtensilsCrossed className="w-4 h-4" />
              Restaurant
            </Button>
          </Link>
          <Link href="/snack-bar">
            <Button variant="outline" className="gap-2">
              <Cookie className="w-4 h-4" />
              Snack Bar
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">
          Your Cart
        </h1>

        <div className="grid gap-8">
          {/* Restaurant Cart */}
          {restaurantItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <UtensilsCrossed className="w-5 h-5 text-primary-600" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Restaurant Order
                </h2>
              </div>
              <Card>
                <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
                  {restaurantItems.map((item) => (
                    <div key={item.id} className="p-4 flex items-center gap-4">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          {item.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {formatCurrency(item.price, currency)}
                        </p>
                        {item.specialInstructions && (
                          <p className="text-xs text-slate-500 mt-1 italic">
                            "{item.specialInstructions}"
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                          <button
                            onClick={() => updateRestaurantQuantity(item.id, item.quantity - 1)}
                            className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-medium w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateRestaurantQuantity(item.id, item.quantity + 1)}
                            className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromRestaurant(item.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                    <span className="font-medium text-slate-600 dark:text-slate-400">
                      Subtotal
                    </span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(restaurantTotal, currency)}
                    </span>
                  </div>
                  <div className="p-4">
                    <Link href="/restaurant/cart">
                      <Button className="w-full">
                        Proceed to Restaurant Checkout
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Snack Bar Cart */}
          {snackItems.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Cookie className="w-5 h-5 text-amber-600" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Snack Bar Order
                </h2>
              </div>
              <Card>
                <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
                  {snackItems.map((item) => (
                    <div key={item.id} className="p-4 flex items-center gap-4">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          {item.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {formatCurrency(item.price, currency)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                          <button
                            onClick={() => updateSnackQuantity(item.id, item.quantity - 1)}
                            className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-medium w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateSnackQuantity(item.id, item.quantity + 1)}
                            className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromSnack(item.id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                    <span className="font-medium text-slate-600 dark:text-slate-400">
                      Subtotal
                    </span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(snackTotal, currency)}
                    </span>
                  </div>
                  <div className="p-4">
                    <Link href="/snack-bar/cart">
                      <Button className="w-full bg-amber-600 hover:bg-amber-700">
                        Proceed to Snack Bar Checkout
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
