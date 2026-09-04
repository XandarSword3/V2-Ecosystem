'use client';

import { useState, useEffect } from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useCartStore } from '@/stores/cartStore';
import { usePricingPreview } from '@/hooks/usePricingPreview';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { getStoredPropertyId } from '@/lib/property-id';
import { Button } from '@/components/ui/Button';
import { AuthModal } from '@/components/auth/AuthModal';
import {
  ArrowLeft,
  Loader2,
  UtensilsCrossed,
  ChefHat,
} from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { CANONICAL_ENGINE_A_CAPABILITIES, type FulfillmentMode, type DestinationType } from '@/lib/engine-a/types';
import { resolveEngineACapabilities } from '@/components/shells/ModuleContext';
import GenericCheckoutWorkflow from '@/components/checkout/GenericCheckoutWorkflow';

const EMPTY_GIFT_CARDS: string[] = [];

export default function ModuleCartPage() {
  const t = useTranslations('common');
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
  const activeBookingId = searchParams.get('bookingId') || searchParams.get('activeBookingId') || undefined;

  const [isHydrated, setIsHydrated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasConfirmedOrder, setHasConfirmedOrder] = useState(false);
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (user?.email && !customerEmail) {
      setCustomerEmail(user.email);
    }
  }, [user?.email, customerEmail]);

  const items = useCartStore((s) => s.items);
  const moduleKey = moduleId || normalizedSlug;
  const moduleItems = moduleId
    ? items.filter((i) => i.moduleId === moduleId || i.moduleSlug === normalizedSlug)
    : items.filter((i) => i.moduleSlug === normalizedSlug);
  
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearModuleItems = useCartStore((s) => s.clearModuleItems);
  const customerName = useCartStore((s) => s.customerName);
  const customerPhone = useCartStore((s) => s.customerPhone);
  const paymentMethod = useCartStore((s) => s.paymentMethod);
  const notes = useCartStore((s) => s.notes);
  const setCustomerName = useCartStore((s) => s.setCustomerName);
  const setCustomerPhone = useCartStore((s) => s.setCustomerPhone);
  const setNotes = useCartStore((s) => s.setNotes);

  const rawSelection = useCartStore((s) => moduleKey ? s.getFulfillmentForModule(moduleKey) : undefined);
  const setFulfillmentForModule = useCartStore((s) => s.setFulfillmentForModule);

  // Module-scoped discount state from cartStore
  const couponCode = useCartStore((s) => moduleKey ? (s.couponByModule[moduleKey] ?? null) : null);
  const giftCardCodes = useCartStore((s) => moduleKey ? (s.giftCardsByModule[moduleKey] ?? EMPTY_GIFT_CARDS) : EMPTY_GIFT_CARDS);
  const loyaltyPoints = useCartStore((s) => moduleKey ? (s.loyaltyPointsByModule[moduleKey] ?? 0) : 0);
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
    const matchedOption = fulfillmentOptions.find((opt) => opt.mode === mode);
    const destType: DestinationType = (matchedOption?.destinations?.[0] as DestinationType) || (
      mode === 'none' ? 'none' : 'on_premise_location'
    );

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

  // Authoritative server-side pricing preview hook with stale invalidation
  const {
    pricing: serverPricing,
    isLoading: loadingPricing,
    isStale: isPricingStale,
    isError: isPricingError,
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

  const resolvedCurrency = serverPricing?.currency || currency || 'USD';

  // Helper to extract authoritative line pricing from server PricingResult
  const getAuthoritativeLinePrice = (itemId: string, index: number) => {
    if (loadingPricing || isPricingStale) {
      return { unitPriceText: 'Calculating...', lineTotalText: '...' };
    }
    if (isPricingError || !serverPricing) {
      return { unitPriceText: '—', lineTotalText: '—' };
    }
    const matchingLine =
      serverPricing.lineItems?.[index] ||
      serverPricing.lineItems?.find((li) => li.itemId === itemId) ||
      serverPricing.breakdown?.[index] ||
      serverPricing.breakdown?.find((b) => b.itemId === itemId);

    if (matchingLine) {
      const unitPrice = matchingLine.unitPrice;
      const lineTotal = matchingLine.lineTotal !== undefined ? matchingLine.lineTotal : (matchingLine as any).subtotal;
      return {
        unitPriceText: `${formatCurrency(unitPrice, resolvedCurrency)} each`,
        lineTotalText: formatCurrency(lineTotal, resolvedCurrency),
      };
    }
    return { unitPriceText: '—', lineTotalText: '—' };
  };

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

  // Order submission handler passed to GenericCheckoutWorkflow
  const handleCreateOrder = async (orderPayload: any) => {
    if (!authLoading && !isAuthenticated) {
      setShowAuthModal(true);
      throw new Error('Please log in to complete your order.');
    }

    const response = await api.post(`/${slug}/orders`, orderPayload);
    const order = response?.data?.data;
    const orderId = order?.id || order?.order_id || '';

    if (!orderId) {
      throw new Error('Order creation failed: No valid order ID returned');
    }

    return { id: orderId, ...order };
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

  // Empty cart state (only show if no order has just been confirmed)
  if (moduleItems.length === 0 && !hasConfirmedOrder) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/50 to-rose-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-orange-200/40 to-amber-200/40 dark:from-orange-900/10 dark:to-amber-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-rose-200/40 to-pink-200/40 dark:from-rose-900/10 dark:to-pink-900/10 rounded-full blur-3xl" />
      </div>

      <Container as="div" className="relative py-8 max-w-4xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            href={`/${propertySlug}/${slug}`}
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {currentModule.name}</span>
          </Link>
          
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600 bg-clip-text text-transparent">
              {currentModule.name} Checkout
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Complete your order • {moduleItems.length} {moduleItems.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </motion.div>

        {/* Canonical 5-Step Generic Checkout Workflow */}
        <GenericCheckoutWorkflow
          items={moduleItems}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onClearItems={() => moduleKey && clearModuleItems(moduleKey)}
          getAuthoritativeLinePrice={getAuthoritativeLinePrice}
          customer={{
            name: customerName,
            phone: customerPhone,
            email: customerEmail,
            notes: notes,
          }}
          onChangeCustomer={(patch) => {
            if (patch.name !== undefined) setCustomerName(patch.name);
            if (patch.phone !== undefined) setCustomerPhone(patch.phone);
            if (patch.email !== undefined) setCustomerEmail(patch.email);
            if (patch.notes !== undefined) setNotes(patch.notes);
          }}
          fulfillment={{
            mode: selectedMode,
            destinationType: selectedDestinationType,
            destinationRef: selectedDestinationRef,
          }}
          fulfillmentOptions={fulfillmentOptions}
          serviceLocations={serviceLocations}
          onChangeFulfillmentMode={handleSelectMode}
          onChangeDestination={({ destinationType, destinationRef }) =>
            handleDestinationChange(destinationType, destinationRef)
          }
          serverPricing={serverPricing}
          currency={resolvedCurrency}
          activeBookingId={activeBookingId}
          isPricingStale={isPricingStale}
          isLoadingPricing={loadingPricing}
          isPricingError={isPricingError}
          couponCode={couponCode}
          giftCardCodes={giftCardCodes}
          loyaltyPoints={loyaltyPoints}
          onCouponChange={(code) => {
            if (moduleKey) setCouponForModule(moduleKey, code);
          }}
          onAddGiftCard={(code) => {
            if (moduleKey) addGiftCardForModule(moduleKey, code);
          }}
          onRemoveGiftCard={(code) => {
            if (moduleKey) removeGiftCardForModule(moduleKey, code);
          }}
          onLoyaltyPointsChange={(pts) => {
            if (moduleKey) setLoyaltyPointsForModule(moduleKey, pts);
          }}
          createOrder={handleCreateOrder}
          propertySlug={propertySlug}
          moduleSlug={slug || ''}
          moduleName={currentModule.name}
          moduleId={moduleId}
          onOrderConfirmed={(_orderId) => {
            setHasConfirmedOrder(true);
            if (moduleKey) clearModuleItems(moduleKey);
          }}
        />
      </Container>

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
