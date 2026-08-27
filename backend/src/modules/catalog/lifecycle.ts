/**
 * Phase 8: Canonical catalog product lifecycle.
 *
 * Legal transitions:
 *
 *   draft ──activate──→ active
 *   active ──temporarily_unavailable──→ temporarily_unavailable
 *   active ──sell_out──→ sold_out
 *   active ──archive──→ archived
 *   temporarily_unavailable ──restore──→ active
 *   temporarily_unavailable ──sell_out──→ sold_out
 *   temporarily_unavailable ──archive──→ archived
 *
 * sold_out and archived are terminal — no outgoing transitions.
 * draft cannot jump to sold_out or archived directly.
 * archived cannot reactivate (unarchive is not a legal move — create a new product).
 */

export type CatalogLifecycleStatus =
  | 'draft'
  | 'active'
  | 'temporarily_unavailable'
  | 'sold_out'
  | 'archived';

export const ALL_LIFECYCLE_STATUSES: readonly CatalogLifecycleStatus[] = [
  'draft',
  'active',
  'temporarily_unavailable',
  'sold_out',
  'archived',
];

/**
 * Legal transitions: from → set of legal target states.
 * Enforced server-side on every lifecycle mutation.
 */
const TRANSITION_GRAPH: Record<CatalogLifecycleStatus, readonly CatalogLifecycleStatus[]> = {
  draft: ['active'],
  active: ['temporarily_unavailable', 'sold_out', 'archived'],
  temporarily_unavailable: ['active', 'sold_out', 'archived'],
  sold_out: [],   // terminal
  archived: [],   // terminal
};

/**
 * Check whether a lifecycle transition is legal.
 * Returns true if the transition is allowed, false otherwise.
 */
export function isValidLifecycleTransition(
  from: CatalogLifecycleStatus,
  to: CatalogLifecycleStatus,
): boolean {
  return TRANSITION_GRAPH[from]?.includes(to) ?? false;
}

/**
 * Action names that trigger lifecycle transitions.
 * Maps frontend/admin action names to the target lifecycle state.
 */
export const LIFECYCLE_ACTIONS: Record<string, CatalogLifecycleStatus> = {
  activate: 'active',
  temporarily_unavailable: 'temporarily_unavailable',
  restore: 'active',
  sell_out: 'sold_out',
  archive: 'archived',
};

/**
 * Validate and resolve a lifecycle action to a target state.
 * Returns null if the action or transition is invalid.
 */
export function resolveLifecycleAction(
  currentStatus: CatalogLifecycleStatus,
  action: string,
): CatalogLifecycleStatus | null {
  const target = LIFECYCLE_ACTIONS[action];
  if (!target) return null;
  if (!isValidLifecycleTransition(currentStatus, target)) return null;
  return target;
}

// ============================================
// Sellability rule (Phase 8 — centralized)
// ============================================

/**
 * Is this product sellable? Centralizes ALL sellability constraints:
 *   - lifecycle_status must be 'active'
 *   - is_available must be true
 *   - (future: inventory/resource availability check)
 *
 * This is the ONE function every sellability check routes through.
 * No frontend or endpoint should independently decide "is this for sale?"
 */
export function isProductSellable(params: {
  lifecycleStatus: CatalogLifecycleStatus;
  isAvailable: boolean;
  // future: hasInventory?: boolean;
}): boolean {
  return params.lifecycleStatus === 'active' && params.isAvailable;
}

/**
 * Semantics of lifecycle_status vs is_available (Phase 8):
 *
 * lifecycle_status: the PRODUCT'S LIFECYCLE STATE — a deliberate business
 * decision about where this product is in its lifecycle.
 *   - draft: being prepared, not yet published
 *   - active: live and sellable (subject to is_available)
 *   - temporarily_unavailable: deliberately paused (e.g., ingredient shortage,
 *     seasonal break, maintenance) — expected to return
 *   - sold_out: depleted (manual or resource-derived), expected to return
 *   - archived: permanently removed from the catalog
 *
 * is_available: a QUICK-TOGGLE for operational availability — "can I sell
 * this RIGHT NOW?" This is the toggle staff flip during service:
 *   - true: available for immediate sale
 *   - false: temporarily unavailable for the current service period
 *
 * The two are INDEPENDENT DIMENSIONS:
 *   lifecycle_status='active' + is_available=false → product exists but
 *     is temporarily off (e.g., 86'd for the night)
 *   lifecycle_status='active' + is_available=true → product is live
 *   lifecycle_status='sold_out' + is_available=true → semantically invalid
 *     (sold out implies not available) — the sellability rule catches this
 *   lifecycle_status='draft' + is_available=true → draft not published yet
 *
 * sold_out semantics (Phase 8):
 *   - sold_out is a PERSISTED BUSINESS STATE, not derived from inventory.
 *   - A product becomes sold_out when the business decides to mark it so
 *     (either manually or via a configured rule).
 *   - Inventory reaching zero does NOT automatically set sold_out — that
 *     would create a coupling between inventory state and catalog state
 *     that prevents manual override (e.g., "we expect more tomorrow,
 *     keep accepting pre-orders").
 *   - The sellability rule checks lifecycle_status first, then is_available.
 *     If the business wants inventory-driven sold_out, they configure an
 *     automation (future Phase 19) that SETS lifecycle_status=sold_out
 *     when inventory hits zero — but the catalog state remains the
 *     authority, not the inventory count.
 */
