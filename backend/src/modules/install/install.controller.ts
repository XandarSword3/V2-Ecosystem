/**
 * install.controller.ts
 *
 * Handles the one-time server installation flow.
 *
 * Design:
 *   - A "machine ID" is derived from stable OS identifiers (hostname + primary
 *     MAC address), hashed to a fixed string, and stored in system_config on
 *     first install.
 *   - GET  /api/install/status  Ã¢â€ â€™ { initialized: bool }   (public, no auth)
 *   - POST /api/install         Ã¢â€ â€™ creates roles + super_admin + seeds site state
 *                                 only succeeds when NOT yet initialized.
 *
 * After a successful POST the caller receives a full JWT pair so the browser
 * can immediately enter the authenticated onboarding wizard without a separate
 * login step.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSupabase } from '../../database/connection.js';
import { generateTokens } from '../../modules/auth/auth.utils.js';
import { setAuthCookies } from '../auth/auth.controller.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Kill switch
// ---------------------------------------------------------------------------

/**
 * Defaults to DISABLED. Must be explicitly set to the string 'true' to allow
 * the install wizard to run. This keeps the flow off by default on Vercel /
 * Render deployments where tenants are provisioned through platform-admin
 * instead.
 */
function isInstallEnabled(): boolean {
  return process.env.INSTALL_ENABLED === 'true';
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const installSchema = z.object({
  businessName:  z.string().min(2, 'Business name is required').max(100),
  adminEmail:    z.string().email('Invalid email address').max(255),
  adminPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  adminFullName: z.string().min(2, 'Full name is required').max(100),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns { initialized: boolean, storedMachineId: string | null }.
 * Never throws Ã¢â‚¬â€ treats any DB error as "not initialized" so a broken
 * install state never permanently locks the wizard.
 */
async function getInstallState(): Promise<{ initialized: boolean; storedMachineId: string | null }> {
  const supabase = getSupabase();

  // Immutable installation marker. The old machine-id check re-opened the
  // public installer whenever a container was recreated (new MAC/hostname),
  // allowing anyone to mint a fresh super_admin. The token never changes.
  const { data: tokenRow } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'install.token')
    .maybeSingle();
  if (tokenRow) {
    return { initialized: true, storedMachineId: null };
  }

  // Backward compatibility for installs completed before the token existed.
  // Presence of *any* install marker means this system was already installed.
  const { data, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'install.machine_id')
    .maybeSingle();

  if (error || !data) {
    return { initialized: false, storedMachineId: null };
  }

  const storedMachineId = (data.value as { id?: string })?.id ?? null;
  return { initialized: !!storedMachineId, storedMachineId };
}

/**
 * A super_admin existing in `users` is the authoritative "already installed"
 * signal. Checked before the public installer writes anything so an ephemeral
 * host or a lost marker can never reopen root provisioning.
 */
async function superAdminExists(): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('scope', 'super_admin')
    .limit(1)
    .maybeSingle();
  if (error) {
    // Fail closed: if we cannot prove the system is fresh, do not install.
    logger.error('Install: failed to check for existing super_admin', { error: error.message });
    return true;
  }
  return !!data;
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * GET /api/install/status
 *
 * Public endpoint the frontend polls on every boot to decide whether to show
 * the install page or redirect to login.
 *
 * The comparison is:
 *   currentMachineId === storedMachineId  Ã¢â€ â€™  already initialized, skip wizard
 *   storedMachineId is null               Ã¢â€ â€™  first boot, show install page
 *   IDs differ                            Ã¢â€ â€™  server was migrated, re-run install
 *                                            (returns initialized: false so the
 *                                             wizard re-appears and the operator
 *                                             can confirm ownership)
 */
export async function getInstallStatus(req: Request, res: Response, next: NextFunction) {
  try {
    // Kill switch: report "initialized" unconditionally so the frontend
    // wizard never renders and instead bounces straight to /login.
    if (!isInstallEnabled()) {
      return res.json({
        success: true,
        data: { initialized: true, reason: 'disabled' },
      });
    }

    const { initialized } = await getInstallState();
    const hasRoot = await superAdminExists();
    const isInitialized = initialized || hasRoot;

    return res.json({
      success: true,
      data: {
        initialized: isInitialized,
        reason: isInitialized ? 'ok' : 'first_boot',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/install
 *
 * One-shot endpoint.  Idempotency guard: if machine_id is already stored and
 * matches the current host, the request is rejected with 409.
 *
 * Steps (all or nothing via compensating deletes on failure):
 *   1. Validate payload
 *   2. Check not already initialized
 *   3. Seed roles
 *   4. Create the super_admin user
 *   5. Assign super_admin role
 *   6. Seed site_settings (onboarding_state, business name)
 *   7. Store machine_id in system_config
 *   8. Return JWT pair so the browser is immediately authenticated
 */
export async function runInstall(req: Request, res: Response, next: NextFunction) {
  const supabase = getSupabase();
  let createdUserId: string | null = null;

  try {
    // 0. Kill switch
    if (!isInstallEnabled()) {
      return res.status(403).json({
        success: false,
        error: 'The install flow is disabled on this deployment.',
      });
    }

    // 1. Validate
    const parsed = installSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { businessName, adminEmail, adminPassword, adminFullName } = parsed.data;

    // 2. Guard: already initialized? Any existing super_admin or install
    // marker hard-blocks the public installer. Machine identity is no longer
    // part of this decision: container recreation must never reopen root
    // provisioning.
    const { initialized } = await getInstallState();
    if (initialized || (await superAdminExists())) {
      return res.status(409).json({
        success: false,
        error: 'System is already initialized. Use the normal login flow.',
      });
    }

    // 3. Seed core roles (idempotent via ON CONFLICT DO NOTHING)
    // White-label roles only Ã¢â‚¬â€ no venue-specific names
    const rolesToSeed = [
      { name: 'super_admin',  display_name: 'Super Administrator', description: 'Full system access',          business_unit: null },
      { name: 'admin',        display_name: 'Administrator',       description: 'Property-level admin',        business_unit: null },
      { name: 'manager',      display_name: 'Manager',             description: 'Operational manager',         business_unit: null },
      { name: 'staff',        display_name: 'Staff',               description: 'General staff operations',    business_unit: null },
      { name: 'customer',     display_name: 'Customer',            description: 'Registered customer',         business_unit: null },
      { name: 'module_admin', display_name: 'Module Admin',        description: 'Module-level administration', business_unit: null },
      { name: 'module_staff', display_name: 'Module Staff',        description: 'Module-level operations',     business_unit: null },
    ];

    const { error: rolesError } = await supabase
      .from('roles')
      .upsert(rolesToSeed, { onConflict: 'name', ignoreDuplicates: true });

    if (rolesError) {
      logger.error('Install: role seeding failed', { error: rolesError.message });
      throw new Error(`Role seeding failed: ${rolesError.message}`);
    }

    // 4. Create the super_admin user
    const existingUser = await supabase
      .from('users')
      .select('id')
      .eq('email', adminEmail.toLowerCase())
      .maybeSingle();

    if (existingUser.data) {
      return res.status(409).json({
        success: false,
        error: 'A user with that email already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // 0.7 re-verification finding: `scope` defaults to 'customer' at the DB level
    // (see provisioning.service.ts). login() treats users.scope as the sole source
    // of truth Ã¢â‚¬â€ it derives both the JWT `roles` claim and the mandatory-2FA
    // requirement from this column alone, not from user_roles. Without this explicit
    // override, the installer's own account would authenticate as super_admin only
    // for the one-shot JWT this endpoint hands back directly; their very next real
    // login would read scope='customer', silently demote them to a customer, and
    // skip the mandatory-2FA-for-privileged-scopes check entirely.
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email:          adminEmail.toLowerCase(),
        password_hash:  passwordHash,
        full_name:      adminFullName,
        email_verified: true,
        is_active:      true,
        scope:          'super_admin',
      })
      .select('id, email, full_name')
      .single();

    if (userError || !newUser) {
      logger.error('Install: user creation failed', { error: userError?.message });
      throw new Error(`User creation failed: ${userError?.message}`);
    }

    createdUserId = newUser.id;

    // 5. FIX BUG-03 / M-9: Create a default property with valid schema (tenant_id required; slug/owner_id do not exist on properties)
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
      .maybeSingle();

    let tenantId = existingTenant?.id;
    if (!tenantId) {
      const tenantSubdomain = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
      const { data: newTenant } = await supabase
        .from('tenants')
        .insert({
          name: businessName,
          subdomain: tenantSubdomain,
          billing_status: 'active',
          subscription_tier: 'enterprise',
        })
        .select('id')
        .single();
      tenantId = newTenant?.id;
    }

    if (tenantId) {
      const { data: defaultProperty, error: propError } = await supabase
        .from('properties')
        .insert({
          name: businessName,
          is_active: true,
          tenant_id: tenantId,
        })
        .select('id')
        .single();

      if (propError) {
        logger.warn('Install: default property creation failed', { error: propError.message });
      } else {
        logger.info('Install: default property created', { propertyId: defaultProperty.id });
        if (newUser.id) {
          await supabase.from('user_property_access').insert({
            user_id: newUser.id,
            property_id: defaultProperty.id,
            tenant_id: tenantId,
            access_level: 'admin',
          });
        }
      }
    }

    // 6. Seed site_settings
    //    a) onboarding_state (wizard will consume this)
    //    b) business_name   (used across the UI)
    await supabase.from('site_settings').upsert([
      {
        key: 'onboarding_state',
        value: {
          completed:    false,
          current_step: 'welcome',
          steps:        {},
        },
        description: 'Site-wide onboarding setup progress state',
      },
      {
        key: 'business_name',
        value: { name: businessName },
        description: 'Business / brand name configured during install',
      },
    ], { onConflict: 'key' });

    // 7. Persist machine_id Ã¢â‚¬â€ this is what future status checks compare against
    // Immutable installation marker; never derived from host hardware, so a
    // rebuilt container cannot look like a fresh install.
    const installToken = crypto.randomBytes(32).toString('hex');
    const { error: configError } = await supabase
      .from('system_config')
      .upsert(
        {
          key:   'install.token',
          value: {
            token:        installToken,
            installed_at: new Date().toISOString(),
            installed_by: newUser.email,
            business:     businessName,
          },
        },
        { onConflict: 'key' }
      );

    if (configError) {
      throw new Error(`Failed to persist installation token: ${configError.message}`);
    }

    // 8. Issue JWT so the browser is immediately authenticated
    const tokens = generateTokens({
      userId:       newUser.id,
      email:        newUser.email,
      scope:        'super_admin',
      roles:        ['super_admin'],
      tokenVersion: 0,
    });

    logger.info('Install completed successfully', {
      business: businessName,
      adminEmail,

    });

    // SECURITY (C-1): the refresh token is delivered exclusively through the
    // same httpOnly; Secure cookie pair used by the login flow Ã¢â‚¬â€ never in the
    // JSON body, never readable by JS. Only the access token is returned so
    // the wizard can authenticate immediately.
    setAuthCookies(res, tokens.refreshToken);

    logger.info('Install completed successfully', {
      business: businessName,
      adminEmail,

    });

    return res.status(201).json({
      success: true,
      data: {
        message: 'Installation complete. Redirecting to setup wizard.',
        user: {
          id:       newUser.id,
          email:    newUser.email,
          fullName: newUser.full_name,
          roles:    ['super_admin'],
        },
        tokens: {
          accessToken: tokens.accessToken,
        },
      },
    });
  } catch (err: any) {
    // Compensating cleanup: remove the user row if it was created before the
    // failure so a retry doesn't hit "email already exists".
    if (createdUserId) {
      try {
        await supabase.from('users').delete().eq('id', createdUserId);
      } catch (_) { /* best-effort cleanup */ }
    }

    logger.error('Install failed', { error: err.message });
    next(err);
  }
}
