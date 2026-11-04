/**
 * Engine-aware admin page routing (plan F11 prerequisite — engine gate).
 *
 * Every page under /admin/[slug]/* hung on the dynamic module slug must be
 * owned by one (or more) of the platform's five engines. Until this gate,
 * every sub-page rendered for ANY module regardless of engine_type, which
 * let an Engine A module deep-link into Engine B's pricing page
 * (/units/price-rules) or Engine B's accommodation add-ons page
 * (accommodation_add_ons) and render busyness built on another engine's
 * data model.
 *
 * Source of ownership: "Architecture Designing.md" admin page listing
 * (Engine A/B tagging) plus the engine nav children in config/
 * admin-navigation.ts. A page listed for exactly one engine 404s into a
 * "not available for this module" panel when a module with a different
 * engine_type opens it.
 *
 * known owner — those render unconditioned; only ever add a page to the
 * map after checking which engine mounts the backend routes it calls.
 */

import type { EngineType } from './types';

/** All five canonical engine types, for labels in gate notices. */
export const ENGINE_LABELS: Record<EngineType, string> = {
  instant_transaction: 'Instant Transaction (Engine A)',
  time_exclusive_reservation: 'Exclusive Reservation (Engine B)',
  shared_capacity_access: 'Shared Capacity Access (Engine C)',
  ongoing_entitlement: 'Ongoing Entitlement (Engine D)',
  platform_entitlement: 'Platform Entitlement (Engine E)',
};

// Shorthands — the map mirrors the engine letters used in the planning docs.
const A: readonly EngineType[] = ['instant_transaction'];
const B: readonly EngineType[] = ['time_exclusive_reservation'];
const C: readonly EngineType[] = ['shared_capacity_access'];
const D: readonly EngineType[] = ['ongoing_entitlement'];
const E: readonly EngineType[] = ['platform_entitlement'];
const AB: readonly EngineType[] = [...A, ...B];

/**
 * Sub-path after the module slug → engines that own the page.
 * Keys may be `segment` or `segment/child` (nested pages like menu/import).
 * Lookup tries the deepest match first.
 */
export const ENGINE_PAGE_OWNERS: Record<string, readonly EngineType[]> = {
  // ── Engine A (instant_transaction) surfaces ────────────────────────────
  menu: A,
  'menu/import': A,
  categories: A,
  orders: A,
  tables: A,
  modifiers: A,

  // ── Cross-engine A/B surfaces ("Engine A/B" in Architecture Designing) ─
  addons: AB,
  pricing: AB,

  // ── Engine B (time_exclusive_reservation) surfaces ─────────────────────
  bookings: B,
  'bookings/import': B,
  calendar: B,
  'units/import': B,

  // ── Engine C (shared_capacity_access) surfaces ──────────────────────────
  capacity: C,
  sessions: C,
  tickets: C,

  // ── Engine D (ongoing_entitlement) surfaces ────────────────────────────
  members: D,
  memberships: D,

  // ── Engine E (platform_entitlement) surfaces ───────────────────────────
  plans: E,
  tenants: E,
};

/**
 * Which engines own the admin page at `subPath` (the portion of the URL
 * after the module slug, e.g. "menu", "units/import", or "" for the
 * dashboard)? Returns null for the dashboard and for pages without a
 * known owner — those render unconditioned.
 */
export function ownerEnginesFor(subPath: string): readonly EngineType[] | null {
  const clean = subPath.replace(/^\/+|\/+$/g, '');
  if (!clean) return null; // slug root = module dashboard, gated by page.tsx itself
  const parts = clean.split('/');
  if (parts.length > 1) {
    const two = `${parts[0]}/${parts[1]}`;
    if (ENGINE_PAGE_OWNERS[two]) return ENGINE_PAGE_OWNERS[two];
  }
  return ENGINE_PAGE_OWNERS[parts[0]] ?? null;
}

/**
 * Extract the engine-owned sub-path from an admin pathname.
 * e.g. "/paradise/admin/ember-grill/menu/import" → "menu/import"
 * e.g. "/paradise/admin/ember-grill" → ""
 */
export function adminSubPath(pathname: string): string {
  const parts = (pathname ?? '').split('?')[0].split('/').filter(Boolean);
  const adminIdx = parts.indexOf('admin');
  if (adminIdx === -1 || parts.length <= adminIdx + 2) return '';
  // parts[adminIdx] = 'admin', parts[adminIdx+1] = module slug
  return parts.slice(adminIdx + 2).join('/');
}
