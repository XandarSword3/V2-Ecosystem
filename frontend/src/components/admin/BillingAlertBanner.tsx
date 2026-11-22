'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ShieldAlert, X, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

/**
 * Operator-tier billing notification (B2B).
 *
 * Consumes the events dispatched by the api.ts response interceptor
 * ('v2:billing-alert' / 'v2:billing-notice'), which only ever fire for
 * operator surfaces — the backend sanitizes public storefront errors into a
 * neutral 503, so end-customers never reach this component or see SaaS
 * billing vocabulary.
 *
 * Two banners:
 *   warning (past_due)  — amber; dismissible; reads still work, writes blocked
 *   blocked (suspended) — red; persistent; everything reads-only until fixed
 *
 * Both offer "Update Payment Method", which opens the Stripe Customer Portal
 * via GET /platform/billing/portal (the one route the backend leaves open for
 * suspended tenants, so this CTA genuinely works while blocked).
 */

const BILLING_ALERT_EVENT = 'v2:billing-alert';

export interface BillingAlertDetail {
  billingStatus?: string;
  message: string;
  portalAvailable?: boolean;
}

type BannerTier = 'warning' | 'blocked';

interface BannerState {
  tier: BannerTier;
  message: string;
}

export function BillingAlertBanner() {
  const [alert, setAlert] = useState<BannerState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  // "blocked" has priority over "warning" — if any call comes back 402,
  // we upgrade to the persistent banner even after the warning one was dismissed.
  const dismissedRef = useRef(false);

  useEffect(() => {
    const onAlert = (e: Event) => {
      const detail = (e as CustomEvent<BillingAlertDetail>).detail;
      if (!detail) return;
      const isBlocked = detail.billingStatus === 'suspended' || detail.billingStatus === 'cancelled';
      if (isBlocked || !dismissedRef.current) {
        dismissedRef.current = false;
        setDismissed(false);
        setAlert({
          tier: isBlocked ? 'blocked' : 'warning',
          message: detail.message,
        });
      }
    };

    window.addEventListener(BILLING_ALERT_EVENT, onAlert);
    return () => {
      window.removeEventListener(BILLING_ALERT_EVENT, onAlert);
    };
  }, []);

  const dismissWarning = useCallback(() => {
    if (alert?.tier === 'warning') {
      dismissedRef.current = true;
      setDismissed(true);
      setAlert(null);
    }
  }, [alert]);

  const openBillingPortal = useCallback(async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      // Backend exempts this exact route from the suspended/past_due block,
      // so the operator can self-service even while writes are failing.
      const res = await api.get('/platform/billing/portal');
      const url = res.data?.data?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Billing portal is not available for this account yet. Contact support.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to open the billing portal. Try again shortly.');
    } finally {
      setPortalLoading(false);
    }
  }, [portalLoading]);

  if (!alert || dismissed) return null;

  const isBlocked = alert.tier === 'blocked';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        role="alert"
        className={`shadow-lg ${
          isBlocked
            ? 'bg-red-600 text-white'
            : 'bg-amber-400 text-amber-950'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
          {isBlocked ? (
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <div className="text-sm font-medium flex-1 min-w-0">
            {isBlocked ? 'Subscription suspended — ' : 'Payment overdue — '}
            <span className="opacity-90">{alert.message}</span>
          </div>
          <button
            onClick={openBillingPortal}
            disabled={portalLoading}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md transition-colors disabled:opacity-60 ${
              isBlocked
                ? 'bg-white text-red-700 hover:bg-red-50'
                : 'bg-amber-950 text-white hover:bg-amber-900'
            }`}
          >
            {portalLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Update Payment Method
          </button>
          {!isBlocked && (
            <button
              onClick={dismissWarning}
              aria-label="Dismiss billing notice"
              className="flex-shrink-0 p-1.5 rounded-md hover:bg-amber-500/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default BillingAlertBanner;
