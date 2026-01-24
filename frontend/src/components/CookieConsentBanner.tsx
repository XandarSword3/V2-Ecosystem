'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/Label';
import { Checkbox } from '@/components/ui/Checkbox';
import { Cookie, Shield, BarChart, Target, Info } from 'lucide-react';
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
import { cn } from '@/lib/utils';

interface CookieConsent {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
  version: string;
}

const CONSENT_VERSION = '1.0';
const CONSENT_STORAGE_KEY = 'cookie-consent';

interface CookieCategory {
  id: keyof Omit<CookieConsent, 'timestamp' | 'version'>;
  name: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
  cookies: { name: string; purpose: string; duration: string }[];
}

const COOKIE_CATEGORIES: CookieCategory[] = [
  {
    id: 'necessary',
    name: 'Strictly Necessary',
    description: 'These cookies are essential for the website to function properly. They enable basic functions like page navigation, access to secure areas, and session management. The website cannot function properly without these cookies.',
    icon: <Shield className="h-5 w-5" />,
    required: true,
    cookies: [
      { name: 'session_id', purpose: 'Maintains user session', duration: 'Session' },
      { name: 'csrf_token', purpose: 'Security token for form submissions', duration: 'Session' },
      { name: 'auth_token', purpose: 'Authentication token', duration: '30 days' },
    ],
  },
  {
    id: 'functional',
    name: 'Functional',
    description: 'These cookies enable enhanced functionality and personalization, such as remembering your preferences, language settings, and login details.',
    icon: <Cookie className="h-5 w-5" />,
    required: false,
    cookies: [
      { name: 'lang', purpose: 'Stores language preference', duration: '1 year' },
      { name: 'theme', purpose: 'Stores theme preference', duration: '1 year' },
      { name: 'remember_me', purpose: 'Enables persistent login', duration: '30 days' },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our services.',
    icon: <BarChart className="h-5 w-5" />,
    required: false,
    cookies: [
      { name: '_ga', purpose: 'Google Analytics tracking', duration: '2 years' },
      { name: '_gid', purpose: 'Google Analytics session tracking', duration: '24 hours' },
      { name: 'plausible', purpose: 'Privacy-friendly analytics', duration: '1 year' },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'These cookies are used to track visitors across websites. The intention is to display ads that are relevant and engaging for the individual user.',
    icon: <Target className="h-5 w-5" />,
    required: false,
    cookies: [
      { name: '_fbp', purpose: 'Facebook pixel tracking', duration: '90 days' },
      { name: 'ads_prefs', purpose: 'Advertising preferences', duration: '2 years' },
    ],
  },
];

export function CookieConsentBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [consent, setConsent] = useState<CookieConsent>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
    timestamp: 0,
    version: CONSENT_VERSION,
  });

  useEffect(() => {
    // Check for existing consent
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CookieConsent;
        
        // Check if consent version matches
        if (parsed.version === CONSENT_VERSION) {
          setConsent(parsed);
          applyConsent(parsed);
          return;
        }
      } catch {
        // Invalid stored consent
      }
    }
    
    // Show banner if no valid consent
    setIsOpen(true);
  }, []);

  const applyConsent = (consentData: CookieConsent) => {
    // Apply consent settings
    if (typeof window !== 'undefined') {
      // Update data layer for analytics
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'consent_update',
        consent: {
          necessary: consentData.necessary,
          functional: consentData.functional,
          analytics: consentData.analytics,
          marketing: consentData.marketing,
        },
      });

      // Enable/disable tracking based on consent
      if (!consentData.analytics) {
        // Disable Google Analytics
        window['ga-disable-GA_MEASUREMENT_ID'] = true;
      }

      if (!consentData.marketing) {
        // Disable Facebook Pixel
        window.fbq?.('consent', 'revoke');
      } else {
        window.fbq?.('consent', 'grant');
      }
    }
  };

  const saveConsent = (consentData: CookieConsent) => {
    const updatedConsent = {
      ...consentData,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    };
    
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(updatedConsent));
    setConsent(updatedConsent);
    applyConsent(updatedConsent);
    setIsOpen(false);
  };

  const handleAcceptAll = () => {
    saveConsent({
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    });
  };

  const handleRejectNonEssential = () => {
    saveConsent({
      necessary: true,
      functional: false,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    });
  };

  const handleSavePreferences = () => {
    saveConsent(consent);
  };

  const handleToggle = (
    category: keyof Omit<CookieConsent, 'timestamp' | 'version'>
  ) => {
    if (category === 'necessary') return; // Cannot disable necessary cookies
    
    setConsent(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Simple Banner */}
      {!showDetails && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg">
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Cookie className="h-6 w-6 flex-shrink-0 mt-1 text-primary" />
                <div>
                  <h3 className="font-semibold">We use cookies</h3>
                  <p className="text-sm text-muted-foreground">
                    We use cookies to improve your experience, analyze site traffic, and for marketing. 
                    By clicking "Accept All", you consent to our use of cookies.{' '}
                    <button
                      onClick={() => setShowDetails(true)}
                      className="text-primary underline hover:no-underline"
                    >
                      Learn more
                    </button>
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Button variant="outline" onClick={handleRejectNonEssential}>
                  Reject Non-Essential
                </Button>
                <Button variant="outline" onClick={() => setShowDetails(true)}>
                  Customize
                </Button>
                <Button onClick={handleAcceptAll}>
                  Accept All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Preferences Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Manage your cookie preferences. You can enable or disable different types of cookies below.
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
                      checked={consent[category.id]}
                      onCheckedChange={() => handleToggle(category.id)}
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
                              <th className="px-3 py-2 text-left font-medium">Cookie</th>
                              <th className="px-3 py-2 text-left font-medium">Purpose</th>
                              <th className="px-3 py-2 text-left font-medium">Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.cookies.map(cookie => (
                              <tr key={cookie.name} className="border-t">
                                <td className="px-3 py-2 font-mono text-xs">
                                  {cookie.name}
                                </td>
                                <td className="px-3 py-2">{cookie.purpose}</td>
                                <td className="px-3 py-2">{cookie.duration}</td>
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
            <Button variant="outline" onClick={handleRejectNonEssential}>
              Reject Non-Essential
            </Button>
            <Button variant="outline" onClick={handleAcceptAll}>
              Accept All
            </Button>
            <Button onClick={handleSavePreferences}>
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Utility function to check consent
export function hasConsent(
  category: keyof Omit<CookieConsent, 'timestamp' | 'version'>
): boolean {
  if (typeof window === 'undefined') return false;
  
  const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (!stored) return false;
  
  try {
    const consent = JSON.parse(stored) as CookieConsent;
    return consent[category] === true;
  } catch {
    return false;
  }
}

// Hook for accessing consent state
export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored) {
      try {
        setConsent(JSON.parse(stored));
      } catch {
        setConsent(null);
      }
    }
  }, []);

  return {
    consent,
    hasConsent: (category: keyof Omit<CookieConsent, 'timestamp' | 'version'>) => 
      consent?.[category] ?? false,
    resetConsent: () => {
      localStorage.removeItem(CONSENT_STORAGE_KEY);
      setConsent(null);
      window.location.reload();
    },
  };
}

// Extend window type for tracking libraries
declare global {
  interface Window {
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
    'ga-disable-GA_MEASUREMENT_ID'?: boolean;
  }
}

export default CookieConsentBanner;
