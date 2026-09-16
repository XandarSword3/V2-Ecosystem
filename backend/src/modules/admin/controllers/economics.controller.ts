/**
 * Product economics endpoint (F13 — business economics capability).
 *
 * Computes per-product unit economics for the caller's property, closing the
 * plan's chain: Product → Resource Specification (BOM) → Consumption → Cost
 * → COGS → Margin.
 *
 *   revenue   — net sales per catalog item, from order_items joined to
 *               transactions whose status is not cancelled/void/refunded
 *               (the same revenue convention reports.controller uses)
 *   cogs      — bill-of-materials cost: menu_item_ingredients.quantity_required
 *               × inventory_items.cost_per_unit, × units sold
 *   margin    — revenue − COGS (absolute and percentage)
 *   waste     — cost of waste-type inventory transactions in the window
 *
 * Security model matches the F11 controllers: property scope comes ONLY from
 * validatePropertyAccess (req.propertyId) — never client-supplied params —
 * and the JWT-derived tenant id is applied as defense-in-depth on every
 * tenant-scoped table.
 *
 * Unit assumption (v1): menu_item_ingredients.unit is expected to be
 * compatible with the inventory item's unit. Unit conversion is a future
 * capability, not silently faked here.
 */

import { Request, Response } from 'express';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { getCallerTenantId } from '../../../security/tenant-scope.js';

/** Transaction statuses that contribute no revenue (reports convention). */
const EXCLUDED_STATUSES = new Set(['cancelled', 'void', 'refunded']);

/** Default and maximum lookback window, in days. */
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getProductEconomics(req: Request, res: Response) {
  try {
    const propertyId = (req as any).propertyId || (req.headers?.['x-property-id'] as string);
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'Property ID context is required' });
    }

    // Optional lookback window (clamped) — a reporting knob, never a scope.
    const daysRaw = parseInt(String((req.query as any)?.days ?? ''), 10);
    const days = Number.isFinite(daysRaw) && daysRaw > 0
      ? Math.min(daysRaw, MAX_DAYS)
      : DEFAULT_DAYS;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const supabase = getSupabase();
    const callerTenantId = getCallerTenantId(req);

    // Property scope + tenant defense-in-depth: the property's modules bound
    // everything downstream (catalog items belong to modules).
    let modulesQuery = supabase
      .from('modules')
      .select('id, name')
      .eq('property_id', propertyId);
    if (callerTenantId !== null) {
      modulesQuery = modulesQuery.eq('tenant_id', callerTenantId);
    }
    const { data: modules, error: modulesError } = await modulesQuery;
    if (modulesError) throw modulesError;
    const moduleIds = (modules || []).map((m: { id: string }) => m.id);

    if (moduleIds.length === 0) {
      return res.json({
        success: true,
        data: { products: [], totals: { revenue: 0, cogs: 0, margin: 0, marginPct: null, wasteCost: 0 }, waste: [], windowDays: days },
      });
    }

    // Catalog of the property, bound to the tenant-visible modules above.
    let catalogQuery = supabase
      .from('catalog_items')
      .select('id, module_id, name, price')
      .eq('property_id', propertyId)
      .is('deleted_at', null)
      .in('module_id', moduleIds);
    if (callerTenantId !== null) {
      catalogQuery = catalogQuery.eq('tenant_id', callerTenantId);
    }
    const { data: catalog, error: catalogError } = await catalogQuery;
    if (catalogError) throw catalogError;
    const items = catalog || [];
    const catalogIds = items.map((i: { id: string }) => i.id);

    if (catalogIds.length === 0) {
      return res.json({
        success: true,
        data: { products: [], totals: { revenue: 0, cogs: 0, margin: 0, marginPct: null, wasteCost: 0 }, waste: [], windowDays: days },
      });
    }

    // Sales in the window, property- and tenant-scoped.
    let salesQuery = supabase
      .from('order_items')
      .select('transaction_id, catalog_item_id, quantity, subtotal')
      .eq('property_id', propertyId)
      .in('catalog_item_id', catalogIds)
      .gte('created_at', since);
    if (callerTenantId !== null) {
      salesQuery = salesQuery.eq('tenant_id', callerTenantId);
    }
    const { data: sales, error: salesError } = await salesQuery;
    if (salesError) throw salesError;

    // Transaction statuses gate revenue (exclude cancelled/void/refunded).
    const txIds = Array.from(new Set((sales || []).map((s: { transaction_id: string }) => s.transaction_id).filter(Boolean)));
    const revenueTxIds = new Set<string>();
    if (txIds.length > 0) {
      const { data: txs, error: txError } = await supabase
        .from('transactions')
        .select('id, status')
        .in('id', txIds as string[]);
      if (txError) throw txError;
      for (const tx of txs || []) {
        if (!EXCLUDED_STATUSES.has((tx as { status: string }).status)) {
          revenueTxIds.add((tx as { id: string }).id);
        }
      }
    }

    // BOM + ingredient costs.
    let bomQuery = supabase
      .from('menu_item_ingredients')
      .select('catalog_item_id, inventory_item_id, quantity_required')
      .eq('property_id', propertyId)
      .in('catalog_item_id', catalogIds);
    if (callerTenantId !== null) {
      bomQuery = bomQuery.eq('tenant_id', callerTenantId);
    }
    const { data: bom, error: bomError } = await bomQuery;
    if (bomError) throw bomError;

    const ingredientIds = Array.from(new Set((bom || []).map((b: { inventory_item_id: string }) => b.inventory_item_id)));
    const costMap = new Map<string, number>();
    if (ingredientIds.length > 0) {
      const { data: invItems, error: invError } = await supabase
        .from('inventory_items')
        .select('id, cost_per_unit')
        .eq('property_id', propertyId)
        .is('deleted_at', null)
        .in('id', ingredientIds as string[]);
      if (invError) throw invError;
      for (const it of invItems || []) {
        costMap.set((it as { id: string }).id, Number((it as { cost_per_unit: number | null }).cost_per_unit ?? 0));
      }
    }

    // BOM cost per single unit of each product.
    const bomCostPerUnit = new Map<string, number>();
    const productsWithBom = new Set<string>();
    for (const row of bom || []) {
      const r = row as { catalog_item_id: string; inventory_item_id: string; quantity_required: string | number };
      productsWithBom.add(r.catalog_item_id);
      const cost = (costMap.get(r.inventory_item_id) ?? 0) * Number(r.quantity_required ?? 0);
      bomCostPerUnit.set(r.catalog_item_id, (bomCostPerUnit.get(r.catalog_item_id) ?? 0) + cost);
    }

    // Aggregate revenue + units per product over revenue-eligible sales.
    const revenueByProduct = new Map<string, number>();
    const unitsByProduct = new Map<string, number>();
    for (const s of sales || []) {
      const row = s as { transaction_id: string; catalog_item_id: string; quantity: number; subtotal: string | number };
      if (!row.transaction_id || !revenueTxIds.has(row.transaction_id)) continue;
      revenueByProduct.set(row.catalog_item_id, (revenueByProduct.get(row.catalog_item_id) ?? 0) + Number(row.subtotal ?? 0));
      unitsByProduct.set(row.catalog_item_id, (unitsByProduct.get(row.catalog_item_id) ?? 0) + Number(row.quantity ?? 0));
    }

    const products = items.map((i: { id: string; name: string; price: number | null }) => {
      const revenue = round2(revenueByProduct.get(i.id) ?? 0);
      const units = unitsByProduct.get(i.id) ?? 0;
      const hasBom = productsWithBom.has(i.id);
      const cogsPerUnit = hasBom ? round2(bomCostPerUnit.get(i.id) ?? 0) : null;
      const cogs = cogsPerUnit !== null ? round2(cogsPerUnit * units) : null;
      const margin = cogs !== null ? round2(revenue - cogs) : null;
      const marginPct = margin !== null && revenue > 0 ? round2((margin / revenue) * 100) : null;
      return {
        catalogItemId: i.id,
        name: i.name,
        price: i.price !== null ? Number(i.price) : null,
        unitsSold: units,
        revenue,
        cogs,
        cogsPerUnit,
        margin,
        marginPct,
        hasBom,
      };
    });

    const totalsRevenue = round2(products.reduce((acc, p) => acc + p.revenue, 0));
    const totalsCogs = round2(products.reduce((acc, p) => acc + (p.cogs ?? 0), 0));
    const totals = {
      revenue: totalsRevenue,
      cogs: totalsCogs,
      margin: round2(totalsRevenue - totalsCogs),
      // Margin percentage only meaningful when every sold product has a BOM.
      marginPct: totalsRevenue > 0 && products.every((p) => !p.unitsSold || p.hasBom)
        ? round2(((totalsRevenue - totalsCogs) / totalsRevenue) * 100)
        : null,
      wasteCost: 0,
    };

    // Waste cost in the window (property-level; not attributable per product).
    let wasteQuery = supabase
      .from('inventory_transactions')
      .select('item_id, quantity, unit_cost, total_cost')
      .eq('property_id', propertyId)
      .eq('transaction_type', 'waste')
      .gte('created_at', since);
    if (callerTenantId !== null) {
      wasteQuery = wasteQuery.eq('tenant_id', callerTenantId);
    }
    const { data: wasteRows, error: wasteError } = await wasteQuery;
    if (wasteError) throw wasteError;

    const wasteByItem = new Map<string, { quantity: number; cost: number }>();
    for (const w of wasteRows || []) {
      const row = w as { item_id: string; quantity: string | number; unit_cost: string | number | null; total_cost: string | number | null };
      const entry = wasteByItem.get(row.item_id) ?? { quantity: 0, cost: 0 };
      entry.quantity += Number(row.quantity ?? 0);
      entry.cost += row.total_cost !== null && row.total_cost !== undefined
        ? Number(row.total_cost)
        : Number(row.quantity ?? 0) * Number(row.unit_cost ?? 0);
      wasteByItem.set(row.item_id, entry);
    }
    const wasteItemIds = Array.from(wasteByItem.keys());
    const nameMap = new Map<string, string>();
    if (wasteItemIds.length > 0) {
      const { data: wasteItems, error: wasteItemsError } = await supabase
        .from('inventory_items')
        .select('id, name')
        .in('id', wasteItemIds);
      if (wasteItemsError) throw wasteItemsError;
      for (const it of wasteItems || []) {
        nameMap.set((it as { id: string }).id, (it as { name: string }).name);
      }
    }
    const waste = wasteItemIds.map((itemId) => {
      const entry = wasteByItem.get(itemId)!;
      return { itemId, name: nameMap.get(itemId) ?? 'Unknown item', quantity: round2(entry.quantity), cost: round2(entry.cost) };
    }).sort((a, b) => b.cost - a.cost);
    totals.wasteCost = round2(waste.reduce((acc, w) => acc + w.cost, 0));

    return res.json({ success: true, data: { products, totals, waste, windowDays: days } });
  } catch (err) {
    logger.error('getProductEconomics failed', { error: err instanceof Error ? err.message : err });
    return res.status(500).json({ success: false, error: 'Failed to compute product economics' });
  }
}
