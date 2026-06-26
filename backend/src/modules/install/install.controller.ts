/**
 * install.controller.ts
 *
 * Handles the one-time server installation flow.
 *
 * Design:
 *   - A "machine ID" is derived from stable OS identifiers (hostname + primary
 *     MAC address), hashed to a fixed string, and stored in system_config on
 *     first install.
 *   - GET  /api/install/status  → { initialized: bool }   (public, no auth)
 *   - POST /api/install         → creates roles + super_admin + seeds site state
 *                                 only succeeds when NOT yet initialized.
 *
 * After a successful POST the caller receives a full JWT pair so the browser
 * can immediately enter the authenticated onboarding wizard without a separate
 * login step.
 */

import { Request, Response, NextFunction } from 'express';
import os from 'os';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getSupabase } from '../../database/connection.js';
import { generateTokens } from '../../modules/auth/auth.utils.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Machine ID
// ---------------------------------------------------------------------------

/**
 * Derives a stable machine identifier from the host's OS and primary network
 * interface.  The result is a hex string that does not change across reboots
 * unless the host is re-imaged or its primary NIC is replaced.
 *
 * Derivation:
 *   SHA-256( hostname + ":" + firstNonLoopbackMAC )
 *
 * We deliberately avoid packages like `node-machine-id` so there are no
 * additional runtime dependencies.
 */
function deriveMachineId(): string {
  const hostname = os.hostname();

  // Walk network interfaces to find the first real (non-loopback) MAC address.
  let mac = 'no-mac';
  const ifaces = os.networkInterfaces();
  outer: for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        mac = iface.mac;
        break outer;
      }
    }
  }

  return crypto
    .createHash('sha256')
    .update(`${hostname}:${mac}`)
    .digest('hex');
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
 * Never throws — treats any DB error as "not initialized" so a broken
 * install state never permanently locks the wizard.
 */
async function getInstallState(): Promise<{ initialized: boolean; storedMachineId: string | null }> {
  const supabase = getSupabase();

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
 *   currentMachineId === storedMachineId  →  already initialized, skip wizard
 *   storedMachineId is null               →  first boot, show install page
 *   IDs differ                            →  server was migrated, re-run install
 *                                            (returns initialized: false so the
 *                                             wizard re-appears and the operator
 *                                             can confirm ownership)
 */
export async function getInstallStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const currentId = deriveMachineId();
    const { initialized, storedMachineId } = await getInstallState();

    const machineMatch = initialized && storedMachineId === currentId;

    return res.json({
      success: true,
      data: {
        initialized: machineMatch,
        // Surface whether this looks like a server migration vs first boot.
        // The frontend can show a different message for each case.
        reason: !initialized
          ? 'first_boot'
          : !machineMatch
          ? 'machine_mismatch'
          : 'ok',
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

    // 2. Guard: already initialized?
    const currentId = deriveMachineId();
    const { initialized, storedMachineId } = await getInstallState();

    if (initialized && storedMachineId === currentId) {
      return res.status(409).json({
        success: false,
        error: 'System is already initialized on this machine.',
      });
    }

    // 3. Seed core roles (idempotent via ON CONFLICT DO NOTHING)
    // White-label roles only — no venue-specific names
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

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email:          adminEmail.toLowerCase(),
        password_hash:  passwordHash,
        full_name:      adminFullName,
        email_verified: true,
        is_active:      true,
      })
      .select('id, email, full_name')
      .single();

    if (userError || !newUser) {
      logger.error('Install: user creation failed', { error: userError?.message });
      throw new Error(`User creation failed: ${userError?.message}`);
    }

    createdUserId = newUser.id;

    // 5. Assign super_admin role
    const { data: superAdminRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'super_admin')
      .single();

    if (!superAdminRole) {
      throw new Error('super_admin role not found after seeding — this should never happen');
    }

    const { error: roleAssignError } = await supabase
      .from('user_roles')
      .insert({ user_id: newUser.id, role_id: superAdminRole.id });

    if (roleAssignError) {
      throw new Error(`Role assignment failed: ${roleAssignError.message}`);
    }

    // 6. FIX BUG-03: Create a default property so all property-scoped module queries work
    const { data: defaultProperty, error: propError } = await supabase
      .from('properties')
      .insert({
        name: businessName,
        slug: businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        is_active: true,
        owner_id: newUser.id,
      })
      .select('id')
      .single();

    if (propError) {
      logger.warn('Install: default property creation failed (non-fatal)', { error: propError.message });
    } else {
      logger.info('Install: default property created', { propertyId: defaultProperty.id });
    }

    // 7. Seed site_settings
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

    // 8. Persist machine_id — this is what future status checks compare against
    const { error: configError } = await supabase
      .from('system_config')
      .upsert(
        {
          key:   'install.machine_id',
          value: {
            id:           currentId,
            installed_at: new Date().toISOString(),
            installed_by: newUser.email,
            business:     businessName,
          },
        },
        { onConflict: 'key' }
      );

    if (configError) {
      throw new Error(`Failed to persist machine ID: ${configError.message}`);
    }

    // 9. Issue JWT so the browser is immediately authenticated
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
      machineId: currentId,
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
          accessToken:  tokens.accessToken,
          refreshToken: tokens.refreshToken,
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
