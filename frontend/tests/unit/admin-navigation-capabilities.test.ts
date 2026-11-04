/**
 * Admin Navigation multi-engine platform contract tests.
 *
 * Validates that the admin navigation properly exposes all multi-engine platform categories:
 * 1. The categories exist: dashboard, modules, marketing, operations, people, system.
 * 2. Per-module configuration surfaces are derived dynamically per engine_type.
 * 3. Operations features (Orders, Fulfillment, Housekeeping, Inventory, Channels, Messaging, Parity) are reachable.
 * 4. Marketing features (Loyalty, Gift Cards, Coupons, Reviews) are reachable.
 * 5. People features (Customers, Staff, Admins, Live Users) are reachable.
 * 6. System features (Reports, Modules, Settings, Setup, Audit) are reachable.
 * 7. Admin role allows full visibility while non-admin role respects permission filtering.
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

describe('Admin: Multi-engine platform navigation', () => {
  const nav = getStaticNavigation(t, PROPERTY);
  const categoryIds = nav.map((c) => c.id);

  it('has the full platform category structure: dashboard, modules, marketing, operations, people, system', () => {
    expect(categoryIds).toEqual(['dashboard', 'modules', 'marketing', 'operations', 'people', 'system']);
  });

  it('preserves per-module configuration under dynamic MODULES category for all engines', () => {
    // Engine A: instant_transaction
    const menuChildren = getModuleChildren('bistro', 'instant_transaction', t, PROPERTY);
    expect(menuChildren.some((c) => c.href === `${base}/bistro/menu`)).toBe(true);
    expect(menuChildren.some((c) => c.href === `${base}/bistro/orders`)).toBe(true);

    // Engine B: time_exclusive_reservation
    const bookingChildren = getModuleChildren('chalets', 'time_exclusive_reservation', t, PROPERTY);
    expect(bookingChildren.some((c) => c.href === `${base}/chalets/bookings`)).toBe(true);
    expect(bookingChildren.some((c) => c.href === `${base}/chalets`)).toBe(true);

    // Engine C: shared_capacity_access
    const sessionChildren = getModuleChildren('pool', 'shared_capacity_access', t, PROPERTY);
    expect(sessionChildren.some((c) => c.href === `${base}/pool/sessions`)).toBe(true);
    expect(sessionChildren.some((c) => c.href === `${base}/pool/tickets`)).toBe(true);

    // Engine D: ongoing_entitlement
    const membershipChildren = getModuleChildren('gym', 'ongoing_entitlement', t, PROPERTY);
    expect(membershipChildren.some((c) => c.href === `${base}/gym/memberships`)).toBe(true);
  });

  it('operations category contains core operational surfaces', () => {
    const opsHrefs = hrefsOf(nav, 'operations');
    expect(opsHrefs).toContain(`${base}/orders`);
    expect(opsHrefs).toContain(`${base}/fulfillment`);
    expect(opsHrefs).toContain(`${base}/housekeeping`);
    expect(opsHrefs).toContain(`${base}/inventory`);
    expect(opsHrefs).toContain(`${base}/channels`);
    expect(opsHrefs).toContain(`${base}/messaging`);
    expect(opsHrefs).toContain(`${base}/parity`);
  });

  it('marketing category contains customer engagement surfaces', () => {
    const mktHrefs = hrefsOf(nav, 'marketing');
    expect(mktHrefs).toContain(`${base}/loyalty`);
    expect(mktHrefs).toContain(`${base}/giftcards`);
    expect(mktHrefs).toContain(`${base}/coupons`);
    expect(mktHrefs).toContain(`${base}/reviews`);
  });

  it('people category contains user administration surfaces', () => {
    const peopleHrefs = hrefsOf(nav, 'people');
    expect(peopleHrefs).toContain(`${base}/users/customers`);
    expect(peopleHrefs).toContain(`${base}/users/staff`);
    expect(peopleHrefs).toContain(`${base}/users/admins`);
    expect(peopleHrefs).toContain(`${base}/users/live`);
  });

  it('system category contains reports, settings, setup, and audit', () => {
    const sysHrefs = hrefsOf(nav, 'system');
    expect(sysHrefs).toContain(`${base}/cockpit`);
    expect(sysHrefs).toContain(`${base}/modules`);
    expect(sysHrefs).toContain(`${base}/settings`);
    expect(sysHrefs).toContain(`${base}/setup`);
    expect(sysHrefs).toContain(`${base}/audit`);
  });
});

describe('Admin: Role and permission filtering', () => {
  it('admin role sees all categories and items without being blocked by empty permissions', () => {
    const full = getStaticNavigation(t, PROPERTY);
    const adminView = filterNavigationByRole(full, ['admin'], new Set<string>());
    const categoryIds = adminView.map((c) => c.id);
    expect(categoryIds).toContain('dashboard');
    expect(categoryIds).toContain('marketing');
    expect(categoryIds).toContain('operations');
    expect(categoryIds).toContain('people');
    expect(categoryIds).toContain('system');

    // Operations items are all present
    const ops = adminView.find((c) => c.id === 'operations')!;
    const opsNames = ops.items.map((i) => i.name);
    expect(opsNames).toContain('nav.orders');
    expect(opsNames).toContain('nav.inventory');
  });

  it('super_admin sees multi-property item', () => {
    const full = getStaticNavigation(t, PROPERTY);
    const superAdminView = filterNavigationByRole(full, ['super_admin'], new Set<string>());
    const opsHrefs = hrefsOf(superAdminView, 'operations');
    expect(opsHrefs).toContain(`${base}/properties`);
  });

  it('non-admin role without permissions is filtered appropriately', () => {
    const full = getStaticNavigation(t, PROPERTY);
    // User with only staff role and no admin role
    const staffView = filterNavigationByRole(full, ['staff'], new Set(['order:read:all']));
    const ops = staffView.find((c) => c.id === 'operations')!;
    const opsNames = ops.items.map((i) => i.name);
    expect(opsNames).toContain('nav.orders');
    expect(opsNames).not.toContain('nav.inventory');
  });
});

describe('Admin: Invariants', () => {
  it('system page slugs unchanged', () => {
    expect(SYSTEM_PAGE_SLUGS).toEqual(['home-page', 'privacy-policy', 'terms-of-service']);
  });

  it('every href points into the admin property namespace', () => {
    const nav = getStaticNavigation(t, PROPERTY);
    for (const cat of nav) {
      for (const item of cat.items) {
        expect(item.href.startsWith(base)).toBe(true);
        for (const child of item.children ?? []) {
          expect(child.href.startsWith(base)).toBe(true);
        }
      }
    }
  });

  it('search flattening covers all navigation items', () => {
    const nav = getStaticNavigation(t, PROPERTY);
    const flat = flattenNavigation(nav);
    expect(flat.length).toBeGreaterThan(15);
    expect(flat.some((f) => f.href.includes('/orders'))).toBe(true);
    expect(flat.some((f) => f.href.includes('/inventory'))).toBe(true);
  });
});
