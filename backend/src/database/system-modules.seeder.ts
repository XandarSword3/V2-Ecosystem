import { getSupabase } from './connection.js';
import { logger } from '../utils/logger.js';
import { buildModulePermissionRows } from '../security/template-permission-presets.js';
import { permissionCache } from '../security/permission-cache.service.js';

export async function seedSystemModules() {
  const supabase = getSupabase();
  
  const systemModules = [
    {
      name: 'Home Page',
      slug: 'home-page',
      engine_type: 'shared_capacity_access',
      description: 'Editable visual layout for the site homepage',
      is_active: true,
      show_in_main: false,
      settings: {
        layout: []
      }
    },
    {
      name: 'Privacy Policy',
      slug: 'privacy-policy',
      engine_type: 'shared_capacity_access',
      description: 'Editable visual layout for the Privacy Policy page',
      is_active: true,
      show_in_main: false,
      settings: {
        layout: []
      }
    },
    {
      name: 'Terms of Service',
      slug: 'terms-of-service',
      engine_type: 'shared_capacity_access',
      description: 'Editable visual layout for the Terms of Service page',
      is_active: true,
      show_in_main: false,
      settings: {
        layout: []
      }
    }
  ];

  let changesMade = false;

  // System modules are platform-level pages (home page, legal pages). They are
  // owned by the platform-root tenant and scoped to the sentinel Default
  // Property — both columns are NOT NULL on `modules`. engine_type is the
  // canonical field (ARCHITECTURE_LAW.md); the legacy `template_type` enum
  // column is deprecated and intentionally left NULL on new rows.
  const { data: platformRoot, error: platformRootError } = await supabase
    .from('tenants')
    .select('id')
    .eq('is_platform_root', true)
    .maybeSingle();

  if (platformRootError || !platformRoot) {
    logger.error('seedSystemModules: no platform-root tenant found; skipping system module seeding', platformRootError);
    return;
  }

  const systemTenantId = platformRoot.id;
  const systemPropertyId = '00000000-0000-0000-0000-000000000001'; // sentinel Default Property

  for (const sysMod of systemModules) {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('id')
        .eq('slug', sysMod.slug)
        .eq('tenant_id', systemTenantId)
        .maybeSingle();

      if (error) {
        logger.error(`Error checking system module ${sysMod.slug}:`, error);
        continue;
      }

      if (!data) {
        // Insert new module
        const { data: insertedData, error: insertError } = await supabase
          .from('modules')
          .insert({
            ...sysMod,
            tenant_id: systemTenantId,
            property_id: systemPropertyId,
            settings_version: 1
          })
          .select()
          .single();

        if (insertError) {
          logger.error(`Failed to insert system module ${sysMod.slug}:`, insertError);
          continue;
        }

        logger.info(`Seeded system module: ${sysMod.slug}`);
        changesMade = true;

        // Auto-generate permissions for this module
        try {
          const modulePermissionSlugs = buildModulePermissionRows(sysMod.slug, sysMod.engine_type);
          const permsToCreate = modulePermissionSlugs.map((slug) => ({
            slug,
            description: `Auto-generated permission for system module ${sysMod.name}`,
            module_slug: sysMod.slug,
            tenant_id: systemTenantId,
            property_id: systemPropertyId,
          }));

          const { error: permsError } = await supabase
            .from('app_permissions')
            .upsert(permsToCreate, { onConflict: 'slug' });
          if (permsError) {
            throw permsError;
          }

          const rolePerms: Array<{ role_name: string; permission_slug: string; tenant_id: string; property_id: string }> = [];
          modulePermissionSlugs.forEach((slug) => {
            if (slug.endsWith(':view')) {
              ['customer', 'staff', 'manager', 'admin', 'super_admin'].forEach((role) => rolePerms.push({ role_name: role, permission_slug: slug, tenant_id: systemTenantId, property_id: systemPropertyId }));
            } else if (slug.endsWith(':order')) {
              rolePerms.push({ role_name: 'customer', permission_slug: slug, tenant_id: systemTenantId, property_id: systemPropertyId });
            } else if (slug.endsWith(':manage')) {
              ['staff', 'manager', 'admin', 'super_admin'].forEach((role) => rolePerms.push({ role_name: role, permission_slug: slug, tenant_id: systemTenantId, property_id: systemPropertyId }));
            } else if (slug.endsWith(':admin')) {
              ['admin', 'super_admin'].forEach((role) => rolePerms.push({ role_name: role, permission_slug: slug, tenant_id: systemTenantId, property_id: systemPropertyId }));
            }
          });

          const { error: rolePermsError } = await supabase
            .from('app_role_permissions')
            .upsert(rolePerms, { onConflict: 'role_name,permission_slug' });
          if (rolePermsError) {
            throw rolePermsError;
          }
          logger.info(`Generated roles & permissions for system module: ${sysMod.slug}`);
        } catch (permError) {
          logger.error(`Failed to generate permissions for ${sysMod.slug}`, permError);
        }
      }
    } catch (err) {
      logger.error(`Unexpected error seeding system module ${sysMod.slug}:`, err);
    }
  }

  if (changesMade) {
    try {
      await permissionCache.refreshCache();
    } catch (cacheErr) {
      logger.error('Failed to refresh permission cache after seeding:', cacheErr);
    }
  }
}
