'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Heart, Trash2, ShoppingBag, X, AlertCircle } from 'lucide-react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { formatCurrency } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { toast } from 'sonner';
import Link from 'next/link';

// Wishlist store
interface WishlistItem {
  id: string;
  type: 'chalet' | 'menu-item' | 'pool-session';
  name: string;
  price: number;
  imageUrl?: string;
  addedAt: Date;
}

interface WishlistStore {
  items: WishlistItem[];
  addItem: (item: Omit<WishlistItem, 'addedAt'>) => void;
  removeItem: (id: string) => void;
  isInWishlist: (id: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const exists = get().items.some(i => i.id === item.id);
        if (!exists) {
          set(state => ({
            items: [...state.items, { ...item, addedAt: new Date() }],
          }));
        }
      },
      removeItem: (id) => {
        set(state => ({
          items: state.items.filter(i => i.id !== id),
        }));
      },
      isInWishlist: (id) => get().items.some(i => i.id === id),
      clearWishlist: () => set({ items: [] }),
    }),
    {
      name: 'v2-wishlist',
    }
  )
);

// Wishlist Button Component
export function WishlistButton({ 
  item, 
  className = '' 
}: { 
  item: Omit<WishlistItem, 'addedAt'>; 
  className?: string;
}) {
  const t = useTranslations('wishlist');
  const { addItem, removeItem, isInWishlist } = useWishlistStore();
  const isWishlisted = isInWishlist(item.id);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isWishlisted) {
      removeItem(item.id);
      toast.success(t('removedFromWishlist'));
    } else {
      addItem(item);
      toast.success(t('addedToWishlist'));
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={toggleWishlist}
      className={`
        relative w-10 h-10 rounded-full flex items-center justify-center
        transition-all duration-300 ${className}
        ${isWishlisted 
          ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
          : 'bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20'
        }
      `}
      aria-label={isWishlisted ? t('removeFromWishlist') : t('addToWishlist')}
    >
      <Heart 
        className={`w-5 h-5 transition-all ${isWishlisted ? 'fill-current' : ''}`}
      />
      
      {/* Burst animation on add */}
      <AnimatePresence>
        {isWishlisted && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-full border-2 border-red-500"
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// Wishlist Panel Component
export function WishlistPanel({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const t = useTranslations('wishlist');
  const { items, removeItem, clearWishlist } = useWishlistStore();
  const currency = useSettingsStore(s => s.currency);

  const getItemLink = (item: WishlistItem) => {
    switch (item.type) {
      case 'chalet':
        return `/chalets/${item.id}`;
      case 'menu-item':
        return '/restaurant';
      case 'pool-session':
        return '/pool';
      default:
        return '/';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white fill-current" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {t('title')}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('itemCount', { count: items.length })}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring' }}
                  >
                    <Heart className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  </motion.div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                    {t('emptyTitle')}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">
                    {t('emptyDescription')}
                  </p>
                  <Link href="/">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-medium shadow-lg"
                    >
                      {t('exploreNow')}
                    </motion.button>
                  </Link>
                </div>
              ) : (
                <motion.div layout className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl"
                      >
                        {/* Image */}
                        <div className="w-20 h-20 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                          {item.imageUrl ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="w-8 h-8 text-slate-400" />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <Link href={getItemLink(item)}>
                            <h4 className="font-medium text-slate-900 dark:text-white truncate hover:text-red-500 transition-colors">
                              {item.name}
                            </h4>
                          </Link>
                          <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                            {t(`type.${item.type}`)}
                          </p>
                          <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">
                            {formatCurrency(item.price, currency)}
                          </p>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="self-start w-8 h-8 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
                <button
                  onClick={() => {
                    clearWishlist();
                    toast.success(t('clearedWishlist'));
                  }}
                  className="w-full py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('clearAll')}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
