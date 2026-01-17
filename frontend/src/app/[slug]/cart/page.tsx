'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { restaurantApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useCartStore } from '@/lib/stores/cartStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
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
  Sparkles,
  Clock,
  CheckCircle2,
  ChefHat,
  Truck,
  Store,
  Receipt,
} from 'lucide-react';

export default function ModuleCartPage() {
  const t = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const { modules, loading: modulesLoading } = useSiteSettings();
  
  const normalizedSlug = slug ? decodeURIComponent(slug).toLowerCase() : '';
  const currentModule = modules.find((m) => m.slug.toLowerCase() === normalizedSlug);
  const moduleId = currentModule?.id;

  const currency = useSettingsStore((s) => s.currency);

  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const items = useCartStore((s) => s.items);
  const moduleItems = moduleId ? items.filter(i => i.moduleId === moduleId) : [];
  
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [notes, setNotes] = useState('');
  const [activeStep, setActiveStep] = useState(1);

  const subtotal = moduleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.11;
  const total = subtotal + tax;

  interface OrderData {
    customerName: string;
    customerPhone: string;
    tableNumber?: string;
    orderType: 'dine_in' | 'takeaway' | 'delivery';
    paymentMethod: 'cash' | 'card';
    notes?: string;
    items: Array<{ menuItemId: string; quantity: number; specialInstructions?: string }>;
    moduleId?: string;
  }

  interface MutationError {
    response?: { data?: { error?: string } };
    message?: string;
  }

  const orderMutation = useMutation({
    mutationFn: (data: OrderData) => restaurantApi.createOrder(data),
    onSuccess: () => {
      moduleItems.forEach(item => removeItem(item.id));
      toast.success(t('orderPlaced') || 'Order placed successfully!');
      router.push(`/${slug}`);
      toast.success('Order confirmed. Check your email for details.');
    },
    onError: (err: MutationError) => {
      toast.error(err.response?.data?.error || t('orderFailed') || 'Failed to place order');
    },
  });

  const handlePlaceOrder = () => {
    if (!customerName.trim()) {
      toast.error(t('enterName') || 'Please enter your name');
      setActiveStep(2);
      return;
    }
    if (!customerPhone.trim()) {
      toast.error(t('enterPhone') || 'Please enter your phone number');
      setActiveStep(2);
      return;
    }
    if (orderType === 'dine_in' && !tableNumber.trim()) {
      toast.error(t('enterTableNumber') || 'Please enter your table number');
      setActiveStep(2);
      return;
    }
    if (moduleItems.length === 0) {
      toast.error(t('cartEmpty') || 'Your cart is empty');
      return;
    }

    orderMutation.mutate({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      tableNumber: orderType === 'dine_in' ? tableNumber.trim() : undefined,
      orderType,
      paymentMethod,
      notes: notes.trim(),
      items: moduleItems.map((item) => ({
        menuItemId: item.id,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions,
      })),
      moduleId,
    });
  };

  if (!isHydrated) {
    return null;
  }

  if (modulesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary-500" />
      </div>
    );
  }

  if (!currentModule) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{t('moduleNotFound') || 'Module Not Found'}</h2>
        <p className="text-slate-500 mb-4">{t('couldNotFindModule') || 'Could not find module'}: {slug}</p>
        <Link href="/">
          <Button>{t('returnHome') || 'Return Home'}</Button>
        </Link>
      </div>
    );
  }

  // Empty cart state
  if (moduleItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative text-center max-w-lg mx-auto"
        >
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-gradient-to-br from-orange-200 to-amber-200 dark:from-orange-900/20 dark:to-amber-900/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-gradient-to-br from-rose-200 to-pink-200 dark:from-rose-900/20 dark:to-pink-900/20 rounded-full blur-3xl" />
          
          <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-12 rounded-3xl shadow-2xl border border-white/50 dark:border-slate-800/50">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0], y: [0, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-full flex items-center justify-center"
            >
              <ChefHat className="w-12 h-12 text-orange-500" />
            </motion.div>
            
            <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-rose-600 bg-clip-text text-transparent mb-3">
              {t('cartEmpty') || 'Your cart is empty'}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">
              Add some delicious items to get started!
            </p>
            
            <Link href={`/${slug}`}>
              <Button size="lg" className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:via-amber-600 hover:to-orange-600 shadow-lg shadow-orange-500/30 px-8">
                <UtensilsCrossed className="w-5 h-5 mr-2" />
                {t('backToMenu') || 'Back to Menu'}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const orderTypeOptions = [
    { value: 'dine_in', label: t('dineIn') || 'Dine In', icon: Store, description: 'Enjoy at our venue' },
    { value: 'takeaway', label: t('takeaway') || 'Takeaway', icon: ShoppingCart, description: 'Pick up when ready' },
    { value: 'delivery', label: t('delivery') || 'Delivery', icon: Truck, description: 'Delivered to your door' },
  ];

  const steps = [
    { id: 1, title: 'Review Order', icon: ShoppingCart },
    { id: 2, title: 'Your Details', icon: User },
    { id: 3, title: 'Payment', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-orange-200/40 to-amber-200/40 dark:from-orange-900/10 dark:to-amber-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-rose-200/40 to-pink-200/40 dark:from-rose-900/10 dark:to-pink-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href={`/${slug}`} className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {currentModule.name}</span>
          </Link>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600 bg-clip-text text-transparent">
                {currentModule.name} Checkout
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Complete your order • {moduleItems.length} {moduleItems.length === 1 ? 'item' : 'items'}
              </p>
            </div>
            
            {/* Step Indicator */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center flex-shrink-0">
                  <motion.button
                    onClick={() => setActiveStep(step.id)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                      activeStep === step.id
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30'
                        : activeStep > step.id
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-white/60 dark:bg-slate-800/60 text-slate-500'
                    }`}
                  >
                    {activeStep > step.id ? <CheckCircle2 className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                    <span className="text-sm font-medium whitespace-nowrap">{step.title}</span>
                  </motion.button>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-0.5 mx-1 ${activeStep > step.id ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Step 1: Order Review */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 dark:border-slate-800/50 overflow-hidden transition-opacity ${activeStep !== 1 ? 'opacity-60' : ''}`}
            >
              <div 
                className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setActiveStep(1)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeStep >= 1 ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Order</h2>
                    <p className="text-sm text-slate-500">{moduleItems.length} items • {formatCurrency(subtotal, currency)}</p>
                  </div>
                </div>
                {activeStep > 1 && <CheckCircle2 className="w-6 h-6 text-green-500" />}
              </div>

              <AnimatePresence>
                {activeStep === 1 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-6 space-y-4"
                  >
                    {moduleItems.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group relative bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-800 rounded-2xl p-4 hover:shadow-lg transition-all duration-300 border border-slate-100 dark:border-slate-700/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center flex-shrink-0">
                            {item.imageUrl ? (
                              <span className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${item.imageUrl})` }} />
                            ) : (
                              <UtensilsCrossed className="w-8 h-8 text-orange-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 dark:text-white text-lg truncate">{item.name}</h3>
                            <p className="text-orange-600 dark:text-orange-400 font-medium">
                              {formatCurrency(item.price, currency)} each
                            </p>
                          </div>

                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-full p-1">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                if (item.quantity === 1) {
                                  removeItem(item.id);
                                } else {
                                  addItem({ ...item, quantity: -1 });
                                }
                              }}
                              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors"
                            >
                              {item.quantity === 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                            </motion.button>
                            <span className="w-10 text-center font-bold text-slate-900 dark:text-white">{item.quantity}</span>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => addItem({ ...item, quantity: 1 })}
                              className="w-9 h-9 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white flex items-center justify-center hover:shadow-lg hover:shadow-orange-500/30 transition-all"
                            >
                              <Plus className="w-4 h-4" />
                            </motion.button>
                          </div>

                          <div className="hidden sm:block text-right pl-4 border-l border-slate-200 dark:border-slate-700">
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                              {formatCurrency(item.price * item.quantity, currency)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    <div className="pt-4 flex justify-end">
                      <Button onClick={() => setActiveStep(2)} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 px-8">
                        Continue to Details
                        <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Step 2: Customer Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 dark:border-slate-800/50 overflow-hidden transition-opacity ${activeStep !== 2 ? 'opacity-60' : ''}`}
            >
              <div 
                className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setActiveStep(2)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeStep >= 2 ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your Details</h2>
                    <p className="text-sm text-slate-500">Contact & order type</p>
                  </div>
                </div>
                {activeStep > 2 && <CheckCircle2 className="w-6 h-6 text-green-500" />}
              </div>

              <AnimatePresence>
                {activeStep === 2 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-6 space-y-6"
                  >
                    <div>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 block">
                        How would you like to receive your order?
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {orderTypeOptions.map((option) => (
                          <motion.button
                            key={option.value}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setOrderType(option.value as typeof orderType)}
                            className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
                              orderType === option.value
                                ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 shadow-lg shadow-orange-500/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700'
                            }`}
                          >
                            {orderType === option.value && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2">
                                <CheckCircle2 className="w-5 h-5 text-orange-500" />
                              </motion.div>
                            )}
                            <option.icon className={`w-8 h-8 mb-3 ${orderType === option.value ? 'text-orange-500' : 'text-slate-400'}`} />
                            <p className={`font-semibold ${orderType === option.value ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>
                              {option.label}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <User className="w-4 h-4 text-orange-500" />
                          Your Name
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Enter your full name"
                          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-orange-500" />
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="Enter your phone number"
                          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    {orderType === 'dine_in' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-orange-500" />
                          Table Number
                        </label>
                        <input
                          type="text"
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          placeholder="Enter your table number"
                          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                      </motion.div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-orange-500" />
                        Special Requests
                        <span className="text-xs font-normal text-slate-400">(Optional)</span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any allergies, preferences, or special requests..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
                      />
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button variant="outline" onClick={() => setActiveStep(1)}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                      <Button onClick={() => setActiveStep(3)} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/25 px-8">
                        Continue to Payment
                        <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Step 3: Payment */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 dark:border-slate-800/50 overflow-hidden transition-opacity ${activeStep !== 3 ? 'opacity-60' : ''}`}
            >
              <div 
                className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setActiveStep(3)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeStep >= 3 ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Payment Method</h2>
                    <p className="text-sm text-slate-500">Choose how to pay</p>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {activeStep === 3 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-6 space-y-6"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setPaymentMethod('cash')}
                        className={`relative p-6 rounded-2xl border-2 transition-all ${
                          paymentMethod === 'cash'
                            ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 shadow-lg shadow-orange-500/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
                        }`}
                      >
                        {paymentMethod === 'cash' && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3">
                            <CheckCircle2 className="w-5 h-5 text-orange-500" />
                          </motion.div>
                        )}
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                          <Banknote className={`w-8 h-8 ${paymentMethod === 'cash' ? 'text-green-600' : 'text-slate-400'}`} />
                        </div>
                        <p className={`font-semibold text-lg text-center ${paymentMethod === 'cash' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          Pay with Cash
                        </p>
                        <p className="text-sm text-slate-500 mt-1 text-center">Pay when you receive</p>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setPaymentMethod('card')}
                        className={`relative p-6 rounded-2xl border-2 transition-all ${
                          paymentMethod === 'card'
                            ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 shadow-lg shadow-orange-500/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
                        }`}
                      >
                        {paymentMethod === 'card' && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3">
                            <CheckCircle2 className="w-5 h-5 text-orange-500" />
                          </motion.div>
                        )}
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                          <CreditCard className={`w-8 h-8 ${paymentMethod === 'card' ? 'text-blue-600' : 'text-slate-400'}`} />
                        </div>
                        <p className={`font-semibold text-lg text-center ${paymentMethod === 'card' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          Pay with Card
                        </p>
                        <p className="text-sm text-slate-500 mt-1 text-center">Credit or debit</p>
                      </motion.button>
                    </div>

                    <div className="pt-4 flex justify-start">
                      <Button variant="outline" onClick={() => setActiveStep(2)}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="sticky top-24">
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 dark:border-slate-800/50 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 p-6 text-white relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-2">
                      <Receipt className="w-6 h-6" />
                      <h2 className="text-xl font-bold">Order Summary</h2>
                    </div>
                    <p className="text-orange-100 text-sm">Review your order before placing</p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {moduleItems.map((item) => (
                      <div key={item.id} className="flex justify-between items-start text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {item.quantity}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 line-clamp-1">{item.name}</span>
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white flex-shrink-0 ml-2">
                          {formatCurrency(item.price * item.quantity, currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-slate-200 dark:border-slate-700" />

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="text-slate-700 dark:text-slate-300">{formatCurrency(subtotal, currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Tax (11%)</span>
                      <span className="text-slate-700 dark:text-slate-300">{formatCurrency(tax, currency)}</span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
                        <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-rose-600 bg-clip-text text-transparent">
                          {formatCurrency(total, currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(customerName || orderType) && (
                    <>
                      <div className="border-t border-slate-200 dark:border-slate-700" />
                      <div className="space-y-2 text-sm">
                        {customerName && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <User className="w-4 h-4" />
                            <span>{customerName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          {orderType === 'dine_in' && <Store className="w-4 h-4" />}
                          {orderType === 'takeaway' && <ShoppingCart className="w-4 h-4" />}
                          {orderType === 'delivery' && <Truck className="w-4 h-4" />}
                          <span>{orderTypeOptions.find(o => o.value === orderType)?.label}</span>
                          {orderType === 'dine_in' && tableNumber && <span>• Table {tableNumber}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          {paymentMethod === 'cash' ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                          <span>{paymentMethod === 'cash' ? 'Cash' : 'Card'}</span>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Estimated Time</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">15-25 minutes</p>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handlePlaceOrder}
                    disabled={orderMutation.isPending}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:via-amber-600 hover:to-orange-600 text-white font-bold text-lg rounded-2xl shadow-xl shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                  >
                    {orderMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Place Order • {formatCurrency(total, currency)}
                      </>
                    )}
                  </motion.button>

                  <p className="text-xs text-center text-slate-400">
                    🔒 Your order information is secure and encrypted
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
