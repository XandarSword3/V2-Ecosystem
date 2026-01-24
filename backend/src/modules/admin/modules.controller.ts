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
    
    // Validate input using schema to prevent XSS and ensure data integrity
    const { template_type, name, slug, description, settings } = validateBody(createModuleSchema, req.body);

    // Generate slug if not provided
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Default settings version for new modules
    const SETTINGS_VERSION = 1; 

    const { data, error } = await supabase
      .from('modules')
      .insert({
        template_type,
        name,
        slug: finalSlug,
        description,
        settings: settings || {},
        settings_version: SETTINGS_VERSION,
        is_active: true,
        show_in_main: true 
      })
      .select()
      .single();

    if (error) throw error;

    // Dynamic Permission Generation (P0) using new app_permissions
    try {
        const permsToCreate = [
            { slug: `module:${finalSlug}:read`, description: `Read access for module ${name}`, module_slug: finalSlug },
            { slug: `module:${finalSlug}:manage`, description: `Management access for module ${name}`, module_slug: finalSlug },
            { slug: `module:${finalSlug}:publish`, description: `Publish access for module ${name}`, module_slug: finalSlug },
        ];
        
        await supabase.from('app_permissions').upsert(permsToCreate, { onConflict: 'slug' });

        // Assign to super_admin
        const rolePerms = [
            { role_name: 'super_admin', permission_slug: `module:${finalSlug}:read` },
            { role_name: 'super_admin', permission_slug: `module:${finalSlug}:manage` },
            { role_name: 'super_admin', permission_slug: `module:${finalSlug}:publish` },
        ];

        await supabase.from('app_role_permissions').upsert(rolePerms, { onConflict: 'role_name,permission_slug' });
        
    } catch (permError) {
        logger.error(`Failed to generate permissions for ${finalSlug}`, permError);
    }

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
        // 2. Create Module Permissions (granular)
        const modulePermissions = [
          { slug: `${finalSlug}:view`, description: `View ${name}`, module_slug: finalSlug },
          { slug: `${finalSlug}:manage`, description: `Manage ${name}`, module_slug: finalSlug },
          // ... add others as needed, matching the colon convention better
        ];

        await supabase.from('app_permissions').upsert(modulePermissions, { onConflict: 'slug' });

        // 3. Link Permissions to Roles using app_role_permissions
        const rolePermissions: { role_name: string; permission_slug: string }[] = [];
        
        const adminRoleName = `${finalSlug}_admin`; 
        const staffRoleName = `${finalSlug}_staff`;

        // Admin gets all
        modulePermissions.forEach(p => {
             rolePermissions.push({ role_name: adminRoleName, permission_slug: p.slug });
        });
        // Staff gets view
        modulePermissions.filter(p => p.slug.includes(':view')).forEach(p => {
             rolePermissions.push({ role_name: staffRoleName, permission_slug: p.slug });
        });

        if (rolePermissions.length > 0) {
            await supabase.from('app_role_permissions').upsert(rolePermissions, { onConflict: 'role_name,permission_slug' });
            logger.info(`[Modules] Created ${rolePermissions.length} role-permission links for ${finalSlug}`);
        }

        // 4. Create Default Staff User
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
            roles: roleNames 
          })
          .select()
          .single();

        if (!userError && userData) {
          // 5. Link User to Roles (using user_roles junction table if it exists and uses UUIDs)
          // We fetched rolesData which has IDs.
          const userRolesInserts = rolesData.map((role: { id: string; name: string }) => ({
            user_id: userData.id,
            role_id: role.id
          }));
          await supabase.from('user_roles').insert(userRolesInserts);
          logger.info(`[Modules] Created staff user ${staffEmail} with roles for ${finalSlug}`);
        }
      }
    } catch (innerError) {
      logger.error('Failed to auto-create staff/roles/permissions for module:', innerError);
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
    // Validate input (includes optional settings_version)
    const validatedData = validateBody(updateModuleSchema, req.body);

    const supabase = getSupabase();
    const { id } = req.params;

    // 1. Fetch current module to check permissions and version
    const { data: currentModule, error: fetchError } = await supabase
      .from('modules')
      .select('slug, template_type, settings_version') 
      .eq('id', id)
      .single();

    if (fetchError || !currentModule) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    // 2. Enforce Permissions (RBAC)
    // Check for `module:{slug}:manage` permission via app_role_permissions
    // Or super_admin bypass
    const user = (req as any).user;
    if (!user.roles.includes('super_admin')) {
         const requiredPerm = `module:${currentModule.slug}:manage`;
         const { data: permData, error: permError } = await supabase
            .from('app_role_permissions')
            .select('permission_slug')
            .eq('permission_slug', requiredPerm)
            .in('role_name', user.roles)
            .limit(1);

         if (permError || !permData || permData.length === 0) {
             logger.warn(`Unauthorized module update attempt by ${user.userId} on ${currentModule.slug}`);
             return res.status(403).json({ success: false, error: 'Insufficient permissions' });
         }
    }

    // 3. Optimistic Concurrency Control
    if (validatedData.settings_version !== undefined) {
         if (currentModule.settings_version !== validatedData.settings_version) {
             return res.status(409).json({ 
                 success: false, 
                 error: 'Version conflict', 
                 message: 'The module settings have been modified by another user. Please reload and try again.',
                 currentVersion: currentModule.settings_version
             });
         }
    }

    // Prepare update data
    const updateData: any = { ...validatedData };
    
    // Remove settings_version from the actual update payload as it's handled manually below if needed
    delete updateData.settings_version;

    // Increment version if settings are being updated
    if (validatedData.settings) {
        updateData.settings_version = (currentModule.settings_version || 0) + 1;
    }

    const { data, error } = await supabase
      .from('modules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Clear module cache so changes take effect immediately
    clearModuleCache(data.slug);

    emitToAll('modules.updated', data);

    await logActivity({
      user_id: user.userId,
      action: 'UPDATE_MODULE',
      resource: 'module',
      resource_id: id,
      old_value: currentModule, 
      new_value: data,
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

    // 1. Fetch module for Permission Check
    const { data: moduleData } = await supabase
      .from('modules')
      .select('id, slug, name')
      .eq('id', id)
      .single();

    if (!moduleData) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    // 2. Enforce Permissions
    const user = (req as any).user;
    const hasPermission = user.roles.includes('super_admin') || 
                         user.roles.includes(`${moduleData.slug}_admin`);

    if (!hasPermission) {
      logger.warn(`Unauthorized module delete attempt by ${user.userId} on ${moduleData.slug}`);
      return res.status(403).json({ success: false, error: 'Insufficient permissions to delete this module' });
    }

    if (force) {
      const deletedCounts: Record<string, number> = {};
      const errors: string[] = [];

      // Helper to safely delete from a table
      const safeDelete = async (table: string, column: string = 'module_id') => {
        try {
          const { count } = await supabase
            .from(table)
            .select('id', { count: 'exact', head: true })
            .eq(column, id);
          
          if (count && count > 0) {
            const { error: delError } = await supabase
              .from(table)
              .delete()
              .eq(column, id);
            
            if (delError) {
              errors.push(`${table}: ${delError.message}`);
            } else {
              deletedCounts[table] = count;
            }
          }
        } catch (e: any) {
          // Table might not exist or not have the column, skip it
        }
      };

      // Get menu item IDs for this module to delete orders referencing them
      const { data: menuItems } = await supabase
        .from('menu_items')
        .select('id')
        .eq('module_id', id);
      
      const menuItemIds = menuItems?.map(item => item.id) || [];
      
      // Delete order_items that reference menu items from this module
      if (menuItemIds.length > 0) {
        try {
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('order_id')
            .in('menu_item_id', menuItemIds);
          
          const orderIds = [...new Set(orderItems?.map(oi => oi.order_id) || [])];
          
          if (orderIds.length > 0) {
            // Delete order items first
            const { error: oiError } = await supabase
              .from('order_items')
              .delete()
              .in('menu_item_id', menuItemIds);
            
            if (oiError) {
              errors.push(`order_items: ${oiError.message}`);
            } else {
              deletedCounts['order_items'] = orderIds.length;
            }
            
            // Then delete orders that have no remaining items
            // (checking each order)
            for (const orderId of orderIds) {
              const { count } = await supabase
                .from('order_items')
                .select('id', { count: 'exact', head: true })
                .eq('order_id', orderId);
              
              if (count === 0) {
                await supabase.from('restaurant_orders').delete().eq('id', orderId);
              }
            }
          }
        } catch (e: any) {
          errors.push(`order cascade: ${e.message}`);
        }
      }

      // CASCADE DELETE: Delete all dependent data in correct order
      // Tables that have direct module_id column
      const directModuleTables = [
        'menu_items',
        'menu_categories',
        'snack_items',
        'pool_tickets',
        'pool_sessions',
        'chalets',
        'chalet_bookings',
        'reviews',
        'pages',
      ];

      for (const table of directModuleTables) {
        await safeDelete(table);
      }

      // Also clean up roles and permissions created for this module
      if (moduleData?.slug) {
        try {
          // Delete permissions for this module (Cascades to app_role_permissions)
          const { data: perms } = await supabase
            .from('app_permissions')
            .delete()
            .eq('module_slug', moduleData.slug)
            .select('slug');
          
          if (perms && perms.length > 0) {
            deletedCounts['permissions'] = perms.length;
          }
          
          // Delete roles for this module
          const { error: rolesError } = await supabase
            .from('roles')
            .delete()
            .or(`name.eq.${moduleData.slug}_admin,name.eq.${moduleData.slug}_staff`);
          
          if (!rolesError) {
             deletedCounts['roles'] = 2;
          }
          
          // Remove from navbar CMS if present
          const { data: siteSettings } = await supabase
            .from('site_settings')
            .select('id, navbar')
            .single();
          
          const settings = siteSettings as { id?: number; navbar?: { links?: any[] } } | null;
          if (settings?.navbar?.links && Array.isArray(settings.navbar.links)) {
            const updatedLinks = settings.navbar.links.filter(
              (link: any) => link.moduleSlug !== moduleData.slug
            );
            await supabase
              .from('site_settings')
              .update({ navbar: { ...settings.navbar, links: updatedLinks } })
              .eq('id', settings.id || 1);
          }

        } catch (e: any) {
            errors.push(`cleanup: ${e.message}`);
        }
      }

      // Now delete the module itself
      const { error: delErr } = await supabase
        .from('modules')
        .delete()
        .eq('id', id);

      if (delErr) {
        return res.status(400).json({ 
          success: false, 
          error: 'Failed to hard-delete module after cleaning dependencies.', 
          details: delErr.message,
          cascadeResults: deletedCounts,
          cascadeErrors: errors.length > 0 ? errors : undefined
        });
      }

      // Clear cache if we had module data
      if (moduleData?.slug) {
        clearModuleCache(moduleData.slug);
      }
      
      emitToAll('modules.updated', { id, deleted: true });

      await logActivity({
        user_id: (req.user as any)?.userId || 'system',
        action: 'DELETE_MODULE_HARD',
        resource: 'module',
        resource_id: id,
        old_value: { deletedDependencies: deletedCounts },
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });

      return res.json({ 
        success: true, 
        message: 'Module and all dependencies hard-deleted',
        deletedDependencies: deletedCounts
      });
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
