import { Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';

/**
 * GET /api/v1/admin/module-templates
 *
 * Returns active module templates, optionally filtered by ?engine_type= or ?category=.
 * The modules page uses this to offer "start from a template" when creating a module.
 */
export const getModuleTemplates = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { engine_type, category } = req.query;

  let query = supabase
    .from('module_templates')
    .select(
      'id, name, description, engine_type, category, thumbnail_url, layout, default_settings, seed_data, is_official, usage_count, created_at'
    )
    .eq('is_active', true)
    .order('is_official', { ascending: false })
    .order('usage_count', { ascending: false });

  if (typeof engine_type === 'string' && engine_type) {
    query = query.eq('engine_type', engine_type);
  }
  if (typeof category === 'string' && category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('[ModuleTemplates] Failed to fetch templates', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch module templates' });
  }

  res.json({ success: true, data: data ?? [] });
});

/**
 * GET /api/v1/admin/module-templates/:id
 */
export const getModuleTemplate = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { id } = req.params;

  const { data, error } = await supabase
    .from('module_templates')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return res.status(404).json({ success: false, error: 'Module template not found' });
  }

  // Bump usage count fire-and-forget (non-fatal)
  supabase
    .from('module_templates')
    .update({ usage_count: (data.usage_count ?? 0) + 1 })
    .eq('id', id)
    .then(({ error: updateErr }) => {
      if (updateErr) logger.warn('[ModuleTemplates] Failed to increment usage_count', updateErr);
    });

  res.json({ success: true, data });
});
