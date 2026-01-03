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

    // Soft delete or hard delete? Let's do soft delete by setting is_active to false for now
    // or actually delete if no data is associated.
    // For simplicity, let's just delete from the modules table. 
    // Foreign key constraints might prevent this if there are items.
    
    const { error } = await supabase
      .from('modules')
      .delete()
      .eq('id', id);

    if (error) throw error;

    emitToAll('modules.updated', { id, deleted: true });

    res.json({ success: true, message: 'Module deleted successfully' });
  } catch (error) {
    next(error);
  }
}
