'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { CouponInput, AvailableCoupons } from './CouponInput';
import { PointsPreview } from './LoyaltyDisplay';
import {
  ChevronDown,
  ChevronUp,
  Gift,
  Ticket,
  Award,
  CreditCard,
  Check,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react';

export interface AppliedDiscount {
  type: 'coupon' | 'giftcard' | 'loyalty';
  code?: string;
  amount: number;
  details?: string;
  pointsUsed?: number;
}

interface PaymentDiscountsProps {
  orderTotal: number;
  orderType?: string;
  moduleId?: string;
  onTotalChange?: (finalTotal: number, discounts: AppliedDiscount[]) => void;
  className?: string;
}

export function PaymentDiscounts({
  orderTotal,
  orderType = 'general',
  moduleId,
  onTotalChange,
  className = '',
}: PaymentDiscountsProps) {
  const { user, isAuthenticated } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([]);
  
  // Gift Card State
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardLoading, setGiftCardLoading] = useState(false);
  const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null);
  const [giftCardApplied, setGiftCardApplied] = useState<{ code: string; amount: number } | null>(null);
  
  // Loyalty Points State
  const [loyaltyAccount, setLoyaltyAccount] = useState<{
    currentPoints: number;
    dollarValue: number;
    pointsRate: number;
  } | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState('');
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  
  // Coupon State
  const [couponDiscount, setCouponDiscount] = useState(0);

  // Load loyalty account info
  useEffect(() => {
    if (isAuthenticated && user) {
      loadLoyaltyInfo();
    }
  }, [isAuthenticated, user]);

  // Calculate total discounts and notify parent
  useEffect(() => {
    const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
    const finalTotal = Math.max(0, orderTotal - totalDiscount);
    onTotalChange?.(finalTotal, appliedDiscounts);
  }, [appliedDiscounts, orderTotal]);

  const loadLoyaltyInfo = async () => {
    try {
      // Check if token exists before making the call
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        console.log('[PaymentDiscounts] No access token found, skipping loyalty load');
        return;
      }
      
      console.log('[PaymentDiscounts] Loading loyalty info...');
      const res = await api.get('/loyalty/me');
      console.log('[PaymentDiscounts] Loyalty response:', res.data);
      if (res.data.success) {
        const account = res.data.data;
        // Map backend field name (available_points) to frontend field name (currentPoints)
        const currentPoints = account.available_points || account.currentPoints || 0;
        console.log('[PaymentDiscounts] Current points:', currentPoints);
        // Assuming 100 points = $1
        const pointsRate = 100; // This should come from settings
        setLoyaltyAccount({
          currentPoints: currentPoints,
          dollarValue: currentPoints / pointsRate,
          pointsRate,
        });
      }
    } catch (error: any) {
      // Only log if it's not a 401 (user not authenticated is expected in some cases)
      if (error.response?.status !== 401) {
        console.error('[PaymentDiscounts] Error loading loyalty info:', error.response?.status, error.response?.data || error.message);
      }
      // Clear loyalty account on auth error - user may need to re-login
      if (error.response?.status === 401) {
        setLoyaltyAccount(null);
      }
    }
  };

  const handleCouponApply = (coupon: any) => {
    if (coupon) {
      // Remove any existing coupon discount
      setAppliedDiscounts(prev => prev.filter(d => d.type !== 'coupon'));
      
      // Add new coupon
      setAppliedDiscounts(prev => [...prev, {
        type: 'coupon',
        code: coupon.code,
        amount: coupon.discountAmount,
        details: coupon.description,
      }]);
      setCouponDiscount(coupon.discountAmount);
    } else {
      // Remove coupon
      setAppliedDiscounts(prev => prev.filter(d => d.type !== 'coupon'));
      setCouponDiscount(0);
    }
  };

  const handleGiftCardCheck = async () => {
    if (!giftCardCode.trim()) return;
    
    setGiftCardLoading(true);
    try {
      const res = await api.get(`/giftcards/check/${giftCardCode.trim()}`);
      if (res.data.success) {
        setGiftCardBalance(res.data.data.balance);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gift card not found');
      setGiftCardBalance(null);
    } finally {
      setGiftCardLoading(false);
    }
  };

  const handleGiftCardApply = () => {
    if (giftCardBalance === null) return;
    
    const currentTotal = orderTotal - couponDiscount - pointsRedeemed;
    const amountToApply = Math.min(giftCardBalance, currentTotal);
    
    // Remove any existing gift card
    setAppliedDiscounts(prev => prev.filter(d => d.type !== 'giftcard'));
    
    // Add gift card
    setGiftCardApplied({ code: giftCardCode, amount: amountToApply });
    setAppliedDiscounts(prev => [...prev, {
      type: 'giftcard',
      code: giftCardCode,
      amount: amountToApply,
    }]);
    
    setGiftCardCode('');
    setGiftCardBalance(null);
    toast.success(`Gift card applied: ${formatCurrency(amountToApply)}`);
  };

  const handleRemoveGiftCard = () => {
    setGiftCardApplied(null);
    setAppliedDiscounts(prev => prev.filter(d => d.type !== 'giftcard'));
  };

  const handlePointsChange = (value: string) => {
    setPointsToRedeem(value);
    
    const points = parseInt(value) || 0;
    if (!loyaltyAccount) return;
    
    // Validate points
    const maxPoints = Math.min(
      loyaltyAccount.currentPoints,
      Math.ceil((orderTotal - couponDiscount - (giftCardApplied?.amount || 0)) * loyaltyAccount.pointsRate)
    );
    
    const validPoints = Math.min(points, maxPoints);
    const dollarValue = validPoints / loyaltyAccount.pointsRate;
    
    // Update redemption
    setPointsRedeemed(validPoints);
    
    // Update discounts
    setAppliedDiscounts(prev => {
      const filtered = prev.filter(d => d.type !== 'loyalty');
      if (validPoints > 0) {
        return [...filtered, {
          type: 'loyalty',
          amount: dollarValue,
          details: `${formatNumber(validPoints)} points`,
          pointsUsed: validPoints,
        }];
      }
      return filtered;
    });
  };

  const handleRedeemAllPoints = () => {
    if (!loyaltyAccount) return;
    
    const maxDollarValue = orderTotal - couponDiscount - (giftCardApplied?.amount || 0);
    const maxPoints = Math.min(
      loyaltyAccount.currentPoints,
      Math.ceil(maxDollarValue * loyaltyAccount.pointsRate)
    );
    
    setPointsToRedeem(maxPoints.toString());
    handlePointsChange(maxPoints.toString());
  };

  const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
  const finalTotal = Math.max(0, orderTotal - totalDiscount);
  const pointsToEarn = Math.floor(finalTotal); // 1 point per dollar (can be configured)

  return (
    <Card className={className}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <span className="font-semibold">Discounts & Rewards</span>
          {totalDiscount > 0 && (
            <span className="text-green-600 font-medium">
              -{formatCurrency(totalDiscount)}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <CardContent className="pt-0 space-y-6">
              {/* Coupon Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Ticket className="w-4 h-4 text-purple-500" />
                  <span className="font-medium text-sm">Coupon Code</span>
                </div>
                <CouponInput
                  orderTotal={orderTotal}
                  orderType={orderType}
                  moduleId={moduleId}
                  onCouponApply={handleCouponApply}
                  onDiscountChange={setCouponDiscount}
                />
              </div>

              {/* Gift Card Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-4 h-4 text-pink-500" />
                  <span className="font-medium text-sm">Gift Card</span>
                </div>
                
                {giftCardApplied ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-mono text-sm font-medium">{giftCardApplied.code}</p>
                        <p className="text-green-600 font-semibold">
                          -{formatCurrency(giftCardApplied.amount)}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleRemoveGiftCard}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter gift card code"
                        value={giftCardCode}
                        onChange={(e) => { setGiftCardCode(e.target.value.toUpperCase()); setGiftCardBalance(null); }}
                        className="font-mono uppercase"
                      />
                      <Button
                        variant="outline"
                        onClick={handleGiftCardCheck}
                        disabled={giftCardLoading || !giftCardCode.trim()}
                      >
                        {giftCardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
                      </Button>
                    </div>
                    
                    {giftCardBalance !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                      >
                        <div>
                          <p className="text-sm text-slate-600">Available Balance</p>
                          <p className="text-lg font-bold text-blue-600">{formatCurrency(giftCardBalance)}</p>
                        </div>
                        <Button size="sm" onClick={handleGiftCardApply}>
                          Apply
                        </Button>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Loyalty Points Section */}
              {isAuthenticated && loyaltyAccount && loyaltyAccount.currentPoints > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span className="font-medium text-sm">Loyalty Points</span>
                    </div>
                    <span className="text-sm text-slate-500">
                      {formatNumber(loyaltyAccount.currentPoints)} pts available
                      ({formatCurrency(loyaltyAccount.dollarValue)} value)
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        placeholder="Points to redeem"
                        value={pointsToRedeem}
                        onChange={(e) => handlePointsChange(e.target.value)}
                        max={loyaltyAccount.currentPoints}
                        min={0}
                      />
                      {parseInt(pointsToRedeem) > 0 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-green-600">
                          = {formatCurrency(pointsRedeemed / loyaltyAccount.pointsRate)}
                        </span>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRedeemAllPoints}>
                      Max
                    </Button>
                  </div>
                  
                  <p className="text-xs text-slate-500 mt-1">
                    {loyaltyAccount.pointsRate} points = $1.00
                  </p>
                </div>
              )}

              {/* Summary */}
              {appliedDiscounts.length > 0 && (
                <div className="border-t dark:border-slate-700 pt-4">
                  <p className="text-sm font-medium mb-2">Applied Discounts</p>
                  <div className="space-y-2">
                    {appliedDiscounts.map((discount, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          {discount.type === 'coupon' && <Ticket className="w-4 h-4" />}
                          {discount.type === 'giftcard' && <Gift className="w-4 h-4" />}
                          {discount.type === 'loyalty' && <Award className="w-4 h-4" />}
                          {discount.code || discount.details}
                        </span>
                        <span className="font-medium text-green-600">
                          -{formatCurrency(discount.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between font-bold pt-2 border-t dark:border-slate-700">
                      <span>Total Savings</span>
                      <span className="text-green-600">-{formatCurrency(totalDiscount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Points to earn */}
              {isAuthenticated && pointsToEarn > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                  <Award className="w-4 h-4" />
                  <span>
                    You'll earn <strong>{formatNumber(pointsToEarn)}</strong> loyalty points with this order!
                  </span>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// Export individual components for flexible use
export { CouponInput, AvailableCoupons } from './CouponInput';
export { LoyaltyDisplay, PointsPreview } from './LoyaltyDisplay';
export { GiftCardPurchase, GiftCardBalance } from './GiftCardPurchase';
