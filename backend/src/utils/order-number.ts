/**
 * Order number display helper.
 *
 * The canonical order number is written once, at order creation, into
 * transactions.metadata.order_number (see POST /orders in
 * dynamic-module.router.ts — format `ORD-<base36 timestamp>`).
 *
 * Every place that *displays* an order number should read that value.
 * Before this helper existed, three call sites each derived their own
 * fallback independently:
 *   - dynamic-module.router.ts GET /orders/:id: ignored metadata entirely
 *     and used `id.slice(0, 8).toUpperCase()` — this is what caused the
 *     customer confirmation page to show a different number than every
 *     staff view for the same order.
 *   - dynamic-module.router.ts GET /orders (list): `ORD-${id.slice(0,8).toUpperCase()}`
 *   - module-staff.controller.ts (staff orders list): `id.slice(0, 8)`
 *     (no prefix, no uppercase)
 *
 * Only orders created before order_number was written to metadata should
 * ever hit the fallback path. New orders always have it.
 */
export function getOrderNumber(transactionId: string, metadata: Record<string, unknown> | null | undefined): string {
  const stored = (metadata ?? {})['order_number'];
  if (typeof stored === 'string' && stored.length > 0) {
    return stored;
  }
  return `ORD-${transactionId.slice(0, 8).toUpperCase()}`;
}
