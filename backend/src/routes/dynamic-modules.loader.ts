import express from 'express';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { buildModuleRouter } from './dynamic-module.router.js';

const dynamicModulesRouter = express.Router();
const dynamicModuleMounts = new Set<string>();

interface ActiveModuleRow {
  id: string;
  slug: string;
  engine_type: string;
  template_type?: string; // Backward compatibility
  property_id?: string | null;
  tenant_id?: string | null;
}

export function getDynamicModulesRouter(): express.Router {
  return dynamicModulesRouter;
}

export async function loadDynamicModules(): Promise<void> {
  const supabase = getSupabase();

  const { data: modules, error } = await supabase
    .from('modules')
    .select('id, slug, engine_type, property_id, tenant_id')
    .eq('is_active', true)
    .not('slug', 'is', null)
    .not('engine_type', 'is', null);

  if (error) {
    logger.error('[Dynamic Modules] Failed to load modules', error);
    throw error;
  }

  dynamicModulesRouter.stack = [];
  dynamicModuleMounts.clear();

  // Group rows by slug — multiple tenants may legitimately share a slug
  // (see modules.controller.ts createModule, "Q171 — scope slug uniqueness
  // to tenant"). Express can only ever match ONE middleware chain per
  // literal path, so previously each row got its own, separate
  // dynamicModulesRouter.use('/${slug}', ...) call: a slug collision meant
  // whichever tenant's row loaded FIRST silently and permanently shadowed
  // every other tenant's identically-slugged module for every request —
  // a real cross-tenant misrouting bug (wrong module_id/property_id/
  // tenant_id used under the hood), not just a duplicate startup log line.
  const rowsBySlug = new Map<string, ActiveModuleRow[]>();
  (modules as ActiveModuleRow[] | null)?.forEach((module) => {
    if (!module.slug || !module.engine_type) return;
    const list = rowsBySlug.get(module.slug) ?? [];
    list.push(module);
    rowsBySlug.set(module.slug, list);
  });

  rowsBySlug.forEach((rows, slug) => {
    // Build one router per distinct engine_type among these rows. In
    // practice tenants sharing a slug almost always pick the same engine
    // type, but nothing enforces that — don't assume it.
    const routersByEngineType = new Map<string, express.Router>();
    rows.forEach((row) => {
      if (!routersByEngineType.has(row.engine_type)) {
        routersByEngineType.set(row.engine_type, buildModuleRouter(row.engine_type));
      }
    });

    dynamicModulesRouter.use(`/${slug}`, (req, res, next) => {
      const dynReq = req as express.Request & {
        tenant?: { id: string };
        mountedModule?: { id: string; slug: string; engine_type: string; property_id?: string | null; tenant_id?: string | null };
      };

      // tenantGate runs ahead of this router in app.ts's apiRouter chain,
      // so req.tenant is already resolved here when a tenant is known.
      // Internal callers that skip tenant resolution can still pass the
      // header directly (same fallback pattern used across the codebase).
      //
      // NOT fixed alongside the rest of Phase 0/1 — unlike the ownership
      // checks in modules/pricing/customization controllers, this resolves
      // WHICH mounted-module config to route a request to (config lookup,
      // not a data-mutation ownership check), and there's an explicit
      // "internal callers" carve-out in the comment above suggesting the
      // header path may be load-bearing for something. Needs someone who
      // knows what calls this internally before swapping it to
      // getCallerTenantId() blind — flagging via the lint exception below
      // rather than guessing.
      // eslint-disable-next-line no-restricted-syntax
      const requestTenantId = dynReq.tenant?.id || (req.headers?.['x-tenant-id'] as string | undefined) || null;

      // Resolution order:
      //   1. Exact tenant match — this request's tenant owns one of these rows.
      //   2. An unscoped/global row (tenant_id IS NULL).
      //   3. If this slug has exactly one row total, use it regardless of
      //      tenant — preserves existing behavior for the common case
      //      (~15 pre-existing modules) where no collision exists at all.
      // If none of these match, this tenant has no business seeing any
      // module at this slug — fall through rather than leak another
      // tenant's module context.
      const selected =
        (requestTenantId ? rows.find((row) => row.tenant_id === requestTenantId) : undefined) ??
        rows.find((row) => !row.tenant_id) ??
        (rows.length === 1 ? rows[0] : undefined);

      if (!selected) {
        next();
        return;
      }

      dynReq.mountedModule = {
        id: selected.id,
        slug: selected.slug,
        engine_type: selected.engine_type,
        property_id: selected.property_id,
        tenant_id: selected.tenant_id,
      };

      const moduleRouter = routersByEngineType.get(selected.engine_type)!;
      moduleRouter(req, res, next);
    });

    dynamicModuleMounts.add(slug);
    const engineTypes = [...routersByEngineType.keys()].join(', ');
    const collisionNote = rows.length > 1 ? ` — ${rows.length} tenant-scoped rows sharing this slug` : '';
    logger.info(`[Dynamic Modules] Mounted /api/v1/${slug} (${engineTypes})${collisionNote}`);
  });

  logger.info(`[Dynamic Modules] Loaded ${dynamicModuleMounts.size} dynamic module route(s).`);
}
