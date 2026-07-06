'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Cookie consent categories aligned with ePrivacy / GDPR classification */
export interface ConsentCategories {
  necessary: boolean;   // Always true — cannot be disabled
  functional: boolean;  // Theme, language, UI preferences
  analytics: boolean;   // Sentry, Google Analytics, web vitals reporting
  marketing: boolean;   // Facebook Pixel, ad retargeting
}

export interface ConsentRecord {
  categories: ConsentCategories;
  timestamp: number;
  version: string;
}

export interface ConsentContextValue {
  /** Current consent state — null means no consent decision has been made yet */
  consent: ConsentRecord | null;
  /** Whether the banner should be shown */
  showBanner: boolean;
  /** Check if a specific category is consented to */
  hasConsent: (category: keyof ConsentCategories) => boolean;
  /** Accept all cookie categories */
  acceptAll: () => void;
  /** Reject all non-essential categories */
  rejectAll: () => void;
  /** Save custom category selections */
  savePreferences: (categories: Partial<ConsentCategories>) => void;
  /** Reset consent (re-shows banner) */
  resetConsent: () => void;
  /** Open the customise dialog */
  openCustomise: () => void;
  /** Whether the customise dialog is open */
  showCustomise: boolean;
  /** Close the customise dialog */
  closeCustomise: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Bump this version string whenever the cookie policy changes materially.
 * A version mismatch will re-trigger the consent banner for returning users.
 */
export const CONSENT_VERSION = '1.0';
export const CONSENT_STORAGE_KEY = 'cookie-consent';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES: ConsentCategories = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

const ALL_CATEGORIES: ConsentCategories = {
  necessary: true,
  functional: true,
  analytics: true,
  marketing: true,
};

const ESSENTIAL_ONLY: ConsentCategories = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ConsentContext = createContext<ConsentContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helper — record consent to backend (fire-and-forget)
// ---------------------------------------------------------------------------

async function recordConsentToBackend(
  categories: ConsentCategories,
  version: string,
): Promise<void> {
  try {
    // Reuse the shared API_BASE_URL (already handles the double-/api guard
    // and the /v1 prefix — see lib/api.ts) instead of building an ad-hoc URL
    // here. The previous version built its own baseUrl from
    // NEXT_PUBLIC_API_URL and hardcoded /api/gdpr/... with no /v1, so
    // whenever NEXT_PUBLIC_API_URL already included /api (a valid value
    // elsewhere) this produced /api/api/gdpr/cookie-consent, and even when
    // it didn't, the request was still missing /v1 and would 404 against
    // the real mount at /api/v1/gdpr/cookie-consent (app.ts:
    // app.use('/api/v1', apiRouter)).
    await fetch(`${API_BASE_URL}/gdpr/cookie-consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent_version: version,
        categories_accepted: Object.entries(categories)
          .filter(([, v]) => v)
          .map(([k]) => k),
        categories_rejected: Object.entries(categories)
          .filter(([, v]) => !v)
          .map(([k]) => k),
      }),
    });
  } catch {
    // Consent recording is best-effort — do not block the UI
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showCustomise, setShowCustomise] = useState(false);
  const initialised = useRef(false);

  // Apply side effects (GTM, FB, Events)
  const applyConsentEffects = useCallback((categories: ConsentCategories, record: ConsentRecord) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('consent-updated', { detail: record }));

      // Update dataLayer for GTM/GA4
      const dataLayer = (window as any).dataLayer = (window as any).dataLayer || [];
      dataLayer.push({
        event: 'consent_update',
        consent: categories
      });

      // Update FB Pixel
      if (typeof (window as any).fbq === 'function') {
        if (!categories.marketing) {
          (window as any).fbq('consent', 'revoke');
        } else {
          (window as any).fbq('consent', 'grant');
        }
      }

      // Handle GA disable if analytics is rejected
      if (!categories.analytics) {
        (window as any)['ga-disable-GA_MEASUREMENT_ID'] = true;
      }
    }
  }, []);

  // Read persisted consent on mount
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ConsentRecord;
        if (parsed.version === CONSENT_VERSION) {
          setConsent(parsed);
          applyConsentEffects(parsed.categories, parsed);
          return;
        }
      }
    } catch {
      // Invalid JSON or localStorage unavailable
    }

    // No valid consent — show banner
    setShowBanner(true);
  }, [applyConsentEffects]);

  // Persist & broadcast consent
  const persistConsent = useCallback((categories: ConsentCategories) => {
    const record: ConsentRecord = {
      categories,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    };

    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // localStorage unavailable (Safari private browsing, quota exceeded)
    }

    setConsent(record);
    setShowBanner(false);
    setShowCustomise(false);

    // Fire-and-forget backend recording
    recordConsentToBackend(categories, CONSENT_VERSION);

    // Apply side effects
    applyConsentEffects(categories, record);
  }, [applyConsentEffects]);

  const acceptAll = useCallback(() => {
    persistConsent(ALL_CATEGORIES);
  }, [persistConsent]);

  const rejectAll = useCallback(() => {
    persistConsent(ESSENTIAL_ONLY);
  }, [persistConsent]);

  const savePreferences = useCallback(
    (categories: Partial<ConsentCategories>) => {
      persistConsent({
        ...DEFAULT_CATEGORIES,
        ...categories,
        necessary: true, // cannot be overridden
      });
    },
    [persistConsent],
  );

  const resetConsent = useCallback(() => {
    try {
      localStorage.removeItem(CONSENT_STORAGE_KEY);
    } catch {
      // ignore
    }
    setConsent(null);
    setShowBanner(true);
  }, []);

  const openCustomise = useCallback(() => setShowCustomise(true), []);
  const closeCustomise = useCallback(() => setShowCustomise(false), []);

  const hasConsentFn = useCallback(
    (category: keyof ConsentCategories): boolean => {
      if (category === 'necessary') return true;
      return consent?.categories[category] === true;
    },
    [consent],
  );

  const value: ConsentContextValue = {
    consent,
    showBanner,
    hasConsent: hasConsentFn,
    acceptAll,
    rejectAll,
    savePreferences,
    resetConsent,
    openCustomise,
    showCustomise,
    closeCustomise,
  };

  return (
    <ConsentContext.Provider value={value}>
      {children}
    </ConsentContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the current cookie consent state from anywhere in the React tree.
 *
 * @example
 * ```tsx
 * const { hasConsent } = useConsent();
 * if (hasConsent('analytics')) { initSentry(); }
 * ```
 */
export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error('useConsent must be used within a <ConsentProvider>');
  }
  return ctx;
}
