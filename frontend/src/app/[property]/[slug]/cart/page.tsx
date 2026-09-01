'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useCartStore, calculateSubtotal } from '@/stores/cartStore';
import { usePricingPreview } from '@/hooks/usePricingPreview';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { getStoredPropertyId } from '@/lib/property-id';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { AuthModal } from '@/components/auth/AuthModal';
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
  Tag,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { PaymentDiscounts } from '@/components/customer/PaymentDiscounts';
import StripePayment from '@/components/payments/StripePayment';
import { Container } from '@/components/layout/Container';
import { FulfillmentModeSelector } from '@/components/customer/FulfillmentModeSelector';
import { DestinationRequirementsEditor } from '@/components/customer/DestinationRequirementsEditor';
import { CANONICAL_ENGINE_A_CAPABILITIES, type FulfillmentMode, type DestinationType } from '@/lib/engine-a/types';
import { CustomerShell } from '@/components/shells/CustomerShell';
import { ModuleShell } from '@/components/shells/ModuleShell';
import { ModuleProvider, resolveEngineACapabilities } from '@/components/shells/ModuleContext';

export default function ModuleCartPage() {
  const t = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const propertySlug = (params?.property as string) || '';
  const propertyId = getStoredPropertyId();

  const { modules, loading: modulesLoading } = useSiteSettings();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const normalizedSlug = slug ? decodeURIComponent(slug).toLowerCase() : '';
  const currentModule = modules.find((m) => m.slug.toLowerCase() === normalizedSlug);
  const moduleId = currentModule?.id;

  const currency = useSettingsStore((s) => s.currency);

  const [isHydrated, setIsHydrated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const items = useCartStore((s) => s.items);
  const moduleKey = moduleId || normalizedSlug;
  const moduleItems = moduleId
    ? items.filter(i => i.moduleId === moduleId || i.moduleSlug === normalizedSlug)
    : items.filter(i => i.moduleSlug === normalizedSlug);
  
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearModuleItems = useCartStore((s) => s.clearModuleItems);
  const customerName = useCartStore((s) => s.customerName);
  const customerPhone = useCartStore((s) => s.customerPhone);
  const paymentMethod = useCartStore((s) => s.paymentMethod);
  const notes = useCartStore((s) => s.notes);
  const setCustomerName = useCartStore((s) => s.setCustomerName);
  const setCustomerPhone = useCartStore((s) => s.setCustomerPhone);
  const setPaymentMethod = useCartStore((s) => s.setPaymentMethod);
  const setNotes = useCartStore((s) => s.setNotes);

  const rawSelection = useCartStore((s) => moduleKey ? s.getFulfillmentForModule(moduleKey) : undefined);
  const setFulfillmentForModule = useCartStore((s) => s.setFulfillmentForModule);

  // Module-scoped discount state from cartStore
  const couponCode = useCartStore((s) => moduleKey ? s.getCouponForModule(moduleKey) : null);
  const giftCardCodes = useCartStore((s) => moduleKey ? s.getGiftCardsForModule(moduleKey) : []);
  const loyaltyPoints = useCartStore((s) => moduleKey ? s.getLoyaltyPointsForModule(moduleKey) : 0);
  const setCouponForModule = useCartStore((s) => s.setCouponForModule);
  const addGiftCardForModule = useCartStore((s) => s.addGiftCardForModule);
  const removeGiftCardForModule = useCartStore((s) => s.removeGiftCardForModule);
  const setLoyaltyPointsForModule = useCartStore((s) => s.setLoyaltyPointsForModule);

  const capabilities = (currentModule ? resolveEngineACapabilities(currentModule) : null) || CANONICAL_ENGINE_A_CAPABILITIES;
  const fulfillmentOptions = capabilities?.fulfillment?.options || CANONICAL_ENGINE_A_CAPABILITIES.fulfillment.options;

  const selectedMode: FulfillmentMode = rawSelection?.mode || (fulfillmentOptions[0]?.mode ?? 'on_premise');
  const selectedDestinationType: DestinationType = rawSelection?.destinationType || (selectedMode === 'none' ? 'none' : 'on_premise_location');
  const selectedDestinationRef = rawSelection?.destinationRef ?? null;

  const handleSelectMode = (mode: FulfillmentMode) => {
    let destType: DestinationType = 'none';
    if (mode === 'on_premise') destType = 'on_premise_location';
    else if (mode === 'pickup') destType = 'pickup_location';
    else if (mode === 'local_delivery' || mode === 'shipment') destType = 'address';
    else if (mode === 'digital_delivery') destType = 'digital_account';
    else if (mode === 'service_execution') destType = 'service_location';

    if (moduleKey) {
      setFulfillmentForModule(moduleKey, {
        mode,
        destinationType: destType,
        destinationRef: mode === selectedMode ? selectedDestinationRef : null,
      });
    }
  };

  const handleDestinationChange = (destType: DestinationType, destRef: string | null) => {
    if (moduleKey) {
      setFulfillmentForModule(moduleKey, {
        mode: selectedMode,
        destinationType: destType,
        destinationRef: destRef,
      });
    }
  };

  const [serviceLocations, setServiceLocations] = useState<Array<{ id: string; name: string; is_active: boolean; is_occupied?: boolean }>>([]);
  const [activeStep, setActiveStep] = useState(1);

  // Stripe payment state
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Authoritative server-side pricing preview hook with stale invalidation
  const {
    pricing: serverPricing,
    isLoading: loadingPricing,
    isStale: isPricingStale,
    isError: isPricingError,
    error: pricingError,
    refetch: refetchPricing,
  } = usePricingPreview({
    items: moduleItems,
    moduleId,
    propertyId,
    fulfillmentMode: selectedMode,
    paymentMethod,
    couponCode,
    giftCardCodes,
    loyaltyPointsToRedeem: loyaltyPoints,
    customerId: user?.id,
    enabled: moduleItems.length > 0 && !!moduleId,
  });

  // Harmless local UI arithmetic for ephemeral presentation estimate
  const localEstimatedSubtotal = calculateSubtotal(moduleItems);

  // Authoritative money derivations strictly from server
  const subtotal = serverPricing?.subtotal ?? localEstimatedSubtotal;
  const tax = serverPricing?.taxAmount ?? 0;
  const taxBreakdown = serverPricing?.taxBreakdown ?? [];
  const feeBreakdown = serverPricing?.feeBreakdown ?? [];
  const totalFees = feeBreakdown.reduce((sum: number, fee: any) => sum + fee.amount, 0);
  const serviceCharge = serverPricing?.serviceCharge ?? 0;
  const deliveryFee = serverPricing?.deliveryFee ?? 0;
  const totalDiscount = serverPricing?.totalDiscount ?? 0;
  const appliedDiscounts = serverPricing?.discounts ?? [];
  const total = serverPricing?.totalAmount ?? Math.max(0, localEstimatedSubtotal);
  const resolvedCurrency = serverPricing?.currency || currency || 'USD';

  // Fetch service locations for this module & auto-fill from URL query param
  useEffect(() => {
    if (!slug) return;
    api.get(`/${slug}/service-locations`).then((res) => {
      if (res.data?.success && Array.isArray(res.data.data)) {
        const activeLocs = res.data.data.filter((l: any) => l.is_active !== false);
        setServiceLocations(activeLocs);

        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const urlLoc = urlParams.get('location') || urlParams.get('table') || urlParams.get('service_location_id');
          if (urlLoc) {
            const matched = activeLocs.find((l: any) => l.id === urlLoc || l.name.toLowerCase() === urlLoc.toLowerCase());
            if (matched && !matched.is_occupied) {
              handleDestinationChange('on_premise_location', matched.id);
            } else if (!matched) {
              handleDestinationChange('on_premise_location', urlLoc);
            }
          }
        }
      }
    }).catch(() => {});
  }, [slug]);

  interface MutationError {
    response?: { data?: { error?: string } };
    message?: string;
  }

  const orderMutation = useMutation({
    mutationFn: (data: any) => api.post(`/${slug}/orders`, data),
    onSuccess: (response) => {
      const order = response?.data?.data;
      const orderId = order?.id || order?.order_id || '';

      // For card payments, show Stripe checkout instead of redirecting
      if (paymentMethod === 'card' && total > 0) {
        setPendingOrderId(orderId);
        setShowStripePayment(true);
        toast.info('Complete your card payment');
      } else {
        if (moduleKey) clearModuleItems(moduleKey);
        toast.success('Order placed successfully!');
        router.push(`/${propertySlug}/${slug}/confirmation?type=order&id=${orderId}`);
      }
    },
    onError: (err: MutationError) => {
      if ((err as any).response?.status === 401) {
        setShowAuthModal(true);
        toast.error('Session expired. Please log in again.');
        return;
      }
      const errMsg = err.response?.data?.error || (err.response?.data as any)?.message || err.message || 'Failed to place order';
      toast.error(errMsg);
    },
  });

  // Stripe payment handlers
  const handleStripePaymentSuccess = () => {
    if (moduleKey) clearModuleItems(moduleKey);
    toast.success(t('orderPlaced') || 'Order placed successfully!');
    router.push(`/${propertySlug}/${slug}/confirmation?type=order&id=${pendingOrderId}`);
  };

  const handleStripePaymentError = (error: string) => {
    toast.error(`Payment failed: ${error}`);
  };

  const handleStripePaymentCancel = () => {
    setShowStripePayment(false);
    toast.info('Payment cancelled. Your order is still saved.');
  };

  const handlePlaceOrder = () => {
    if (!authLoading && !isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

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

    // Destination requirements validation per canonical mode
    if (
      selectedMode === 'on_premise' &&
      (!selectedDestinationRef || !serviceLocations.some(l => l.id === selectedDestinationRef))
    ) {
      toast.error(t('selectLocationOrTable') || 'Please select a valid table or service location');
      setActiveStep(2);
      return;
    }
    if ((selectedMode === 'local_delivery' || selectedMode === 'shipment') && (!selectedDestinationRef || !selectedDestinationRef.trim())) {
      toast.error(t('enterAddress') || 'Please enter your delivery/shipping address');
      setActiveStep(2);
      return;
    }
    if (selectedMode === 'digital_delivery' && (!selectedDestinationRef || !selectedDestinationRef.trim())) {
      toast.error(t('enterDigitalAccount') || 'Please enter your email or digital account handle');
      setActiveStep(2);
      return;
    }
    if (selectedMode === 'service_execution' && (!selectedDestinationRef || !selectedDestinationRef.trim())) {
      toast.error(t('enterServiceStation') || 'Please enter your service station/chair identifier');
      setActiveStep(2);
      return;
    }

    if (moduleItems.length === 0) {
      toast.error(t('cartEmpty') || 'Your cart is empty');
      return;
    }

    if (isPricingStale || loadingPricing) {
      toast.info('Pricing is recalculating, please wait a moment...');
      return;
    }

    if (isPricingError || !serverPricing) {
      toast.error('Unable to verify order pricing. Please try again.');
      return;
    }

    const couponDiscount = appliedDiscounts.find(d => d.type === 'coupon');
    const giftCardDiscounts = appliedDiscounts.filter(d => d.type === 'gift_card');
    const loyaltyDiscount = appliedDiscounts.find(d => d.type === 'loyalty');

    const idempotencyKey = `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

    orderMutation.mutate({
      idempotencyKey,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      paymentMethod,
      notes: notes.trim(),
      fulfillmentSelection: {
        mode: selectedMode,
        destinationType: selectedDestinationType,
        destinationRef: selectedDestinationRef,
      },
      items: moduleItems.map((item) => ({
        catalog_item_id: item.id,
        menuItemId: item.id,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions,
        metadata: item.selectedModifiers && item.selectedModifiers.length > 0
          ? { selectedModifiers: item.selectedModifiers }
          : undefined,
      })),
      moduleId,
      couponCode: couponCode || undefined,
      giftCardRedemptions: giftCardCodes.length > 0 
        ? giftCardCodes.map(code => ({ code, amount: giftCardDiscounts.find(g => g.code === code)?.amount || 0 }))
        : undefined,
      loyaltyPointsToRedeem: loyaltyPoints > 0 ? loyaltyPoints : undefined,
      loyaltyPointsDollarValue: loyaltyDiscount?.amount,
      previewTotal: total,
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
              Add some items to get started!
            </p>
            
            <Link href={`/${propertySlug}/${slug}`}>
              <Button>
                <UtensilsCrossed className="w-5 h-5 mr-2" />
                {t('backToMenu') || 'Back to Menu'}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const steps = [
    { id: 1, title: 'Review Order', icon: ShoppingCart },
    { id: 2, title: 'Your Details', icon: User },
    { id: 3, title: 'Payment', icon: CreditCard },
  ];

  const isCheckoutDisabled =
    orderMutation.isPending ||
    authLoading ||
    loadingPricing ||
    isPricingStale ||
    isPricingError ||
    !serverPricing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-orange-200/40 to-amber-200/40 dark:from-orange-900/10 dark:to-amber-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-rose-200/40 to-pink-200/40 dark:from-rose-900/10 dark:to-pink-900/10 rounded-full blur-3xl" />
      </div>

      <Container as="div" className="relative py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link href={`/${propertySlug}/${slug}`} className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors mb-4">
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
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-xl border border-white/50 dark:border-slate-800/50 space-y-6"
            >
              <AnimatePresence mode="wait">
                {activeStep === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Review Your Cart</h2>
                      <Button variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => moduleKey && clearModuleItems(moduleKey)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear {currentModule.name} Items
                      </Button>
                    </div>

                    {/* Cart Items List */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {moduleItems.map((item) => (
                        <div key={item.uniqueKey || item.id} className="py-4 flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-medium text-slate-900 dark:text-white">{item.name}</h3>
                            <p className="text-sm text-slate-500">{formatCurrency(item.price + (item.modifierTotal || 0), resolvedCurrency)} each</p>
                            {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.selectedModifiers.map((mod, i) => (
                                  <span
                                    key={i}
                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                      mod.modifierType === 'remove'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : mod.modifierType === 'swap'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    }`}
                                  >
                                    {mod.modifierType === 'remove' ? 'No ' : mod.modifierType === 'swap' ? 'Swap: ' : '+'}
                                    {mod.optionName}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => removeItem(item.id, item.uniqueKey)}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => addItem(item)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            <span className="font-bold w-20 text-right">
                              {formatCurrency((item.price + (item.modifierTotal || 0)) * item.quantity, resolvedCurrency)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button onClick={() => setActiveStep(2)}>
                        Continue to Details
                        <CheckCircle2 className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {activeStep === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Fulfillment & Details</h2>

                    {/* Canonical Fulfillment Selection */}
                    <div className="space-y-4">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        How would you like to receive your order?
                      </label>
                      <FulfillmentModeSelector
                        options={fulfillmentOptions}
                        selectedMode={selectedMode}
                        onSelectMode={handleSelectMode}
                      />
                      <DestinationRequirementsEditor
                        mode={selectedMode}
                        destinationType={selectedDestinationType}
                        destinationRef={selectedDestinationRef}
                        serviceLocations={serviceLocations}
                        onChange={handleDestinationChange}
                      />
                    </div>

                    {/* Customer Info */}
                    <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Your Name *</label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Enter your full name"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="Enter your phone number"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Special Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any dietary restrictions or instructions..."
                        rows={2}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button variant="outline" onClick={() => setActiveStep(1)}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                      <Button onClick={() => setActiveStep(3)}>
                        Continue to Payment
                        <CheckCircle2 className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {activeStep === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Payment Method & Discounts</h2>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setPaymentMethod('cash')}
                        className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
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
                        <p className="text-sm text-slate-500 mt-1 text-center">Pay at counter or on delivery</p>
                      </motion.button>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setPaymentMethod('card')}
                        className={`relative p-6 rounded-2xl border-2 text-left transition-all ${
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
                        <p className="text-sm text-slate-500 mt-1 text-center">Credit or debit card</p>
                      </motion.button>
                    </div>

                    {/* Discounts Section - Coupons, Gift Cards, Loyalty Points */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Tag className="w-5 h-5 text-orange-500" />
                        <h3 className="font-semibold text-slate-900 dark:text-white">Apply Discounts</h3>
                      </div>
                      <PaymentDiscounts
                        orderTotal={subtotal}
                        orderType={selectedMode}
                        moduleId={moduleId}
                        moduleSlug={currentModule?.slug}
                        onTotalChange={(_ignored, discounts) => {
                          if (!moduleKey) return;
                          const c = discounts.find(d => d.type === 'coupon');
                          setCouponForModule(moduleKey, c?.code || null);

                          const gcs = discounts.filter(d => d.type === 'giftcard');
                          gcs.forEach(gc => {
                            if (gc.code) addGiftCardForModule(moduleKey, gc.code);
                          });

                          const l = discounts.find(d => d.type === 'loyalty');
                          setLoyaltyPointsForModule(moduleKey, l?.pointsUsed || 0);
                        }}
                        className="mt-2"
                      />
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
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Receipt className="w-6 h-6" />
                        <h2 className="text-xl font-bold">Order Summary</h2>
                      </div>
                      {(loadingPricing || isPricingStale) && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs backdrop-blur-sm">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Updating...</span>
                        </div>
                      )}
                    </div>
                    <p className="text-orange-100 text-sm">Authoritative pricing from server</p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Pricing Error Banner */}
                  {isPricingError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold">Pricing update failed</p>
                        <p className="text-xs">{pricingError || 'Please retry or check cart items.'}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => refetchPricing()} className="h-7 px-2">
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {moduleItems.map((item) => (
                      <div key={item.uniqueKey || item.id} className="text-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {item.quantity}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300 line-clamp-1">{item.name}</span>
                          </div>
                          <span className="font-medium text-slate-900 dark:text-white flex-shrink-0 ml-2">
                            {formatCurrency((item.price + (item.modifierTotal || 0)) * item.quantity, resolvedCurrency)}
                          </span>
                        </div>
                        {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                          <div className="mt-1 ml-8 flex flex-wrap gap-1">
                            {item.selectedModifiers.map((mod, i) => (
                              <span
                                key={i}
                                className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  mod.modifierType === 'remove'
                                    ? 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400'
                                    : mod.modifierType === 'swap'
                                    ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                                    : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                                }`}
                              >
                                {mod.modifierType === 'remove' ? '−' : '+'} {mod.optionName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-slate-200 dark:border-slate-700" />

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {formatCurrency(subtotal, resolvedCurrency)}
                      </span>
                    </div>

                    {/* Show individual tax lines from backend breakdown */}
                    {taxBreakdown.length > 0 ? (
                      taxBreakdown.map((taxItem: any, index: number) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-slate-500">{taxItem.name} ({taxItem.rate}%)</span>
                          <span className="text-slate-700 dark:text-slate-300">{formatCurrency(taxItem.amount, resolvedCurrency)}</span>
                        </div>
                      ))
                    ) : tax > 0 ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Tax</span>
                        <span className="text-slate-700 dark:text-slate-300">{formatCurrency(tax, resolvedCurrency)}</span>
                      </div>
                    ) : null}

                    {/* Fees and service charges from backend */}
                    {serviceCharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Service Charge</span>
                        <span className="text-slate-700 dark:text-slate-300">{formatCurrency(serviceCharge, resolvedCurrency)}</span>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Delivery Fee</span>
                        <span className="text-slate-700 dark:text-slate-300">{formatCurrency(deliveryFee, resolvedCurrency)}</span>
                      </div>
                    )}
                    {feeBreakdown.map((fee: any, index: number) => (
                      <div key={fee.id ?? index} className="flex justify-between text-sm">
                        <span className="text-slate-500">
                          {fee.name}{fee.rate !== undefined ? ` (${fee.rate}%)` : ''}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300">{formatCurrency(fee.amount, resolvedCurrency)}</span>
                      </div>
                    ))}
                    
                    {/* Show applied discounts */}
                    {appliedDiscounts.length > 0 && (
                      <>
                        <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-2" />
                        {appliedDiscounts.map((discount, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                              {discount.type === 'coupon' && <Tag className="w-3 h-3" />}
                              {discount.type === 'gift_card' && <CreditCard className="w-3 h-3" />}
                              {discount.type === 'loyalty' && <Sparkles className="w-3 h-3" />}
                              {discount.name || (discount.type === 'coupon' ? `Coupon: ${discount.code}` : discount.type === 'gift_card' ? `Gift Card: ${discount.code}` : 'Loyalty Reward')}
                            </span>
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              -{formatCurrency(discount.amount, resolvedCurrency)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-semibold">
                          <span>Total Savings</span>
                          <span>-{formatCurrency(totalDiscount, resolvedCurrency)}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
                        <div className="text-right">
                          {totalDiscount > 0 && (
                            <span className="text-sm text-slate-400 line-through mr-2">
                              {formatCurrency(subtotal + tax + totalFees + serviceCharge + deliveryFee, resolvedCurrency)}
                            </span>
                          )}
                          <span className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-rose-600 bg-clip-text text-transparent">
                            {formatCurrency(total, resolvedCurrency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(customerName || selectedMode) && (
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
                          {selectedMode === 'on_premise' && <Store className="w-4 h-4" />}
                          {selectedMode === 'pickup' && <ShoppingCart className="w-4 h-4" />}
                          {(selectedMode === 'local_delivery' || selectedMode === 'shipment') && <Truck className="w-4 h-4" />}
                          <span className="capitalize">{selectedMode.replace('_', ' ')}</span>
                          {selectedDestinationRef && <span>• {selectedDestinationRef}</span>}
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
                    whileHover={{ scale: isCheckoutDisabled ? 1 : 1.02 }}
                    whileTap={{ scale: isCheckoutDisabled ? 1 : 0.98 }}
                    onClick={handlePlaceOrder}
                    disabled={isCheckoutDisabled}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:via-amber-600 hover:to-orange-600 text-white font-bold text-lg rounded-2xl shadow-xl shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                  >
                    {orderMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : authLoading || loadingPricing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Calculating Price...
                      </>
                    ) : isPricingStale ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Updating Price...
                      </>
                    ) : isPricingError ? (
                      <>
                        <AlertCircle className="w-5 h-5" />
                        Pricing Error
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Place Order • {formatCurrency(total, resolvedCurrency)}
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
      </Container>

      {/* Stripe Payment Modal */}
      <AnimatePresence>
        {showStripePayment && pendingOrderId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="slug-cart-payment-modal-title"
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Escape') handleStripePaymentCancel(); }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full flex items-center justify-center">
                  <CreditCard className="w-8 h-8 text-blue-600" />
                </div>
                <h3 id="slug-cart-payment-modal-title" className="text-xl font-bold text-slate-900 dark:text-white">
                  Complete Payment
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  Enter your card details to complete your order
                </p>
              </div>

              <StripePayment
                amount={total}
                currency="USD"
                referenceType="instant_transaction"
                referenceId={pendingOrderId}
                onSuccess={handleStripePaymentSuccess}
                onError={handleStripePaymentError}
                onCancel={handleStripePaymentCancel}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentPath={pathname}
        searchParams={searchParams}
      />
    </div>
  );
}
