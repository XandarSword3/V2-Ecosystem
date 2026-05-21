'use client';

import { useState, useEffect } from 'react';
import { Cookie, Shield, BarChart, Target } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/Accordion';
import { Switch } from '@/components/ui/Switch';
import { useConsent, type ConsentCategories } from '@/context/ConsentContext';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Cookie category metadata — used by both the banner and /cookie-policy page
// ---------------------------------------------------------------------------

export interface CookieCategoryMeta {
  id: keyof ConsentCategories;
  name: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
  cookies: { name: string; purpose: string; duration: string }[];
}

export const COOKIE_CATEGORIES: CookieCategoryMeta[] = [
  {
    id: 'necessary',
    name: 'Strictly Necessary',
    description:
      'These cookies are essential for the website to function properly. They enable basic functions like page navigation, access to secure areas, and session management. The website cannot function properly without these cookies.',
    icon: <Shield className="h-5 w-5" />,
    required: true,
    cookies: [
      { name: 'cookie-consent', purpose: 'Stores your cookie consent preferences', duration: 'Persistent' },
      { name: 'accessToken', purpose: 'Authentication token (localStorage)', duration: 'Session' },
      { name: 'refreshToken', purpose: 'Token refresh (localStorage)', duration: '30 days' },
      { name: 'user', purpose: 'Cached user profile (localStorage)', duration: 'Session' },
      // GDPR: theme localStorage is classified as strictly necessary to prevent
      // a flash of wrong theme colours. See layout.tsx inline script.
      { name: 'v2-ecosystem-theme', purpose: 'Prevents flash of wrong theme on page load', duration: 'Persistent' },
      { name: 'theme', purpose: 'Light/dark mode preference to prevent flicker', duration: 'Persistent' },
    ],
  },
  {
    id: 'functional',
    name: 'Functional',
    description:
      'These cookies enable enhanced functionality and personalization, such as remembering your preferences, language settings, and live page tracking for staff dashboards.',
    icon: <Cookie className="h-5 w-5" />,
    required: false,
    cookies: [
      { name: 'NEXT_LOCALE', purpose: 'Stores language preference', duration: '1 year' },
      { name: 'pwa-install-dismissed', purpose: 'Remembers PWA install prompt dismissal', duration: 'Persistent' },
      { name: 'v2-settings-updated', purpose: 'Cross-tab settings synchronisation', duration: 'Transient' },
      { name: 'sidebar-categories', purpose: 'Admin sidebar expanded/collapsed state', duration: 'Persistent' },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description:
      'These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our services.',
    icon: <BarChart className="h-5 w-5" />,
    required: false,
    cookies: [
      // No analytics cookies are currently active. When Sentry or Google
      // Analytics is enabled in the future, add entries here and gate
      // initialisation behind this consent category.
      { name: '(none active)', purpose: 'No analytics cookies are currently set', duration: 'N/A' },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description:
      'These cookies are used to track visitors across websites. The intention is to display ads that are relevant and engaging for the individual user.',
    icon: <Target className="h-5 w-5" />,
    required: false,
    cookies: [
      // No marketing cookies are currently active.
      { name: '(none active)', purpose: 'No marketing cookies are currently set', duration: 'N/A' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CookieConsentBanner() {
  const {
    showBanner,
    showCustomise,
    openCustomise,
    closeCustomise,
    acceptAll,
    rejectAll,
    savePreferences,
    consent,
  } = useConsent();

  // Local toggle state for the customise dialog.
  // Synced from ConsentContext whenever the dialog opens.
  const [localCategories, setLocalCategories] = useState<ConsentCategories>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });

  // Re-sync local toggles with the current consent state every time
  // the customise dialog is opened (handles reopens after accept/reject).
  useEffect(() => {
    if (showCustomise) {
      setLocalCategories({
        necessary: true,
        functional: consent?.categories.functional ?? false,
        analytics: consent?.categories.analytics ?? false,
        marketing: consent?.categories.marketing ?? false,
      });
    }
  }, [showCustomise, consent]);

  // Toggle a single category — only mutates local state.
  // The save is deferred until the user explicitly clicks "Save Preferences".
  const handleToggle = (category: keyof ConsentCategories, checked: boolean) => {
    if (category === 'necessary') return;
    setLocalCategories(prev => ({ ...prev, [category]: checked }));
  };

  // Persist the current local toggle state as the user's consent decision.
  // By the time the user clicks this button, React has re-rendered with all
  // accumulated toggle changes, so localCategories is up-to-date.
  const handleSavePreferences = () => {
    savePreferences(localCategories);
  };

  if (!showBanner && !showCustomise) return null;

  return (
    <>
      {/* ----------------------------------------------------------------- */}
      {/* Simple Banner                                                     */}
      {/* ----------------------------------------------------------------- */}
      {showBanner && !showCustomise && (
        <div
          id="cookie-consent-banner"
          role="dialog"
          aria-label="Cookie consent"
          className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg animate-in slide-in-from-bottom duration-300"
        >
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Cookie className="h-6 w-6 flex-shrink-0 mt-1 text-primary" />
                <div>
                  <h3 className="font-semibold">We use cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    We use cookies to improve your experience and for core site
                    functionality. By clicking &quot;Accept All&quot;, you
                    consent to our use of cookies.{' '}
                    <Link
                      href="/cookie-policy"
                      className="text-primary underline hover:no-underline"
                    >
                      Cookie Policy
                    </Link>
                    {' · '}
                    <Link
                      href="/privacy"
                      className="text-primary underline hover:no-underline"
                    >
                      Privacy Policy
                    </Link>
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Button
                  id="cookie-reject-all"
                  variant="outline"
                  onClick={rejectAll}
                >
                  Reject All
                </Button>
                <Button
                  id="cookie-customise"
                  variant="outline"
                  onClick={openCustomise}
                >
                  Customise
                </Button>
                <Button id="cookie-accept-all" onClick={acceptAll}>
                  Accept All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Detailed Preferences Modal                                        */}
      {/* ----------------------------------------------------------------- */}
      <Dialog open={showCustomise} onOpenChange={open => { if (!open) closeCustomise(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Manage your cookie preferences. You can enable or disable
              different types of cookies below. Read our{' '}
              <Link
                href="/cookie-policy"
                className="text-primary underline hover:no-underline"
              >
                Cookie Policy
              </Link>{' '}
              for full details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Accordion type="multiple" className="w-full">
              {COOKIE_CATEGORIES.map(category => (
                <AccordionItem key={category.id} value={category.id}>
                  <div className="flex items-center justify-between py-2">
                    <AccordionTrigger className="flex-1 hover:no-underline">
                      <div className="flex items-center gap-3">
                        {category.icon}
                        <span className="font-medium">{category.name}</span>
                        {category.required && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">
                            Required
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <Switch
                      checked={localCategories[category.id]}
                      onCheckedChange={(checked) => handleToggle(category.id, checked)}
                      disabled={category.required}
                      className="ml-4"
                    />
                  </div>
                  <AccordionContent>
                    <div className="space-y-3 pl-8">
                      <p className="text-sm text-muted-foreground">
                        {category.description}
                      </p>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">
                                Cookie
                              </th>
                              <th className="px-3 py-2 text-left font-medium">
                                Purpose
                              </th>
                              <th className="px-3 py-2 text-left font-medium">
                                Duration
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.cookies.map(cookie => (
                              <tr key={cookie.name} className="border-t">
                                <td className="px-3 py-2 font-mono text-xs">
                                  {cookie.name}
                                </td>
                                <td className="px-3 py-2">{cookie.purpose}</td>
                                <td className="px-3 py-2">
                                  {cookie.duration}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={rejectAll}>
              Reject All
            </Button>
            <Button variant="outline" onClick={acceptAll}>
              Accept All
            </Button>
            <Button onClick={handleSavePreferences}>Save Preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Re-export for backward compatibility
export default CookieConsentBanner;

// Re-export consent types and hook for convenience
export { useConsent } from '@/context/ConsentContext';
export type { ConsentCategories } from '@/context/ConsentContext';
