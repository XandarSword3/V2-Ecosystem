import { Request, Response, NextFunction, Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from "../../database/connection";
import { emitToAll } from "../../socket";
import bcrypt from 'bcryptjs';
import { clearModuleCache } from "../../middleware/moduleGuard.middleware";
import { createModuleSchema, updateModuleSchema, validateBody } from "../../validation/schemas";
import { logActivity } from "../../utils/activityLogger";
import { logger } from "../../utils/logger.js";
import { loadDynamicModules } from "../../routes/dynamic-modules.loader.js";
import { buildModulePermissionRows } from "../../security/template-permission-presets.js";
import { permissionCache } from "../../security/permission-cache.service.js";
import { assertModuleLimit } from "../../services/feature-limits.service.js";
import { ENGINE_TO_LEGACY_TEMPLATE_TYPE } from "../../engines/types.js";
import { getCallerTenantId, requireTenantScope } from "../../security/tenant-scope.js";
import { getScopedClient, tenantContextFor } from "../../security/scoped-client.js";

export async function getModules(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();
    const { activeOnly } = req.query;
    // Property context: prefer req.property (resolved request-side by
    // resolveProperty, mounted ahead of this handler on the public
    // /api/modules route — see CONTEXT.md "Public/Admin Property Context
    // Contamination", session 7-9). Fall back to req.propertyId, set by
    // validatePropertyAccess for authenticated admin callers that hit this
    // same handler via a different mount.
    const propertyId = req.property?.id ?? ((req as any).propertyId as string | undefined);

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

    // Scope to property if context is available, fall back to global (null) modules
    if (propertyId) {
      query = query.or(`property_id.eq.${propertyId},property_id.is.null`);
    }

    // Scope to tenant — only show this tenant's modules plus any unscoped (null) global modules.
    // This handler is mounted on two routes: the authenticated /admin/modules
    // (req.user present) and the unauthenticated public /api/modules (app.ts,
    // mounted with only resolveTenant/resolveProperty, no auth middleware).
    // getCallerTenantId() assumes an authenticated caller and throws a 403 when
    // req.user is absent — which is every single call on the public route, and
    // was surfacing here as a masked 500. Fall back to req.tenant?.id (resolved
    // by resolveTenant from the subdomain/header) for unauthenticated callers.
    const tenantId = req.user ? getCallerTenantId(req) : (req.tenant?.id ?? null);
    if (tenantId) {
      query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error: unknown) {
    logger.error('[Modules] getModules failed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch modules' });
  }
}

export const getModule = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const identifier = req.params.id || req.params.slug || (req.params as any)[0];

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Module identifier is required' });
    }

    const propertyId = req.property?.id ?? ((req as any).propertyId as string | undefined);
    const tenantId = req.user ? getCallerTenantId(req) : (req.tenant?.id ?? null);

    logger.info(`[ModulesController] getModule identifier="${identifier}" propertyId="${propertyId ?? 'none'}" tenantId="${tenantId ?? 'none'}"`);

    const applyScope = (q: any) => {
      let scoped = q;
      if (propertyId) scoped = scoped.or(`property_id.eq.${propertyId},property_id.is.null`);
      if (tenantId) scoped = scoped.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
      return scoped;
    };

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    let data: any = null;

    if (isUuid) {
      const { data: byId, error: idError } = await applyScope(
        supabase.from('modules').select('*').eq('id', identifier)
      ).maybeSingle();
      if (idError) throw idError;
      data = byId;
    }

    if (!data && identifier) {
      const { data: bySlug, error: slugErr } = await applyScope(
        supabase.from('modules').select('*').eq('slug', identifier)
      ).maybeSingle();

      if (slugErr) throw slugErr;
      data = bySlug;
    }

    if (!data) {
      logger.warn(`[ModulesController] Module not found for identifier="${identifier}" propertyId="${propertyId ?? 'none'}" tenantId="${tenantId ?? 'none'}"`);
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    logger.info(`[ModulesController] Found module "${data.name}" (${data.id}, slug="${data.slug}")`);
    res.json({ success: true, data });
});


export const createModule = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();

    // Enforce tenant module limit before any DB work
    await assertModuleLimit(req);

    // Validate input using schema to prevent XSS and ensure data integrity.
    // NOTE: createModuleSchema's engine_type enum deliberately excludes
    // 'platform_entitlement' — Engine E is SaaS billing between operators and
    // V2 itself, never a module type any tenant (including platform-root) can
    // create through this endpoint. There is therefore no platform-root guard
    // here: the type system already makes that branch unreachable.
    const { engine_type, name, slug, description, settings } = validateBody(createModuleSchema, req.body);

    // Generate slug if not provided
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Q159 — Reserved slug protection: prevent modules from shadowing system routes
    const RESERVED_SLUGS = [
      'admin', 'auth', 'api', 'health', 'install', 'modules', 'webhooks', 'docs',
      'csrf-token', 'search', 'units', 'i18n', 'translations', 'terminology',
      'integrations', 'onboarding', 'platform', 'saas', 'gdpr', 'payments',
      'reports', 'support', 'analytics', 'loyalty', 'giftcards', 'users',
    ];
    if (RESERVED_SLUGS.includes(finalSlug)) {
      return res.status(422).json({
        success: false,
        error: 'Reserved slug',
        message: `The slug "${finalSlug}" is reserved for system use. Please choose a different name.`,
        slug: finalSlug,
      });
    }

    // Q171 — Scope slug uniqueness check to tenant so two tenants can share the same slug
    // JWT-derived only (req.user.tenantId via getCallerTenantId) — never the x-tenant-id
    // header, which is attacker-controlled. See remediation plan Phase 0, item 0.1.
    const tenantIdForSlugCheck = getCallerTenantId(req);

    // Pre-check: if a module with this slug already exists within this tenant (active or inactive),
    // surface a clear 409 rather than a cryptic 500 from the DB unique constraint.
    let slugCheckQuery = supabase
      .from('modules')
      .select('id, is_active')
      .eq('slug', finalSlug);

    if (tenantIdForSlugCheck) {
      slugCheckQuery = slugCheckQuery.eq('tenant_id', tenantIdForSlugCheck);
    }

    const { data: existing } = await slugCheckQuery.maybeSingle();

    if (existing) {
      const hint = existing.is_active
        ? `A module with the slug "${finalSlug}" already exists and is active.`
        : `A module with the slug "${finalSlug}" exists but is inactive. Delete it first or choose a different name.`;
      return res.status(409).json({
        success: false,
        error: 'Slug conflict',
        message: hint,
        slug: finalSlug,
      });
    }

    // Default settings version for new modules
    const SETTINGS_VERSION = 1; 

    const legacyTemplateType = ENGINE_TO_LEGACY_TEMPLATE_TYPE[engine_type as keyof typeof ENGINE_TO_LEGACY_TEMPLATE_TYPE] ?? null;

    // Property context: same dual-source resolution as getModules() above —
    // prefer req.property (resolveProperty), fall back to req.propertyId
    // (validatePropertyAccess). modules.property_id is NOT NULL, so unlike
    // the GET's "fall back to global" behavior, a create with no resolvable
    // property must fail loudly here rather than send null into the insert
    // and surface as a raw 23502 constraint violation.
    const propertyId = req.property?.id ?? ((req as any).propertyId as string | undefined);
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: 'Property context required',
        message: 'Could not resolve an active property for this request. Select a property and try again.',
      });
    }

    const { data, error } = await getScopedClient({ tenantId: requireTenantScope(req), actorId: req.user?.userId })
      .from('modules')
      .insert({
        engine_type,
        template_type: legacyTemplateType,
        name,
        slug: finalSlug,
        description,
        settings: settings || {},
        settings_version: SETTINGS_VERSION,
        is_active: true,
        show_in_main: true,
        property_id: propertyId,
        // tenant_id intentionally omitted — getScopedClient stamps it.
        // requireTenantScope (not tenantContextFor) ensures super_admin callers
        // get a 403 rather than a null tenant_id → 23502 constraint violation.
        // (Phase 2, item 2.2 pilot. See backend/src/security/scoped-client.ts.)
      })
      .select()
      .single();

    if (error) {
      // Postgres unique_violation — belt-and-suspenders in case the pre-check
      // race-conditions with a concurrent create
      if ((error as any).code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'Slug conflict',
          message: `A module with the slug "${finalSlug}" already exists. Choose a different name.`,
          slug: finalSlug,
        });
      }
      throw error;
    }

    // Dynamic Permission Generation using template presets.
    try {
        const modulePermissionSlugs = buildModulePermissionRows(finalSlug, engine_type);
        const permsToCreate = modulePermissionSlugs.map((slug) => ({
          slug,
          description: `Auto-generated permission for module ${name}`,
          module_slug: finalSlug,
        }));

        await supabase.from('app_permissions').upsert(permsToCreate, { onConflict: 'slug' });

        // Assign based on template preset policy.
        const rolePerms: Array<{ role_name: string; permission_slug: string }> = [];
        modulePermissionSlugs.forEach((slug) => {
          if (slug.endsWith(':view')) {
            ['customer', 'staff', 'manager', 'admin', 'super_admin'].forEach((role) => rolePerms.push({ role_name: role, permission_slug: slug }));
          } else if (slug.endsWith(':order')) {
            rolePerms.push({ role_name: 'customer', permission_slug: slug });
          } else if (slug.endsWith(':manage')) {
            ['staff', 'manager', 'admin', 'super_admin'].forEach((role) => rolePerms.push({ role_name: role, permission_slug: slug }));
          } else if (slug.endsWith(':admin')) {
            ['admin', 'super_admin'].forEach((role) => rolePerms.push({ role_name: role, permission_slug: slug }));
          }
        });

        await supabase.from('app_role_permissions').upsert(rolePerms, { onConflict: 'role_name,permission_slug' });
        await permissionCache.refreshCache();
        
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
          // Icon mapped to real engine types (no legacy aliases)
          icon: engine_type === 'instant_transaction'        ? 'UtensilsCrossed' :
                engine_type === 'shared_capacity_access'     ? 'Waves'            :
                engine_type === 'time_exclusive_reservation' ? 'Home'             :
                engine_type === 'ongoing_entitlement'        ? 'Layers'           : 'Home',
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

    // --- Auto-create default staff user (idempotent via email) ---
    // users.scope is the source of truth for authorization — no roles/
    // user_roles rows are seeded here. The staff record (staff_profiles)
    // carries the module as the member's department/sub-role.
    try {
      const staffEmail = `staff.${finalSlug}@v2ecosystem.com`;
      const staffPassword = await bcrypt.hash(`Staff${finalSlug.charAt(0).toUpperCase() + finalSlug.slice(1)}123!`, 12);
      const tenantId = requireTenantScope(req);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert(
          {
            email: staffEmail,
            password_hash: staffPassword,
            full_name: `${name} Staff`,
            phone: '',
            is_active: true,
            email_verified: true,
            scope: 'property_staff',
            tenant_id: tenantId,
          },
          { onConflict: 'email', ignoreDuplicates: false }
        )
        .select()
        .single();

      if (!userError && userData) {
        const { error: staffProfileError } = await supabase.from('staff_profiles').upsert(
          {
            user_id: userData.id,
            tenant_id: tenantId,
            department: finalSlug,
          },
          { onConflict: 'user_id' }
        );
        if (staffProfileError) {
          logger.warn(`[Modules] Staff profile upsert failed for ${staffEmail}`, staffProfileError.message);
        } else {
          logger.info(`[Modules] Created/updated staff user ${staffEmail} (property_staff) with staff record for ${finalSlug}`);
        }
      }
    } catch (innerError) {
      logger.error('Failed to auto-create staff user for module:', innerError);
      // Non-fatal — module row is already committed above, log and continue
    }

    emitToAll('modules.updated', data);

    // Make the new module routes available immediately (no server restart).
    try {
      await loadDynamicModules();
    } catch (loadErr) {
      logger.error('Module created but dynamic route reload failed:', loadErr);
    }

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
});

export const updateModule = asyncHandler(async (req: Request, res: Response) => {
    // Validate input (includes optional settings_version)
    const validatedData = validateBody(updateModuleSchema, req.body);

    const supabase = getSupabase();
    const { id } = req.params;
    const user = req.user;
    if (!user) throw new Error('Authentication required');
    const isSuperAdmin = user.roles.includes('super_admin');
    // JWT-derived only — see remediation plan Phase 0, item 0.1. Previously fell
    // back to the x-tenant-id header, which an authenticated admin/manager of
    // Tenant A could set to Tenant B's id to pass the ownership check below.
    const callerTenantId = getCallerTenantId(req);

    // 1. Fetch current module to check permissions, tenant ownership, and version
    const { data: currentModule, error: fetchError } = await supabase
      .from('modules')
      .select('slug, engine_type, settings_version, tenant_id')
      .eq('id', id)
      .single();

    if (fetchError || !currentModule) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    // 1b. Tenant isolation: a module belonging to another tenant must be invisible to
    // this caller, not just unwritable. 404 rather than 403 avoids confirming it exists.
    if (!isSuperAdmin && currentModule.tenant_id !== callerTenantId) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    // 2. Enforce Permissions (RBAC)
    // Check for `module:{slug}:manage` permission via app_role_permissions
    // Or super_admin bypass
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

    // Ownership already confirmed above (currentModule.tenant_id vs callerTenantId,
    // or isSuperAdmin) — getScopedClient re-applies the same tenant filter here
    // so the actual UPDATE can't touch a row outside that scope either.
    // (Phase 2, item 2.2 pilot.)
    const { data, error } = await getScopedClient(tenantContextFor(req))
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
});

export const deleteModule = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const { id } = req.params;
    const force = req.query.force === 'true';

    // 1. Fetch module for Permission Check
    const { data: moduleData } = await supabase
      .from('modules')
      .select('id, slug, name, tenant_id')
      .eq('id', id)
      .single();

    if (!moduleData) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    // 1b. Tenant isolation: a module belonging to another tenant must be invisible to
    // this caller, not just undeletable. 404 rather than 403 avoids confirming it exists.
    const user = req.user;
    if (!user) throw new Error('Authentication required');
    const isSuperAdmin = user.roles.includes('super_admin');
    // JWT-derived only — see remediation plan Phase 0, item 0.1.
    const callerTenantId = getCallerTenantId(req);
    if (!isSuperAdmin && moduleData.tenant_id !== callerTenantId) {
      return res.status(404).json({ success: false, error: 'Module not found' });
    }

    // 2. Enforce Permissions
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

      // Q166 — Financial integrity: transactions MUST NOT be hard-deleted.
      // Transaction records are the immutable financial ledger. They are retained
      // even on force-delete; historical revenue data must survive module removal.
      // The module_id FK becomes an orphaned reference (acceptable — the module row
      // is gone but its slug/name was captured in the transaction at creation time).
      logger.info(`[Modules] Skipping transaction deletion on force-delete of ${moduleData?.slug} — financial records are retained per Q166.`);

      // CASCADE DELETE: Delete all dependent data in correct order
      // Tables that have direct module_id column
      // NOTE: use canonical post-Engine-Refit names — never legacy aliases
      const directModuleTables = [
        'catalog_items',
        'catalog_categories',
        'capacity_windows',
        'accommodation_units',
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
      const { error: delErr } = await (moduleData.tenant_id
        ? supabase.from('modules').delete().eq('id', id).eq('tenant_id', moduleData.tenant_id)
        : supabase.from('modules').delete().eq('id', id).is('tenant_id', null)
      );

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
    const { data, error } = await (moduleData.tenant_id
      ? supabase.from('modules').update({ is_active: false }).eq('id', id).eq('tenant_id', moduleData.tenant_id)
      : supabase.from('modules').update({ is_active: false }).eq('id', id).is('tenant_id', null)
    ).select().single();

    if (error) throw error;

    // Clear cache and notify clients
    clearModuleCache(data.slug);
    emitToAll('modules.updated', data);

    // Q154 — Remove deactivated module from navbar CMS so it doesn't linger
    // in navigation after soft-deletion (force-delete path already does this).
    try {
      const { data: siteSettings } = await supabase
        .from('site_settings')
        .select('id, navbar')
        .single();
      const ns = siteSettings as { id?: number; navbar?: { links?: any[] } } | null;
      if (ns?.navbar?.links && Array.isArray(ns.navbar.links)) {
        const updatedLinks = ns.navbar.links.filter((link: any) => link.moduleSlug !== data.slug);
        await supabase
          .from('site_settings')
          .update({ navbar: { ...ns.navbar, links: updatedLinks } })
          .eq('id', ns.id || 1);
        logger.info(`[Modules] Removed ${data.slug} from navbar on soft-delete.`);
      }
    } catch (navErr) {
      logger.error('Failed to remove deactivated module from navbar:', navErr);
      // Non-fatal
    }

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
});
