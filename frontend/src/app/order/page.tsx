'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Clock,
  Flame,
  Star,
  Leaf,
  AlertCircle,
  ChefHat,
  ArrowLeft,
} from 'lucide-react';
import Image from 'next/image';
import { useSiteSettings } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/utils';

interface MenuItem {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  price: number;
  discount_price?: number;
  category_id: string;
  image_url?: string;
  is_available: boolean;
  is_featured: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  is_spicy: boolean;
  preparation_time_minutes?: number;
  calories?: number;
  allergens?: string[];
  category?: {
    id: string;
    name: string;
    name_ar?: string;
    name_fr?: string;
  };
}

interface CartItem extends MenuItem {
  quantity: number;
  notes?: string;
}

interface Category {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  items: MenuItem[];
}

function TableOrderContent() {
  const t = useTranslations('restaurant');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const router = useRouter();
  const tableNumber = searchParams.get('table');
  
  const { modules, settings } = useSiteSettings();
  // Using formatCurrency from utils

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');

  const restaurantModule = modules?.find(m => m.template_type === 'menu_service' && m.slug === 'restaurant' && m.is_active);

  const fetchMenu = useCallback(async () => {
    try {
      const moduleParam = restaurantModule?.id ? `?moduleId=${restaurantModule.id}` : '';
      const response = await api.get(`/restaurant/menu${moduleParam}`);
      const menuData = response.data.data?.menuByCategory || [];
      setCategories(menuData);
      if (menuData.length > 0) {
        setSelectedCategory(menuData[0].id);
      }
    } catch (error) {
      console.error('Failed to load menu:', error);
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, [restaurantModule?.id]);

  useEffect(() => {
    if (!tableNumber) {
      toast.error('Invalid table. Please scan the QR code again.');
      return;
    }
    fetchMenu();
  }, [tableNumber, fetchMenu]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} added to cart`);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === itemId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => {
      const price = item.discount_price || item.price;
      return sum + (price * item.quantity);
    }, 0);
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        table_number: parseInt(tableNumber!),
        customer_name: customerName || `Table ${tableNumber}`,
        items: cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          unit_price: item.discount_price || item.price,
          notes: item.notes,
        })),
        module_id: restaurantModule?.id,
      };

      await api.post('/restaurant/orders', orderData);
      toast.success('Order submitted successfully! A server will bring your food shortly.');
      setCart([]);
      setShowCart(false);
      setCustomerName('');
    } catch (error: any) {
      console.error('Order submission failed:', error);
      toast.error(error.response?.data?.message || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!tableNumber) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Invalid Table
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Please scan the QR code on your table to place an order.
            </p>
            <Button onClick={() => router.push('/restaurant')}>
              Go to Restaurant
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const selectedCategoryData = categories.find(c => c.id === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white p-2 rounded-xl">
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  {settings.resortName || 'V2 Resort'} Restaurant
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Table {tableNumber}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCart(true)}
              className="relative p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="sticky top-[73px] z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {selectedCategoryData?.items
            .filter(item => item.is_available)
            .map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700"
              >
                {item.image_url && (
                  <div className="relative h-40 overflow-hidden">
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                    {item.is_featured && (
                      <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" /> Featured
                      </span>
                    )}
                  </div>
                )}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {item.name}
                    </h3>
                    <div className="text-right">
                      {item.discount_price ? (
                        <>
                          <span className="text-green-600 font-bold">
                            {formatCurrency(item.discount_price)}
                          </span>
                          <span className="text-slate-400 text-sm line-through ml-1">
                            {formatCurrency(item.price)}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-900 dark:text-white font-bold">
                          {formatCurrency(item.price)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {item.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                      {item.description}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.is_spicy && (
                      <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Flame className="w-3 h-3" /> Spicy
                      </span>
                    )}
                    {item.is_vegetarian && (
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Leaf className="w-3 h-3" /> Vegetarian
                      </span>
                    )}
                    {item.preparation_time_minutes && (
                      <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {item.preparation_time_minutes} min
                      </span>
                    )}
                  </div>

                  <Button 
                    onClick={() => addToCart(item)}
                    className="w-full"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add to Order
                  </Button>
                </div>
              </motion.div>
            ))}
        </div>

        {selectedCategoryData?.items.filter(item => item.is_available).length === 0 && (
          <div className="text-center py-12">
            <ChefHat className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              No items available in this category
            </p>
          </div>
        )}
      </div>

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowCart(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-800 z-50 shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Your Order
                </h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">
                      Your cart is empty
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div
                        key={item.id}
                        className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"
                      >
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900 dark:text-white">
                            {item.name}
                          </h4>
                          <p className="text-sm text-blue-600 dark:text-blue-400">
                            {formatCurrency(item.discount_price || item.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 rounded bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium text-slate-900 dark:text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 rounded bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Customer Name */}
                    <div className="pt-4">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Your Name (optional)
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-600 dark:text-slate-400">Total</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(getCartTotal())}
                    </span>
                  </div>
                  <Button
                    onClick={submitOrder}
                    className="w-full"
                    size="lg"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                        />
                        Submitting...
                      </>
                    ) : (
                      'Submit Order'
                    )}
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TableOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    }>
      <TableOrderContent />
    </Suspense>
  );
}
