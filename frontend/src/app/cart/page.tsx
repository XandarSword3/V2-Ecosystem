'use client';

import { useCartStore } from '@/lib/stores/cartStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { formatCurrency } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Trash2, Plus, Minus, ArrowRight, ShoppingCart, Store } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export default function CartPage() {
  const t = useTranslations('common');
  const currency = useSettingsStore((s) => s.currency);

  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const getTotal = useCartStore((s) => s.getTotal);
  const clearCart = useCartStore((s) => s.clearCart);

  const total = getTotal();
  const isEmpty = items.length === 0;

  // Group items by moduleId
  const groupedItems = items.reduce((acc, item) => {
    const key = item.moduleName || 'Other Items';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

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
          Looks like you haven't added anything yet. Browse our modules to find something!
        </p>
        <Link href="/">
          <Button variant="outline" className="gap-2">
            Return Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Your Cart
          </h1>
          <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={clearCart}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Cart
          </Button>
        </div>

        <div className="grid gap-8">
          {Object.entries(groupedItems).map(([moduleName, moduleItems]) => (
            <section key={moduleName}>
              <div className="flex items-center gap-2 mb-4">
                <Store className="w-5 h-5 text-primary-600" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {moduleName}
                </h2>
              </div>
              <Card>
                <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
                  {moduleItems.map((item) => (
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
                         <div className="flex items-center border rounded-lg dark:border-slate-700">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          ))}

          {/* Checkout Section */}
          <div className="mt-8 flex justify-end">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-600 dark:text-slate-400">Total</span>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(total, currency)}
                </span>
              </div>
              <Button onClick={() => {
                const moduleIds = Array.from(new Set(items.map(i => i.moduleId || '')));
                if (moduleIds.length === 0) return;

                const target = moduleIds[0];
                if (moduleIds.length > 1) {
                  toast.info('Multiple modules in cart — redirecting to first module cart. Consider checking out per module.');
                }

                if (target === 'restaurant') {
                  window.location.href = '/restaurant/cart';
                  return;
                }

                if (target === 'snack-bar') {
                  window.location.href = '/snack-bar/cart';
                  return;
                }

                // Attempt a generic module-specific cart route
                window.location.href = `/${target}/cart`;
              }} className="w-full h-12 text-lg gap-2">
                Checkout
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
