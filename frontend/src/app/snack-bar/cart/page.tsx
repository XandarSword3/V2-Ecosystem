'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { snackApi } from '@/lib/api';
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
  Cookie,
  Phone,
  User,
  MapPin,
  CreditCard,
  Banknote,
} from 'lucide-react';

export default function SnackCartPage() {
  const t = useTranslations('snackBar');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const currency = useSettingsStore((s) => s.currency);

  // Handle hydration - cart is empty on server, populated on client
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Fix: derive snackItems from main items array
  const snackItems = useCartStore((s) => s.items.filter(i => i.moduleId === 'snack-bar'));
  
  const addToSnack = useCartStore((s) => s.addToSnack);
  const removeFromSnack = useCartStore((s) => s.removeFromSnack);
  const clearSnackCart = useCartStore((s) => s.clearSnackCart);
  const getSnackTotal = useCartStore((s) => s.getSnackTotal);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [notes, setNotes] = useState('');

  const cartTotal = getSnackTotal();

  interface SnackOrderData {
    customerName: string;
    customerPhone: string;
    pickupLocation?: string;
    paymentMethod: 'cash' | 'card';
    notes?: string;
    items: Array<{ itemId: string; quantity: number; notes?: string }>;
  }

  interface MutationError {
    response?: { data?: { error?: string } };
    message?: string;
  }

  const orderMutation = useMutation({
    mutationFn: (data: SnackOrderData) => snackApi.createOrder(data),
    onSuccess: (response) => {
      clearSnackCart();
      toast.success(t('orderPlaced'));
      router.push(`/snack-bar/confirmation?id=${response.data.data.id}`);
    },
    onError: (err: MutationError) => {
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
    if (snackItems.length === 0) {
      toast.error(t('cartEmpty'));
      return;
    }

    orderMutation.mutate({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      pickupLocation: pickupLocation.trim() || 'Pool Area',
      paymentMethod,
      notes: notes.trim(),
      items: snackItems.map((item) => ({
        itemId: item.id,
        quantity: item.quantity,
      })),
    });
  };

  // Show loading state during hydration to prevent hydration mismatch
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (snackItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-white dark:bg-slate-800 p-12 rounded-3xl shadow-xl max-w-md mx-4"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Cookie className="w-20 h-20 text-amber-400 mx-auto mb-6" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {t('cartEmpty')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {t('addSomeSnacks')}
          </p>
          <Link href="/snack-bar">
            <Button className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('browseSnacks')}
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <Link href="/snack-bar">
            <Button variant="outline" size="sm" className="w-10 h-10 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-amber-500" />
              {t('yourCart')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {snackItems.length} {tCommon('items')}
            </p>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {snackItems.map((item) => (
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
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-lg flex items-center justify-center">
                      <span className="text-3xl">
                        {item.category === 'sandwich' ? '🥪' :
                         item.category === 'drink' ? '🥤' :
                         item.category === 'ice_cream' ? '🍦' : '🍟'}
                      </span>
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {item.name}
                      </h3>
                      <p className="text-amber-600 font-medium">
                        {formatCurrency(item.price, currency)}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeFromSnack(item.id)}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-600 dark:text-slate-400 hover:text-red-600"
                      >
                        {item.quantity === 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                      </motion.button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => addToSnack({ id: item.id, name: item.name, price: item.price, category: item.category })}
                        className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600"
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
              <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
                <CardTitle>{t('orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
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
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {t('pickupLocation')}
                    </label>
                    <select
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      className="input w-full mt-1"
                    >
                      <option value="">{t('selectLocation')}</option>
                      <option value="Pool Area">{t('locations.poolArea')}</option>
                      <option value="Beach">{t('locations.beach')}</option>
                      <option value="Snack Bar Counter">{t('locations.counter')}</option>
                    </select>
                  </div>
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
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <Banknote className={`w-5 h-5 ${paymentMethod === 'cash' ? 'text-amber-600' : 'text-slate-400'}`} />
                      <span className="text-sm">{t('cash')}</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${
                        paymentMethod === 'card'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <CreditCard className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-amber-600' : 'text-slate-400'}`} />
                      <span className="text-sm">{t('card')}</span>
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('specialNotes')}
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
                    <span>{formatCurrency(cartTotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>{tCommon('total')}</span>
                    <span className="text-amber-600">{formatCurrency(cartTotal, currency)}</span>
                  </div>
                </div>

                <Button
                  onClick={handlePlaceOrder}
                  disabled={orderMutation.isPending}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
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
