import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/Switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, className }: any) => (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      className={className}
      onChange={() => onCheckedChange?.(!checked)}
    />
  ),
}));

vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h3>{children}</h3>,
}));

vi.mock('@/components/ui/Accordion', () => ({
  Accordion: ({ children }: any) => <div>{children}</div>,
  AccordionItem: ({ children }: any) => <div>{children}</div>,
  AccordionTrigger: ({ children }: any) => <button type="button">{children}</button>,
  AccordionContent: ({ children }: any) => <div>{children}</div>,
}));

import { CookieConsentBanner } from '../../src/components/CookieConsentBanner';
import { ConsentProvider } from '../../src/context/ConsentContext';

const CONSENT_STORAGE_KEY = 'cookie-consent';

describe('CookieConsentBanner behavior', () => {
  beforeEach(() => {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    (window as any).dataLayer = [];
    (window as any).fbq = vi.fn();
    delete (window as any)['ga-disable-GA_MEASUREMENT_ID'];
  });

  it('shows banner and accepts all cookie categories', async () => {
    const user = userEvent.setup();

    render(
      <ConsentProvider>
        <CookieConsentBanner />
      </ConsentProvider>
    );

    expect(screen.getByText('We use cookies')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept All' }));

    await waitFor(() => {
      expect(screen.queryByText('We use cookies')).not.toBeInTheDocument();
    });

    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) || '{}');
    expect(stored.categories.necessary).toBe(true);
    expect(stored.categories.functional).toBe(true);
    expect(stored.categories.analytics).toBe(true);
    expect(stored.categories.marketing).toBe(true);

    const dataLayerEvents = (window as any).dataLayer;
    expect(dataLayerEvents[dataLayerEvents.length - 1]).toEqual(
      expect.objectContaining({
        event: 'consent_update',
        consent: {
          necessary: true,
          functional: true,
          analytics: true,
          marketing: true,
        },
      })
    );

    expect((window as any).fbq).toHaveBeenCalledWith('consent', 'grant');
  });

  it('rejects non-essential cookies and revokes marketing consent', async () => {
    const user = userEvent.setup();

    render(
      <ConsentProvider>
        <CookieConsentBanner />
      </ConsentProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Reject All' }));

    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) || '{}');
    expect(stored.categories.necessary).toBe(true);
    expect(stored.categories.functional).toBe(false);
    expect(stored.categories.analytics).toBe(false);
    expect(stored.categories.marketing).toBe(false);

    expect((window as any)['ga-disable-GA_MEASUREMENT_ID']).toBe(true);
    expect((window as any).fbq).toHaveBeenCalledWith('consent', 'revoke');
  });

  it('honors stored consent when version matches and does not show the banner', async () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        categories: {
          necessary: true,
          functional: true,
          analytics: false,
          marketing: false,
        },
        timestamp: Date.now(),
        version: '1.0',
      })
    );

    render(
      <ConsentProvider>
        <CookieConsentBanner />
      </ConsentProvider>
    );

    expect(screen.queryByText('We use cookies')).not.toBeInTheDocument();

    await waitFor(() => {
      const dataLayerEvents = (window as any).dataLayer;
      expect(dataLayerEvents[dataLayerEvents.length - 1]).toEqual(
        expect.objectContaining({
          event: 'consent_update',
          consent: expect.objectContaining({
            necessary: true,
            functional: true,
            analytics: false,
            marketing: false,
          }),
        })
      );
    });
  });
});
