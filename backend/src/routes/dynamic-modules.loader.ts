import express from 'express';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { buildModuleRouter } from './dynamic-module.router.js';

const dynamicModulesRouter = express.Router();
const dynamicModuleMounts = new Set<string>();
const STATIC_MODULE_SLUGS = new Set(['restaurant', 'pool', 'chalets']);

interface ActiveModuleRow {
  id: string;
  slug: string;
  template_type: string;
  property_id?: string | null;
}

export function getDynamicModulesRouter(): express.Router {
  return dynamicModulesRouter;
}

export async function loadDynamicModules(): Promise<void> {
  const supabase = getSupabase();

  const { data: modules, error } = await supabase
    .from('modules')
    .select('id, slug, template_type, property_id')
    .eq('is_active', true)
    .not('slug', 'is', null)
    .not('template_type', 'is', null);

  if (error) {
    logger.error('[Dynamic Modules] Failed to load modules', error);
    throw error;
  }

  dynamicModulesRouter.stack = [];
  dynamicModuleMounts.clear();

  (modules as ActiveModuleRow[] | null)?.forEach((module) => {
    if (!module.slug || !module.template_type) return;

    if (STATIC_MODULE_SLUGS.has(module.slug)) {
      logger.warn(`[Dynamic Modules] Conflict detected for slug '${module.slug}'. Static route kept, dynamic mount skipped.`);
      return;
    }

    const moduleRouter = buildModuleRouter(module.template_type);
    dynamicModulesRouter.use(
      `/${module.slug}`,
      (req, _res, next) => {
        (req as express.Request & {
          mountedModule?: { id: string; slug: string; template_type: string; property_id?: string | null };
        }).mountedModule = {
          id: module.id,
          slug: module.slug,
          template_type: module.template_type,
          property_id: module.property_id,
        };
        next();
      },
      moduleRouter,
    );

    dynamicModuleMounts.add(module.slug);
    logger.info(`[Dynamic Modules] Mounted /api/v1/${module.slug} (${module.template_type})`);
  });

  logger.info(`[Dynamic Modules] Loaded ${dynamicModuleMounts.size} dynamic module route(s).`);
}
