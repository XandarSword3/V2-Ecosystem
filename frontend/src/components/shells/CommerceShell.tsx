'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { useModuleContext } from './ModuleContext';

export interface CommerceShellProps {
  children: React.ReactNode;
  className?: string;
  toolbarSlot?: React.ReactNode;
  fulfillmentSelectorSlot?: React.ReactNode;
  cartAffordanceSlot?: React.ReactNode;
  showDefaultCartAffordance?: boolean;
}

/**
 * CommerceShell — Layout & slot composition shell for Engine A commerce flows (Phase F3).
 *
 * Responsibilities:
 * - Provides layout framing around commerce experiences (`MenuService`, custom catalog renderers)
 * - Renders toolbar and fulfillment mode selector slots
 * - Provides a floating/sticky cart affordance reflecting item count
 *
 * Explicit Non-Responsibilities (F3 Law):
 * - Does NOT own catalog fetching or search/filter state (owned by `MenuService`)
 * - Does NOT own cart calculations or discounts (owned by pricing authority & cartStore)
 * - Does NOT hardcode vertical assumptions (e.g. food/restaurant only)
 */
export function CommerceShell({
  children,
  className = '',
  toolbarSlot,
  fulfillmentSelectorSlot,
  cartAffordanceSlot,
  showDefaultCartAffordance = true,
}: CommerceShellProps) {
  const t = useTranslations('common');
  const { propertySlug, slug } = useModuleContext();
  const cartItems = useCartStore((s) => s.items);

  // Derive total item count for the module (or all cart items)
  const totalItemCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <div className={`commerce-shell relative w-full flex flex-col ${className}`}>
      {/* Optional Top Toolbar Slot (e.g. Search, Category Bar) */}
      {toolbarSlot && (
        <div className="commerce-shell-toolbar sticky top-16 z-20 w-full bg-background/80 backdrop-blur-md border-b border-border/40 py-3 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            {toolbarSlot}
          </div>
        </div>
      )}

      {/* Optional Fulfillment Selector Slot */}
      {fulfillmentSelectorSlot && (
        <div className="commerce-shell-fulfillment-slot w-full py-2 px-4 sm:px-6 bg-muted/40 border-b border-border/30">
          <div className="max-w-7xl mx-auto">
            {fulfillmentSelectorSlot}
          </div>
        </div>
      )}

      {/* Main Commerce Body */}
      <div className="commerce-shell-body flex-1 w-full">
        {children}
      </div>

      {/* Cart Affordance Slot or Default Floating Cart Trigger */}
      {cartAffordanceSlot ? (
        <div className="commerce-shell-custom-cart-slot">
          {cartAffordanceSlot}
        </div>
      ) : showDefaultCartAffordance && (
        <AnimatePresence>
          {totalItemCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-6 right-6 z-40"
            >
              <Link
                href={`/${propertySlug}/${slug}/cart`}
                className="flex items-center gap-3 bg-primary-600 hover:bg-primary-700 text-white px-5 py-3.5 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-primary-500/30"
                aria-label={`View Cart with ${totalItemCount} items`}
              >
                <div className="relative">
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-2 -right-2.5 bg-white text-primary-700 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                    {totalItemCount}
                  </span>
                </div>
                <span className="font-semibold text-sm">
                  {t('viewCart') || 'View Cart'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export default CommerceShell;
