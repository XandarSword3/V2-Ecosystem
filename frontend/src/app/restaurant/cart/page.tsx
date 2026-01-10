'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { restaurantApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useCartStore } from '@/lib/stores/cartStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import {
  ShoppingCart,
  ArrowLeft,
  Minus,
  Plus,
  Trash2,
  Loader2,
  UtensilsCrossed,
  Phone,
  User,
  MapPin,
  CreditCard,
  Banknote,
  MessageSquare,
} from 'lucide-react';

export default function RestaurantCartPage() {
  const t = useTranslations('restaurant');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const currency = useSettingsStore((s) => s.currency);

  // Fix: derive restaurantItems from main items array
  const restaurantItems = useCartStore((s) => s.items.filter(i => i.moduleId === 'restaurant'));
  
  const addToRestaurant = useCartStore((s) => s.addToRestaurant);
  const removeFromRestaurant = useCartStore((s) => s.removeFromRestaurant);
  const updateRestaurantInstructions = useCartStore((s) => s.updateRestaurantInstructions);
  const clearRestaurantCart = useCartStore((s) => s.clearRestaurantCart);
  const getRestaurantTotal = useCartStore((s) => s.getRestaurantTotal);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [notes, setNotes] = useState('');

  const subtotal = getRestaurantTotal();
  const tax = subtotal * 0.11; // 11% VAT
  const total = subtotal + tax;

  const orderMutation = useMutation({
    mutationFn: (data: any) => restaurantApi.createOrder(data),
    onSuccess: (response) => {
      clearRestaurantCart();
      toast.success(t('orderPlaced'));
      router.push(`/restaurant/confirmation?id=${response.data.data.id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('orderFailed'));
    },
  });

  const handlePlaceOrder = () => {
    if (!customerName.trim()) {
      toast.error(t('enterName'));
      return;
    }
    if (!customerPhone.trim()) {
      toast.error(t('enterPhone'));
      return;
    }
    if (orderType === 'dine_in' && !tableNumber.trim()) {
      toast.error(t('enterTableNumber'));
      return;
    }
    // Delivery orders don't require table number
    if (restaurantItems.length === 0) {
      toast.error(t('cartEmpty'));
      return;
    }

    orderMutation.mutate({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      tableNumber: orderType === 'dine_in' ? tableNumber.trim() : null,
      orderType,
      paymentMethod,
      specialRequests: notes.trim(),
      items: restaurantItems.map((item) => ({
        menuItemId: item.id,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions,
      })),
    });
  };

  if (restaurantItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-white dark:bg-slate-800 p-12 rounded-3xl shadow-xl max-w-md mx-4"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <UtensilsCrossed className="w-20 h-20 text-orange-400 mx-auto mb-6" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {t('cartEmpty')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {t('addSomeItems')}
          </p>
          <Link href="/restaurant">
            <Button className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('browseMenu')}
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-red-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <Link href="/restaurant">
            <Button variant="outline" size="sm" className="w-10 h-10 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-orange-500" />
              {t('yourOrder')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {restaurantItems.length} {tCommon('items')}
            </p>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {restaurantItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-md border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-4">
                    {/* Image placeholder */}
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30 rounded-lg flex items-center justify-center">
                      <UtensilsCrossed className="w-8 h-8 text-orange-400" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {item.name}
                      </h3>
                      <p className="text-orange-600 font-medium">
                        {formatCurrency(item.price, currency)}
                      </p>
                      {item.specialInstructions && (
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {item.specialInstructions}
                        </p>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeFromRestaurant(item.id)}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-600 dark:text-slate-400 hover:text-red-600"
                      >
                        {item.quantity === 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                      </motion.button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => addToRestaurant({ id: item.id, name: item.name, price: item.price })}
                        className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600"
                      >
                        <Plus className="w-4 h-4" />
                      </motion.button>
                    </div>

                    {/* Line Total */}
                    <div className="text-right">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(item.price * item.quantity, currency)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-t-lg">
                <CardTitle>{t('orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {/* Order Type */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    {t('orderType')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setOrderType('dine_in')}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        orderType === 'dine_in'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="text-sm font-medium">{t('dineIn')}</span>
                    </button>
                    <button
                      onClick={() => setOrderType('takeaway')}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        orderType === 'takeaway'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="text-sm font-medium">{t('takeaway')}</span>
                    </button>
                    <button
                      onClick={() => setOrderType('delivery')}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        orderType === 'delivery'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="text-sm font-medium">{t('delivery') || 'Delivery'}</span>
                    </button>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {t('yourName')}
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={t('enterName')}
                      className="input w-full mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {t('phoneNumber')}
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder={t('enterPhone')}
                      className="input w-full mt-1"
                    />
                  </div>
                  {orderType === 'dine_in' && (
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {t('tableNumber')}
                      </label>
                      <input
                        type="text"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        placeholder={t('enterTableNumber')}
                        className="input w-full mt-1"
                      />
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    {t('paymentMethod')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${
                        paymentMethod === 'cash'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Banknote className={`w-5 h-5 ${paymentMethod === 'cash' ? 'text-orange-600' : 'text-slate-400'}`} />
                      <span className="text-sm">{t('cash')}</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${
                        paymentMethod === 'card'
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <CreditCard className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-orange-600' : 'text-slate-400'}`} />
                      <span className="text-sm">{t('card')}</span>
                    </button>
                  </div>
                </div>

                {/* Special Requests */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('specialRequests')}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('anySpecialRequests')}
                    rows={2}
                    className="input w-full mt-1"
                  />
                </div>

                {/* Totals */}
                <div className="border-t dark:border-slate-700 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{t('subtotal')}</span>
                    <span>{formatCurrency(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{t('tax')} (11%)</span>
                    <span>{formatCurrency(tax, currency)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>{tCommon('total')}</span>
                    <span className="text-orange-600">{formatCurrency(total, currency)}</span>
                  </div>
                </div>

                <Button
                  onClick={handlePlaceOrder}
                  disabled={orderMutation.isPending}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                >
                  {orderMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {tCommon('processing')}
                    </>
                  ) : (
                    t('placeOrder')
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
