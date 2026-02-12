'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export interface FloatingCartBarProps {
  cartCount: number;
  cartTotal: number;
  currency: string;
  t: (key: string, opts?: any) => string;
}

export function FloatingCartBar({ cartCount, cartTotal, currency, t }: FloatingCartBarProps) {
  return (
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
                  <motion.div className="relative" whileHover={{ scale: 1.1 }}>
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
  );
}
