/**
 * Cross-module admin catalog endpoint (F11 Products capability + Phase 8
 * catalog lifecycle).
 *
 * Aggregates catalog items across every module of the property into one
 * engine-agnostic surface. Uses the Phase 8 lifecycle model:
 *   lifecycle_status: draft | active | temporarily_unavailable | sold_out | archived
 *   is_available: operational quick-toggle (the "86" switch)
 *
 * Sellability is NEVER derived here — the canonical rule lives in
 * modules/catalog/lifecycle.ts (isProductSellable). This controller only
 * surfaces the two independent dimensions for rendering.
 */

import { Request, Response } from 'express';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { getCallerTenantId } from '../../../security/tenant-scope.js';

export async function getCrossModuleCatalog(req: Request, res: Response) {
  try {
    const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'Property ID context is required' });
    }

    const supabase = getSupabase();
    const callerTenantId = getCallerTenantId(req);

    // Scope modules exactly like the cross-engine transactions endpoint:
    // property (primary) + tenant (defense-in-depth, JWT-derived only).
    let modulesQuery = supabase
      .from('modules')
      .select('id, slug, name, engine_type, tenant_id')
      .eq('property_id', propertyId);
    if (callerTenantId !== null) {
      modulesQuery = modulesQuery.eq('tenant_id', callerTenantId);
    }
    const { data: modules, error: modulesError } = await modulesQuery;
    if (modulesError) throw modulesError;

    const moduleIds = (modules || []).map((m: { id: string }) => m.id);
    const moduleMap = new Map<string, { slug: string; name: string; engine_type: string }>();
    for (const m of modules || []) {
      moduleMap.set(m.id, { slug: m.slug, name: m.name, engine_type: m.engine_type });
    }

    if (moduleIds.length === 0) {
      return res.json({ success: true, data: { items: [], modules: [] } });
    }

    // Whitelisted filters
    const { lifecycle_status, module: moduleSlug, search, limit = '200', offset = '0' } = req.query;

    let itemsQuery = supabase
      .from('catalog_items')
      .select('id, module_id, name, description, price, currency, is_available, lifecycle_status, category_id, metadata')
      .in('module_id', moduleIds);

    if (typeof lifecycle_status === 'string' &&
        ['draft', 'active', 'temporarily_unavailable', 'sold_out', 'archived'].includes(lifecycle_status)) {
      itemsQuery = itemsQuery.eq('lifecycle_status', lifecycle_status);
    }
    if (typeof moduleSlug === 'string' && moduleSlug) {
      // `module` filter accepts a slug; resolve to id (single-module view)
      const target = Array.from(moduleMap.entries()).find(([, v]) => v.slug === moduleSlug);
      if (target) itemsQuery = itemsQuery.eq('module_id', target[0]);
    }

    const lim = Math.min(Math.max(parseInt(limit as string, 10) || 200, 1), 1000);
    const off = Math.max(parseInt(offset as string, 10) || 0, 0);

    itemsQuery = itemsQuery.order('name', { ascending: true }).range(off, off + lim - 1);

    const { data: items, error } = await itemsQuery;
    if (error) throw error;

    // Optional in-memory search filter (name). Server-side ilike would be
    // preferable at larger scale; kept simple and bounded by the limit.
    const term = typeof search === 'string' ? search.trim().toLowerCase() : '';
    const filtered = term
      ? (items || []).filter((i: { name?: string; description?: string }) =>
          (i.name || '').toLowerCase().includes(term) ||
          (i.description || '').toLowerCase().includes(term))
      : (items || []);

    // Project engine-agnostic catalog shape. The frontend renders lifecycle
    // + availability as independent dimensions; no vertical vocabulary.
    const projected = filtered.map((i: any) => {
      const module = moduleMap.get(i.module_id);
      return {
        id: i.id,
        module: module ? { slug: module.slug, name: module.name } : null,
        name: i.name,
        description: i.description ?? null,
        price: i.price,
        currency: i.currency,
        // Two independent Phase 8 dimensions
        lifecycleStatus: i.lifecycle_status ?? 'active',
        isAvailable: Boolean(i.is_available),
        isSellable: (i.lifecycle_status ?? 'active') === 'active' && Boolean(i.is_available),
        categoryId: i.category_id ?? null,
        metadata: i.metadata ?? null,
      };
    });

    res.json({
      success: true,
      data: {
        items: projected,
        modules: (modules || []).map((m: any) => ({ slug: m.slug, name: m.name, engineType: m.engine_type })),
        pagination: { limit: lim, offset: off, total: projected.length },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching cross-module catalog:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch catalog' });
  }
}
