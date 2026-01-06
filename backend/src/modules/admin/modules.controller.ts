import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection";
import { emitToAll } from "../../socket";
import { clearModuleCache } from "../../middleware/moduleGuard.middleware";
import { createModuleSchema, updateModuleSchema, validateBody } from "../../validation/schemas";

export async function getModules(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { activeOnly } = req.query;
    
    let query = supabase
      .from('modules')
      .select('*')
      .order('sort_order', { ascending: true });

    if (activeOnly === 'true') {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch modules' });
  }
}

export async function getModule(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    // Try to fetch by id first
    let { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('id', id)
      .single();

    // If not found by id, try slug
    if ((error || !data) && id) {
      const { data: bySlug, error: slugErr } = await supabase
        .from('modules')
        .select('*')
        .eq('slug', id)
        .single();

      if (slugErr) throw slugErr;
      if (!bySlug) return res.status(404).json({ success: false, error: 'Module not found' });

      data = bySlug;
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}


export async function createModule(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { template_type, name, slug, description, settings } = req.body;

    // Generate slug if not provided
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data, error } = await supabase
      .from('modules')
      .insert({
        template_type,
        name,
        slug: finalSlug,
        description,
        settings: settings || {},
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    emitToAll('modules.updated', data);

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateModule(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate input
    const validatedData = validateBody(updateModuleSchema, req.body);
    
    const supabase = getSupabase();
    const { id } = req.params;

    const { data, error } = await supabase
      .from('modules')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Clear module cache so changes take effect immediately
    clearModuleCache(data.slug);
    
    emitToAll('modules.updated', data);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteModule(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const force = req.query.force === 'true';

    if (force) {
      // Attempt hard delete
      const { error: delErr } = await supabase
        .from('modules')
        .delete()
        .eq('id', id);

      if (delErr) {
        // If deletion fails due to FK constraints, return informative error
        return res.status(400).json({ success: false, error: 'Failed to hard-delete module. Remove dependent data or use soft-delete.' });
      }

      emitToAll('modules.updated', { id, deleted: true });
      return res.json({ success: true, message: 'Module hard-deleted' });
    }

    // Soft delete: mark as inactive
    const { data, error } = await supabase
      .from('modules')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Clear cache and notify clients
    clearModuleCache(data.slug);
    emitToAll('modules.updated', data);

    res.json({ success: true, message: 'Module deactivated (soft-deleted)', data });
  } catch (error) {
    next(error);
  }
}
