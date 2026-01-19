'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { 
  Ticket, 
  Check, 
  X, 
  Loader2, 
  Tag, 
  Percent, 
  DollarSign,
  AlertCircle,
  Trash2 
} from 'lucide-react';
import { debounce } from 'lodash';

interface AppliedCoupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  minimumOrderAmount?: number;
  maxDiscount?: number;
  description?: string;
}

interface CouponInputProps {
  orderTotal: number;
  orderType?: string;
  moduleId?: string;
  onCouponApply?: (coupon: AppliedCoupon | null) => void;
  onDiscountChange?: (discountAmount: number) => void;
  className?: string;
  appliedCoupon?: AppliedCoupon | null;
}

export function CouponInput({
  orderTotal,
  orderType = 'general',
  moduleId,
  onCouponApply,
  onDiscountChange,
  className = '',
  appliedCoupon: externalAppliedCoupon,
}: CouponInputProps) {
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(externalAppliedCoupon || null);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState('');

  // Sync with external applied coupon if provided
  useEffect(() => {
    if (externalAppliedCoupon !== undefined) {
      setAppliedCoupon(externalAppliedCoupon);
    }
  }, [externalAppliedCoupon]);

  // Recalculate discount when order total changes
  useEffect(() => {
    if (appliedCoupon) {
      const newDiscount = appliedCoupon.discountType === 'percentage'
        ? Math.min(
            (orderTotal * appliedCoupon.discountValue) / 100,
            appliedCoupon.maxDiscount || Infinity
          )
        : appliedCoupon.discountValue;
      
      const updatedCoupon = { ...appliedCoupon, discountAmount: newDiscount };
      setAppliedCoupon(updatedCoupon);
      onDiscountChange?.(newDiscount);
    }
  }, [orderTotal]);

  const validateCoupon = async () => {
    if (!code.trim()) return;
    
    setValidating(true);
    setError('');
    
    try {
      // Map moduleId to the backend's expected orderType values
      // Backend expects: 'restaurant', 'chalets', 'pool', 'snack'
      const backendOrderType = moduleId || orderType || 'restaurant';
      
      const res = await api.post('/coupons/validate', {
        code: code.trim().toUpperCase(),
        orderAmount: orderTotal, // Backend expects orderAmount, not orderTotal
        orderType: backendOrderType,
      });

      if (res.data.success) {
        const couponData = res.data.data;
        const newCoupon: AppliedCoupon = {
          code: couponData.code,
          discountType: couponData.discountType,
          discountValue: couponData.discountValue,
          discountAmount: couponData.discountAmount,
          minimumOrderAmount: couponData.minimumOrderAmount,
          maxDiscount: couponData.maxDiscount,
          description: couponData.description,
        };
        
        setAppliedCoupon(newCoupon);
        onCouponApply?.(newCoupon);
        onDiscountChange?.(newCoupon.discountAmount);
        setCode('');
        toast.success(`Coupon applied! You save ${formatCurrency(newCoupon.discountAmount)}`);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Invalid coupon code';
      setError(errorMessage);
      
      // Check for suggestions
      if (err.response?.data?.suggestion) {
        setSuggestion(err.response.data.suggestion);
      }
    } finally {
      setValidating(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    onCouponApply?.(null);
    onDiscountChange?.(0);
    setError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      validateCoupon();
    }
  };

  // Applied coupon display
  if (appliedCoupon) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 ${className}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-green-700 dark:text-green-300">
                  {appliedCoupon.code}
                </span>
                {appliedCoupon.discountType === 'percentage' ? (
                  <span className="text-xs bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">
                    {appliedCoupon.discountValue}% OFF
                  </span>
                ) : (
                  <span className="text-xs bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">
                    {formatCurrency(appliedCoupon.discountValue)} OFF
                  </span>
                )}
              </div>
              {appliedCoupon.description && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {appliedCoupon.description}
                </p>
              )}
              <p className="text-lg font-bold text-green-700 dark:text-green-300 mt-1">
                You save {formatCurrency(appliedCoupon.discountAmount)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeCoupon}
            className="text-green-600 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  // Input form
  return (
    <div className={className}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Enter coupon code"
            value={code}
            onChange={(e) => { 
              setCode(e.target.value.toUpperCase()); 
              setError(''); 
              setSuggestion('');
            }}
            onKeyDown={handleKeyDown}
            className="pl-10 font-mono uppercase"
            disabled={validating}
          />
        </div>
        <Button
          onClick={validateCoupon}
          disabled={validating || !code.trim()}
          variant="outline"
        >
          {validating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Apply'
          )}
        </Button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-red-500 text-sm mt-2"
          >
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </motion.div>
        )}

        {suggestion && (
          <motion.button
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onClick={() => { setCode(suggestion); setSuggestion(''); }}
            className="text-sm text-blue-500 hover:underline mt-1"
          >
            Did you mean: {suggestion}?
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// Available Coupons Display (for showing on checkout page)
interface AvailableCoupon {
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderAmount?: number;
  expiresAt?: string;
}

interface AvailableCouponsProps {
  orderType?: string;
  moduleId?: string;
  onSelect?: (code: string) => void;
  className?: string;
}

export function AvailableCoupons({ 
  orderType, 
  moduleId, 
  onSelect,
  className = '' 
}: AvailableCouponsProps) {
  const [coupons, setCoupons] = useState<AvailableCoupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCoupons();
  }, [orderType, moduleId]);

  const loadCoupons = async () => {
    try {
      const params: Record<string, string> = {};
      if (orderType) params.orderType = orderType;
      if (moduleId) params.moduleId = moduleId;
      
      const res = await api.get('/coupons/active', { params });
      if (res.data.success) {
        setCoupons(res.data.data.slice(0, 4)); // Show max 4
      }
    } catch {
      // Silent fail - coupons are optional
    } finally {
      setLoading(false);
    }
  };

  if (loading || coupons.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
        Available Coupons
      </p>
      <div className="grid gap-2">
        {coupons.map((coupon) => (
          <motion.button
            key={coupon.code}
            onClick={() => onSelect?.(coupon.code)}
            className="flex items-center justify-between p-3 border rounded-lg hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-800 flex items-center justify-center">
                {coupon.discountType === 'percentage' ? (
                  <Percent className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                ) : (
                  <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                )}
              </div>
              <div>
                <p className="font-mono font-semibold text-slate-900 dark:text-white">
                  {coupon.code}
                </p>
                <p className="text-xs text-slate-500">
                  {coupon.discountType === 'percentage' 
                    ? `${coupon.discountValue}% off`
                    : `${formatCurrency(coupon.discountValue)} off`
                  }
                  {coupon.minimumOrderAmount && ` · Min. ${formatCurrency(coupon.minimumOrderAmount)}`}
                </p>
              </div>
            </div>
            <Tag className="w-4 h-4 text-purple-500" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
