'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import {
  ChevronDown,
  ChevronUp,
  Gift,
  Ticket,
  Award,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
} from 'lucide-react';

export interface PricingDiscountDisplay {
  type: 'coupon' | 'gift_card' | 'loyalty';
  name: string;
  amount: number;
  code?: string;
  referenceId?: string;
}

export interface PaymentDiscountsProps {
  couponCode?: string | null;
  giftCardCodes?: string[];
  loyaltyPointsToRedeem?: number;
  onCouponChange?: (code: string | null) => void;
  onAddGiftCard?: (code: string) => void;
  onRemoveGiftCard?: (code: string) => void;
  onLoyaltyPointsChange?: (points: number) => void;
  pricingDiscounts?: PricingDiscountDisplay[];
  isPricingStale?: boolean;
  isLoadingPricing?: boolean;
  currency?: string;
  moduleId?: string;
  moduleSlug?: string;
  className?: string;
}

/**
 * PaymentDiscounts — Pure Presentation & Discount Instrument Input Component.
 *
 * Implements strict F5 architecture:
 * 1. Collects discount instrument inputs (coupon code, gift card codes, loyalty points requested).
 * 2. Emits input mutations to parent / module-scoped cart store.
 * 3. Renders discount monetary values EXCLUSIVELY from server-authoritative PricingResult.
 * 4. NEVER calculates discount amounts or final totals on the client.
 */
export function PaymentDiscounts({
  couponCode = null,
  giftCardCodes = [],
  loyaltyPointsToRedeem = 0,
  onCouponChange,
  onAddGiftCard,
  onRemoveGiftCard,
  onLoyaltyPointsChange,
  pricingDiscounts = [],
  isPricingStale = false,
  isLoadingPricing = false,
  currency = 'USD',
  moduleId,
  moduleSlug,
  className = '',
}: PaymentDiscountsProps) {
  const { user, isAuthenticated } = useAuth();
  const [expanded, setExpanded] = useState(true);

  // Local input fields
  const [inputCoupon, setInputCoupon] = useState('');
  const [inputGiftCard, setInputGiftCard] = useState('');
  const [inputPoints, setInputPoints] = useState<string>(
    loyaltyPointsToRedeem && loyaltyPointsToRedeem > 0 ? loyaltyPointsToRedeem.toString() : ''
  );

  // User loyalty account balance (for informational balance display only)
  const [userLoyaltyPoints, setUserLoyaltyPoints] = useState<number | null>(null);

  useEffect(() => {
    if (loyaltyPointsToRedeem && loyaltyPointsToRedeem > 0) {
      setInputPoints(loyaltyPointsToRedeem.toString());
    } else {
      setInputPoints('');
    }
  }, [loyaltyPointsToRedeem]);

  useEffect(() => {
    if (isAuthenticated && user) {
      api.get('/loyalty/me')
        .then((res) => {
          if (res.data?.success && res.data?.data) {
            const pts = res.data.data.available_points || res.data.data.currentPoints || 0;
            setUserLoyaltyPoints(pts);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, user]);

  // Server discount matching
  const serverCouponDiscount = pricingDiscounts.find((d) => d.type === 'coupon');
  const serverLoyaltyDiscount = pricingDiscounts.find((d) => d.type === 'loyalty');
  const serverGiftCardDiscounts = pricingDiscounts.filter((d) => d.type === 'gift_card');

  const handleApplyCoupon = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputCoupon.trim().toUpperCase();
    if (!clean) return;
    onCouponChange?.(clean);
    setInputCoupon('');
  };

  const handleRemoveCoupon = () => {
    onCouponChange?.(null);
    setInputCoupon('');
  };

  const handleAddGiftCard = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputGiftCard.trim().toUpperCase();
    if (!clean) return;
    if (giftCardCodes.includes(clean)) {
      setInputGiftCard('');
      return;
    }
    onAddGiftCard?.(clean);
    setInputGiftCard('');
  };

  const handlePointsInputBlurOrSubmit = () => {
    const parsed = parseInt(inputPoints, 10);
    const validPoints = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    onLoyaltyPointsChange?.(validPoints);
  };

  return (
    <Card className={`overflow-hidden border border-slate-200 dark:border-slate-800 ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
            <Ticket className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
              Promotions & Discounts
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Apply coupons, gift cards, or loyalty rewards
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="p-4 space-y-5 border-t border-slate-200 dark:border-slate-800 text-sm"
          >
            {/* 1. Coupon Code Section */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Promo / Coupon Code
              </label>

              {couponCode ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-green-50/80 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <div>
                      <span className="font-bold text-green-800 dark:text-green-300">{couponCode}</span>
                      {serverCouponDiscount?.name && (
                        <p className="text-xs text-green-600 dark:text-green-400">{serverCouponDiscount.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-green-700 dark:text-green-300">
                      {isPricingStale || isLoadingPricing ? (
                        <span className="text-xs text-slate-400 animate-pulse">Calculating...</span>
                      ) : serverCouponDiscount ? (
                        `-${formatCurrency(serverCouponDiscount.amount, currency)}`
                      ) : (
                        <span className="text-xs text-slate-400">Applied</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                      title="Remove coupon"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter coupon code"
                    value={inputCoupon}
                    onChange={(e) => setInputCoupon(e.target.value)}
                    className="h-10 text-sm uppercase"
                  />
                  <Button type="submit" size="sm" variant="outline" className="h-10 px-4 shrink-0 font-medium">
                    Apply
                  </Button>
                </form>
              )}
            </div>

            {/* 2. Gift Cards Section */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Gift Cards
              </label>

              {giftCardCodes.length > 0 && (
                <div className="space-y-2">
                  {giftCardCodes.map((code) => {
                    const matchingDiscount = serverGiftCardDiscounts.find(
                      (d) => d.code?.toUpperCase() === code.toUpperCase()
                    );
                    return (
                      <div
                        key={code}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40"
                      >
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="font-mono font-medium text-blue-900 dark:text-blue-300">{code}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-blue-700 dark:text-blue-300">
                            {isPricingStale || isLoadingPricing ? (
                              <span className="text-xs text-slate-400 animate-pulse">Calculating...</span>
                            ) : matchingDiscount ? (
                              `-${formatCurrency(matchingDiscount.amount, currency)}`
                            ) : (
                              <span className="text-xs text-slate-400">Pending</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveGiftCard?.(code)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                            title="Remove gift card"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleAddGiftCard} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter gift card code"
                  value={inputGiftCard}
                  onChange={(e) => setInputGiftCard(e.target.value)}
                  className="h-10 text-sm uppercase font-mono"
                />
                <Button type="submit" size="sm" variant="outline" className="h-10 px-4 shrink-0 font-medium">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </form>
            </div>

            {/* 3. Loyalty Points Section */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Loyalty Points
                </label>
                {userLoyaltyPoints !== null && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Available: <strong className="text-slate-900 dark:text-white">{formatNumber(userLoyaltyPoints)}</strong> pts
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max={userLoyaltyPoints !== null ? userLoyaltyPoints : undefined}
                  placeholder="Points to redeem"
                  value={inputPoints}
                  onChange={(e) => setInputPoints(e.target.value)}
                  onBlur={handlePointsInputBlurOrSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handlePointsInputBlurOrSubmit();
                    }
                  }}
                  className="h-10 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePointsInputBlurOrSubmit}
                  className="h-10 px-4 shrink-0 font-medium"
                >
                  Set Points
                </Button>
              </div>

              {loyaltyPointsToRedeem > 0 && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-medium text-amber-900 dark:text-amber-300">
                      Redeeming {formatNumber(loyaltyPointsToRedeem)} points
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                      {isPricingStale || isLoadingPricing ? (
                        <span className="text-xs text-slate-400 animate-pulse">Calculating...</span>
                      ) : serverLoyaltyDiscount ? (
                        `-${formatCurrency(serverLoyaltyDiscount.amount, currency)}`
                      ) : (
                        <span className="text-xs text-slate-400">Pending</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setInputPoints('');
                        onLoyaltyPointsChange?.(0);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                      title="Remove loyalty points"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
