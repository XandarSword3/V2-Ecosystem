import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import type { CartItem } from '@/stores/cartStore';
import type { FulfillmentMode } from '@/lib/engine-a/types';

export interface PricingDiscount {
  type: 'coupon' | 'gift_card' | 'loyalty';
  name: string;
  amount: number;
  code?: string;
  referenceId?: string;
}

export interface PricingTaxLine {
  name: string;
  rate: number;
  amount: number;
}

export interface PricingFeeLine {
  name: string;
  amount: number;
}

export interface PricingLineItemResult {
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface PricingResult {
  subtotal: number;
  taxAmount: number;
  taxBreakdown: PricingTaxLine[];
  feeBreakdown: PricingFeeLine[];
  serviceCharge: number;
  deliveryFee: number;
  totalDiscount: number;
  discounts: PricingDiscount[];
  totalAmount: number;
  currency: string;
  depositAmount?: number;
  preDiscountTotal?: number;
  lineItems?: PricingLineItemResult[];
  breakdown?: PricingLineItemResult[];
}

export interface UsePricingPreviewOptions {
  items: CartItem[];
  moduleId?: string;
  propertyId?: string | null;
  fulfillmentMode?: FulfillmentMode;
  paymentMethod?: 'cash' | 'card';
  couponCode?: string | null;
  giftCardCodes?: string[];
  loyaltyPointsToRedeem?: number;
  customerId?: string | null;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UsePricingPreviewReturn {
  pricing: PricingResult | null;
  isLoading: boolean;
  isStale: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePricingPreview({
  items,
  moduleId,
  propertyId,
  fulfillmentMode,
  paymentMethod,
  couponCode,
  giftCardCodes,
  loyaltyPointsToRedeem,
  customerId,
  enabled = true,
  debounceMs = 300,
}: UsePricingPreviewOptions): UsePricingPreviewReturn {
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef<number>(0);

  // Stable stringified representation of pricing parameters
  const dependencyKey = JSON.stringify({
    moduleId: moduleId || null,
    propertyId: propertyId || null,
    fulfillmentMode: fulfillmentMode || null,
    paymentMethod: paymentMethod || null,
    couponCode: couponCode ? couponCode.trim() : null,
    giftCardCodes: Array.isArray(giftCardCodes) ? [...giftCardCodes].sort() : [],
    loyaltyPointsToRedeem: loyaltyPointsToRedeem || 0,
    customerId: customerId || null,
    items: items.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      selectedModifiers: (i.selectedModifiers || []).map((m) => ({
        optionId: m.optionId,
        quantity: m.quantity,
      })),
    })),
  });

  // Keep latest params in ref for fetch execution
  const paramsRef = useRef({
    items,
    moduleId,
    propertyId,
    fulfillmentMode,
    paymentMethod,
    couponCode,
    giftCardCodes,
    loyaltyPointsToRedeem,
    customerId,
    enabled,
  });

  useEffect(() => {
    paramsRef.current = {
      items,
      moduleId,
      propertyId,
      fulfillmentMode,
      paymentMethod,
      couponCode,
      giftCardCodes,
      loyaltyPointsToRedeem,
      customerId,
      enabled,
    };
  }, [items, moduleId, propertyId, fulfillmentMode, paymentMethod, couponCode, giftCardCodes, loyaltyPointsToRedeem, customerId, enabled]);

  const executeFetch = useCallback(async () => {
    const params = paramsRef.current;
    if (!params.enabled || !params.moduleId || params.items.length === 0) {
      setPricing(null);
      setIsLoading(false);
      setIsStale(false);
      setIsError(false);
      setError(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      // NOTE: We deliberately DO NOT send client-derived unitPrice.
      // Backend resolveAndPriceCatalogItems() resolves authoritative base prices
      // and modifier adjustments from the canonical catalog database.
      const payload = {
        items: params.items.map((item) => ({
          itemId: item.id,
          name: item.name,
          quantity: item.quantity,
          taxCategory: item.category,
          moduleId: item.moduleId || params.moduleId,
          metadata: item.selectedModifiers && item.selectedModifiers.length > 0
            ? { selectedModifiers: item.selectedModifiers }
            : undefined,
        })),
        moduleId: params.moduleId,
        conditions: {
          fulfillmentMode: params.fulfillmentMode,
          paymentMethod: params.paymentMethod,
        },
        couponCode: params.couponCode ? params.couponCode.trim() : undefined,
        giftCardCodes: Array.isArray(params.giftCardCodes) && params.giftCardCodes.length > 0 ? params.giftCardCodes : undefined,
        loyaltyPointsToRedeem: params.loyaltyPointsToRedeem && params.loyaltyPointsToRedeem > 0 ? params.loyaltyPointsToRedeem : undefined,
        customerId: params.customerId || undefined,
        propertyId: params.propertyId || undefined,
      };

      const response = await api.post('/pricing/preview', payload, {
        signal: abortController.signal,
      });

      // Request ordering guard: discard response if a newer request has been triggered
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      if (response.data?.success && response.data?.data) {
        setPricing(response.data.data);
        setIsStale(false);
        setIsError(false);
        setError(null);
      } else {
        throw new Error(response.data?.error || 'Failed to calculate pricing');
      }
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        return;
      }
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Pricing preview error';
      setIsError(true);
      setError(errorMessage);
      setIsStale(false);
      setPricing(null);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled || !moduleId || items.length === 0) {
      setPricing(null);
      setIsLoading(false);
      setIsStale(false);
      setIsError(false);
      setError(null);
      return;
    }

    setIsStale(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeFetch();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [dependencyKey, enabled, debounceMs, executeFetch, moduleId, items.length]);

  return {
    pricing,
    isLoading,
    isStale,
    isError,
    error,
    refetch: executeFetch,
  };
}
