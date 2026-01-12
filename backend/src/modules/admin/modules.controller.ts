import { Request, Response, NextFunction } from 'express';
import { getSupabase } from "../../database/connection";
import { emitToAll } from "../../socket";
import bcrypt from 'bcryptjs';
import { clearModuleCache } from "../../middleware/moduleGuard.middleware";
import { createModuleSchema, updateModuleSchema, validateBody } from "../../validation/schemas";
import { logActivity } from "../../utils/activityLogger";
import { logger } from "../../utils/logger.js";

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

    // Optionally filter by show_in_main if requested
    if (req.query.showInMain === 'true') {
      query = query.eq('show_in_main', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: 'Failed to fetch modules' });
  }
}

export async function getModule(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    // Try to fetch by id first
    const { data: initialData, error: initialError } = await supabase
      .from('modules')
      .select('*')
      .eq('id', id)
      .single();

    let data = initialData;
    const error = initialError;

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
        is_active: true,
        show_in_main: true // New modules should show in main navbar by default
      })
      .select()
      .single();

    if (error) throw error;

    // --- Auto-add to navbar CMS if configured ---
    try {
      const { data: siteSettings } = await supabase
        .from('site_settings')
        .select('id, navbar')
        .single();

      const settings = siteSettings as { id?: number; navbar?: { links?: unknown[] } } | null;
      if (settings?.navbar?.links && Array.isArray(settings.navbar.links)) {
        // Navbar is CMS-configured, auto-add the new module
        const newNavLink = {
          type: 'module',
          moduleSlug: finalSlug,
          label: name,
          icon: template_type === 'menu_service' ? 'UtensilsCrossed' : 
                template_type === 'session_access' ? 'Waves' : 'Home'
        };
        
        const updatedLinks = [...settings.navbar.links, newNavLink];
        await supabase
          .from('site_settings')
          .update({ 
            navbar: { 
              ...settings.navbar, 
              links: updatedLinks 
            } 
          })
          .eq('id', settings.id || 1);

        logger.info(`[Modules] Auto-added ${finalSlug} to navbar CMS links`);
      }
    } catch (navError) {
      logger.error('Failed to auto-add module to navbar:', navError);
      // Non-fatal - module still created
    }

    // --- Auto-create Roles & Staff User ---
    try {
      // 1. Create Roles
      const roleNames = [`${finalSlug}_admin`, `${finalSlug}_staff`];
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .insert(roleNames.map(r => ({ name: r, description: `Role for ${name}` })))
        .select();

      if (!rolesError && rolesData) {
        // 2. Create Default Staff User
        const staffEmail = `staff.${finalSlug}@v2resort.com`;
        const staffPassword = await bcrypt.hash(`Staff${finalSlug.charAt(0).toUpperCase() + finalSlug.slice(1)}123!`, 10);

        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert({
            email: staffEmail,
            password: staffPassword,
            full_name: `${name} Staff`,
            phone: '',
            is_active: true,
            email_verified: true,
            roles: roleNames // Store simply for reference or if using array column
          })
          .select()
          .single();

        if (!userError && userData) {
          // 3. Link User to Roles (using user_roles junction table)
          const userRolesInserts = rolesData.map((role: { id: string; name: string }) => ({
            user_id: userData.id,
            role_id: role.id
          }));
          await supabase.from('user_roles').insert(userRolesInserts);
        }
      }
    } catch (innerError) {
      logger.error('Failed to auto-create staff/roles for module:', innerError);
      // We don't fail the module creation itself, just log
    }

    emitToAll('modules.updated', data);

    await logActivity({
      user_id: (req.user as any)?.userId || 'system',
      action: 'CREATE_MODULE',
      resource: 'module',
      resource_id: data.id,
      new_value: data,
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

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

    await logActivity({
      user_id: (req.user as any)?.userId || 'system',
      action: 'UPDATE_MODULE',
      resource: 'module',
      resource_id: data.id,
      new_value: validatedData,
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

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
        // If deletion fails due to FK constraints, try to list dependent rows to help the user
        const candidateTables = [
          'menu_categories', 'menu_items', 'snack_items', 'chalets', 'pool_sessions', 'pool_tickets', 'restaurant_orders', 'reviews', 'pages', 'modules', 'users'
        ];
        const deps: Record<string, number> = {};
        for (const table of candidateTables) {
          try {
            const { count } = await supabase
              .from(table)
              .select('id', { count: 'exact', head: true })
              .eq('module_id', id);
            deps[table] = typeof count === 'number' ? count : 0;
          } catch (e) {
            // ignore tables that don't exist or cannot be queried
            deps[table] = -1;
          }
        }
        return res.status(400).json({ success: false, error: 'Failed to hard-delete module. Remove dependent data or use soft-delete.', dependencies: deps });
      }

      emitToAll('modules.updated', { id, deleted: true });

      await logActivity({
        user_id: (req.user as any)?.userId || 'system',
        action: 'DELETE_MODULE_HARD',
        resource: 'module',
        resource_id: id,
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

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

    await logActivity({
      user_id: (req.user as any)?.userId || 'system',
      action: 'DELETE_MODULE_SOFT',
      resource: 'module',
      resource_id: id,
      new_value: { is_active: false },
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Module deactivated (soft-deleted)', data });
  } catch (error) {
    next(error);
  }
}
