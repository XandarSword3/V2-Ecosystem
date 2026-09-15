/**
 * F11 — Business Administration navigation contract tests.
 *
 * Locks the capability-organized admin navigation so future edits cannot
 * silently regress the F11 model:
 *
 * 1. The BUSINESS category exists and contains the canonical Engine A
 *    capability items (no vertical vocabulary like restaurant/pool/snack).
 * 2. Legacy categories (marketing/operations/people) are gone.
 * 3. Permission filtering is capability-scoped: removing a permission
 *    removes exactly the capability items that require it.
 * 4. Cross-module Orders is surfaced and gated by order:read:all.
 * 5. The capability overview dashboard (admin/business) is linked.
 */

import { describe, it, expect } from 'vitest';
import {
  getStaticNavigation,
  filterNavigationByRole,
  getModuleChildren,
  flattenNavigation,
  SYSTEM_PAGE_SLUGS,
} from '@/config/admin-navigation';

const t = (key: string) => key; // identity translator — tests assert on keys/structure
const PROPERTY = 'testprop';
const base = `/${PROPERTY}/admin`;

/** Collect all item+child hrefs in a category. */
function hrefsOf(categories: ReturnType<typeof getStaticNavigation>, categoryId: string): string[] {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return [];
  const out: string[] = [];
  for (const item of cat.items) {
    out.push(item.href);
    for (const child of item.children ?? []) out.push(child.href);
  }
  return out;
}

describe('F11: Business capability navigation', () => {
  const nav = getStaticNavigation(t, PROPERTY);
  const categoryIds = nav.map((c) => c.id);

  it('has the F11 category structure: dashboard, modules, business, system', () => {
    expect(categoryIds).toEqual(['dashboard', 'modules', 'business', 'system']);
  });

  it('no longer exposes legacy platform categories', () => {
    for (const legacy of ['marketing', 'operations', 'people']) {
      expect(categoryIds).not.toContain(legacy);
    }
  });

  it('business category contains the canonical capability items', () => {
    const business = nav.find((c) => c.id === 'business')!;
    const names = business.items.map((i) => i.translationKey ?? i.name);

    // Canonical F11 capabilities present
    for (const key of [
      'nav.overview',
      'nav.orders',
      'nav.products',
      'nav.pricing',
      'nav.fulfillment',
      'nav.resources',
      'nav.customers',
      'nav.staff',
      'nav.paymentsNav',
      'nav.fiscal',
      'nav.analytics',
    ]) {
      expect(names).toContain(key);
    }
  });

  it('business category contains no vertical/legacy vocabulary', () => {
    const business = nav.find((c) => c.id === 'business')!;
    const blob = JSON.stringify(business).toLowerCase();
    for (const vertical of ['restaurant', 'pool', 'snack', 'chalet', 'kitchen', 'waitlist']) {
      expect(blob).not.toContain(vertical);
    }
  });

  it('links the cross-module orders surface gated by order:read:all', () => {
    const ordersItem = nav
      .find((c) => c.id === 'business')!
      .items.find((i) => i.translationKey === 'nav.orders');
    expect(ordersItem).toBeDefined();
    expect(ordersItem!.href).toBe(`${base}/orders`);
    expect(ordersItem!.permissions).toContain('order:read:all');
  });

  it('links the capability overview dashboard at admin/business', () => {
    const overviewItem = nav
      .find((c) => c.id === 'business')!
      .items.find((i) => i.translationKey === 'nav.overview');
    expect(overviewItem).toBeDefined();
    expect(overviewItem!.href).toBe(`${base}/business`);
  });

  it('preserves per-module configuration under dynamic MODULES category', () => {
    // getModuleChildren still derives per-module surfaces from engine_type
    const menuChildren = getModuleChildren('bistro', 'instant_transaction', t, PROPERTY);
    expect(menuChildren.some((c) => c.href === `${base}/bistro/menu`)).toBe(true);

    const bookingChildren = getModuleChildren('chalets', 'time_exclusive_reservation', t, PROPERTY);
    expect(bookingChildren.some((c) => c.href === `${base}/chalets/bookings`)).toBe(true);
  });

  it('keeps channel/integration features reachable under System settings', () => {
    const hrefs = hrefsOf(nav, 'system');
    for (const href of [`${base}/channels`, `${base}/messaging`, `${base}/parity`, `${base}/integrations`]) {
      expect(hrefs).toContain(href);
    }
  });
});

describe('F11: capability-scoped permission filtering', () => {
  it('hides exactly the capability items whose permissions are missing', () => {
    const full = getStaticNavigation(t, PROPERTY);

    // Actor with only order visibility: should see Orders but not Resources/Staff
    const ordersOnly = filterNavigationByRole(full, [], new Set(['order:read:all']));
    const businessOrdersOnly = ordersOnly.find((c) => c.id === 'business')!;
    const orderNames = businessOrdersOnly.items.map((i) => i.translationKey ?? i.name);
    expect(orderNames).toContain('nav.orders');
    expect(orderNames).not.toContain('nav.resources');
    expect(orderNames).not.toContain('nav.staff');
    // Overview has no permission gate — always visible
    expect(orderNames).toContain('nav.overview');
  });

  it('wildcard permission sees the entire capability surface', () => {
    const full = getStaticNavigation(t, PROPERTY);
    const wildcard = filterNavigationByRole(full, [], new Set(['*']));
    const business = wildcard.find((c) => c.id === 'business')!;
    // Every ungated item plus all permission-gated items survive
    expect(business.items.length).toBe(full.find((c) => c.id === 'business')!.items.length);
  });

  it('an actor with no permissions still sees the ungated overview', () => {
    const full = getStaticNavigation(t, PROPERTY);
    const none = filterNavigationByRole(full, [], new Set<string>());
    const business = none.find((c) => c.id === 'business')!;
    const names = business.items.map((i) => i.translationKey ?? i.name);
    expect(names).toContain('nav.overview');
    expect(names).not.toContain('nav.orders');
  });

  it('removes audit child from Fiscal when audit permission is missing', () => {
    const full = getStaticNavigation(t, PROPERTY);
    const noAudit = filterNavigationByRole(full, [], new Set(['admin:reports:read']));
    const fiscal = noAudit.find((c) => c.id === 'business')!.items.find(
      (i) => i.translationKey === 'nav.fiscal',
    )!;
    const childKeys = (fiscal.children ?? []).map((c) => c.translationKey ?? c.name);
    expect(childKeys).toContain('nav.financialReports');
    expect(childKeys).not.toContain('nav.auditLogs');
  });
});

describe('F11: invariants', () => {
  it('system page slugs unchanged', () => {
    expect(SYSTEM_PAGE_SLUGS).toEqual(['home-page', 'privacy-policy', 'terms-of-service']);
  });

  it('every business capability href points into the admin property namespace', () => {
    const nav = getStaticNavigation(t, PROPERTY);
    const business = nav.find((c) => c.id === 'business')!;
    for (const item of business.items) {
      expect(item.href.startsWith(base)).toBe(true);
      for (const child of item.children ?? []) {
        expect(child.href.startsWith(base)).toBe(true);
      }
    }
  });

  it('search flattening covers capability items', () => {
    const nav = getStaticNavigation(t, PROPERTY);
    const flat = flattenNavigation(nav);
    expect(flat.some((f) => f.category === 'Business' || f.category === 'nav.business')).toBe(true);
  });
});
