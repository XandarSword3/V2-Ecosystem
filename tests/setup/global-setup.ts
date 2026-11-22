/**
 * e2e/setup/global-setup.ts
 *
 * Runs once before ALL tests. Verifies servers are up, then seeds test tenants.
 * If anything here throws, Playwright aborts the entire run immediately.
 *
 * Backend port: 3005
 * Frontend port: 3000
 */

import { FullConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  loadE2EAdminTwoFactor,
  saveE2EAdminTwoFactor,
  computeTotp,
} from './two-factor';

// Same env loading as tests/fixtures/base.ts — global-setup runs before any
// spec, so it must resolve .env.test / backend/.env itself.
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

// bcryptjs lives in backend/node_modules (the test root doesn't hoist it).
// Needed to reset password hashes for pre-existing test users whose
// credentials drifted from earlier sessions.
const bcrypt = require(path.resolve(__dirname, '../../backend/node_modules/bcryptjs'));

const BACKEND_URL = 'http://localhost:3005';

export default async function globalSetup(_config: FullConfig) {
  console.log('\n🔧 V2 E2E — Global Setup\n');

  await verifyServers();
  await seedTestEnvironment();
  await warmFrontendRoutes();

  console.log('\n✅ Global Setup complete — running tests\n');
}

// ---------------------------------------------------------------------------
// Dev-compile warm-up
// ---------------------------------------------------------------------------

/**
 * Pre-compiles the routes the suites hit first. In `next dev` the very first
 * request to a route triggers an on-demand compile; during that window chunk
 * requests abort and the page re-navigates, which used to make the first test
 * on each route flaky (form fills firing before hydration, query params lost
 * on the re-navigation). Hitting the routes once here shifts the compile cost
 * into setup where a slow response is harmless.
 */
async function warmFrontendRoutes() {
  const routes = ['/login', '/'];
  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:3000${route}`, { signal: AbortSignal.timeout(60_000) });
      console.log(`  ✓ Warmed ${route} (HTTP ${res.status})`);
    } catch (err) {
      // Non-fatal: compilation will just happen lazily during tests.
      console.warn(`  ⚠ Warm-up for ${route} failed: ${(err as Error).message}`);
    }
  }

  // Tenant-tier routes resolve only on walid.localhost (Chromium/curl can;
  // Node fetch cannot). Warm them via curl.exe --resolve so the heavy
  // on-demand compiles land here, not in the first test of each suite.
  const tenantRoutes = [
    '/walid-s-property/admin',
    '/walid-s-property/admin/poolside-grill/menu',
    '/walid-s-property/staff',
    '/walid-s-property/staff/modules/poolside-grill',
  ];
  for (const route of tenantRoutes) {
    try {
      const { execFileSync } = require('child_process');
      execFileSync(
        'curl.exe',
        ['-s', '-o', 'NUL', '--max-time', '120', '--resolve', 'walid.localhost:3000:127.0.0.1', `http://walid.localhost:3000${route}`],
        { timeout: 130_000, windowsHide: true },
      );
      console.log(`  ✓ Warmed (tenant-tier) ${route}`);
    } catch (err) {
      // Non-fatal: compilation will just happen lazily during tests.
      console.warn(`  ⚠ Tenant-tier warm-up for ${route} failed: ${(err as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Server health checks
// ---------------------------------------------------------------------------

async function verifyServers() {
  const checks = [
    { name: 'Backend',  url: `${BACKEND_URL}/api/health` },
    // Use bare localhost:3000 — we only need to confirm the process is alive.
    // Node.js on Windows doesn't reliably resolve *.localhost via DNS the way
    // a browser does. Subdomain routing is tested by the Layer 0 browser specs.
    // Bare localhost returns 404 from the middleware (by design), and our check
    // below treats 404 as "server is up" — which is correct.
    { name: 'Frontend', url: 'http://localhost:3000' },
  ];

  for (const check of checks) {
    let ok = false;
    try {
      const res = await fetch(check.url, { signal: AbortSignal.timeout(5000) });
      ok = res.ok || res.status === 404; // 404 is fine — means the server IS up
    } catch {
      ok = false;
    }

    if (!ok) {
      throw new Error(
        `[Global Setup] ${check.name} not reachable at ${check.url}.\n` +
        `Start both servers before running E2E tests:\n` +
        `  Backend:  cd v2-resort/backend  && npm run dev\n` +
        `  Frontend: cd v2-resort/frontend && npm run dev`
      );
    }
    console.log(`  ✓ ${check.name} is up (${check.url})`);
  }
}

// ---------------------------------------------------------------------------
// Test data seeding
// ---------------------------------------------------------------------------

async function seedTestEnvironment() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!, // Service key — bypasses RLS for seeding
  );

  // 1. Confirm platform-root tenant exists
  const { data: platformTenant, error: ptErr } = await supabase
    .from('tenants')
    .select('id, subdomain, is_platform_root')
    .eq('subdomain', 'platform')
    .maybeSingle();

  if (ptErr) throw new Error(`[Seed] platform tenant lookup failed: ${ptErr.message}`);
  if (!platformTenant?.is_platform_root) {
    throw new Error(
      '[Seed] Platform-root tenant not found or is_platform_root = false.\n' +
      'Run: supabase db push (from v2-resort/) and confirm the seed migration applied.'
    );
  }
  console.log(`  ✓ Platform-root tenant confirmed (id: ${platformTenant.id})`);

  // 2. Confirm plans exist (seeded via admin UI or migration)
  const { data: plans, error: plErr } = await supabase
    .from('plans')
    .select('code, is_active')
    .eq('is_active', true);

  if (plErr) throw new Error(`[Seed] plans lookup failed: ${plErr.message}`);
  if (!plans || plans.length === 0) {
    throw new Error(
      '[Seed] No active plans found. Seed at least one plan via the admin UI ' +
      '(platform.v2platform.local:3000/admin/[engine-e-slug]/plans) before running E2E tests.'
    );
  }
  console.log(`  ✓ ${plans.length} active plan(s) found`);

  const firstPlanCode = plans[0].code;

  // 3. Seed testcorp tenant (primary test tenant)
  const testcorpId = await ensureTestTenant(supabase, 'testcorp', firstPlanCode, 'trialing');

  // 4. Seed suspended tenant (for billing gate tests)
  await ensureTestTenant(supabase, 'suspended', firstPlanCode, 'suspended');

  // 4b. Seed othercorp tenant — a second, independent tenant with its own
  // admin. Needed for cross-tenant isolation tests (remediation plan Phase 0):
  // authenticate as one tenant's admin, attempt to act on the other tenant's
  // resources, assert 403/404. A single tenant can't prove isolation.
  const othercorpId = await ensureTestTenant(supabase, 'othercorp', firstPlanCode, 'trialing');

  // 5. Seed testcorp + othercorp super_admin users with a known test password
  //    Password is hardcoded here — this is a test-only account on a test-only DB.
  //    Never use this pattern for real credentials.
  await ensureTestAdminUser(supabase, testcorpId, 'testcorp');
  await ensureTestAdminUser(supabase, othercorpId, 'othercorp');

  // 6. Seed one property per test tenant so post-login admin redirects have a
  //    target: the login page redirects admins to /{propertySlug}/admin, where
  //    propertySlug comes from the backend property resolver (property_code).
  await ensureTestProperty(supabase, testcorpId, 'testcorp');
  await ensureTestProperty(supabase, othercorpId, 'othercorp');
  await ensureTestProperty(supabase, (await getTenantId(supabase, 'suspended'))!, 'suspended');

  // 7. Re-sync the by-name v2ecosystem E2E users. These are pre-existing rows
  //    used by the Engine A suites; their password hashes drift from earlier
  //    dev sessions, and every drifted login also poisons the backend's
  //    lockout cache (CAPTCHA_REQUIRED / ACCOUNT_LOCKED for the whole session).
  await ensureV2EcosystemPasswords(supabase);
  await ensureEngineAFixtureAccess(supabase);
  await ensureEngineAE2EAdmin(supabase, BACKEND_URL);
  await ensureEngineAShiftHygiene(supabase);

  console.log('  ✓ Test tenants ready');
}

/**
 * Force-resets password hashes for the Engine A fixture users so their
 * credentials always match what the specs send. Values mirror the spec
 * defaults (grep for EV2E_STAFF_/E2E_ADMIN_ in tests/e2e/engine-a-*).
 */
async function ensureV2EcosystemPasswords(supabase: ReturnType<typeof createClient>) {
  const targets: Array<{ email: string; password: string }> = [
    { email: 'e2e.staff@v2ecosystem.com', password: 'staff123' },
    { email: 'e2e.admin@v2ecosystem.com', password: 'admin123' },
    { email: 'test.admin@v2ecosystem.com', password: 'admin123' },
    { email: 'admin@v2ecosystem.com', password: 'admin123' },
    { email: 'menu.service.staff@v2ecosystem.com', password: 'staff123' },
    { email: 'e2e.customer@test.com', password: 'TestPass123!' },
  ];

  for (const { email, password } of targets) {
    const { data: users, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email);
    if (error) {
      console.warn(`  ⚠ User lookup failed for '${email}': ${error.message}`);
      continue;
    }
    if (!users || users.length === 0) {
      console.warn(`  ⚠ Engine A user '${email}' not found in DB — spec will need to register it`);
      continue;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const { error: updateErr } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, email_verified: true, two_factor_enabled: false })
      .eq('email', email);
    console.log(updateErr ? `  ⚠ Password resync for '${email}' failed: ${updateErr.message}` : `  ✓ '${email}' password re-synced`);
  }
}

/**
 * Engine A fixture: the customer user buys from the mounted `walid` module
 * (poolside-grill). The dynamic module router runs requirePropertyAccess for
 * every authenticated route outside NODE_ENV=test, and customer accounts are
 * default-deny without a user_property_access row. Grant the fixture customer
 * read access to the walid property (idempotent).
 */
async function ensureEngineAFixtureAccess(supabase: ReturnType<typeof createClient>) {
  const { data: walidTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('subdomain', 'walid')
    .maybeSingle();
  if (!walidTenant) {
    console.warn('  ⚠ Engine A fixture tenant (walid) not found — skipping customer property access grant');
    return;
  }

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('tenant_id', walidTenant.id)
    .limit(1)
    .maybeSingle();
  if (!property) {
    console.warn('  ⚠ No property found for walid tenant — skipping customer property access grant');
    return;
  }

  const { data: customer } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'e2e.customer@test.com')
    .maybeSingle();
  if (!customer) {
    console.warn('  ⚠ e2e.customer@test.com not found — skipping property access grant');
    return;
  }

  const { data: existing } = await supabase
    .from('user_property_access')
    .select('id')
    .eq('user_id', customer.id)
    .eq('property_id', property.id)
    .limit(1);
  if (existing && existing.length > 0) return;

  const { error } = await supabase.from('user_property_access').insert({
    user_id: customer.id,
    property_id: property.id,
    access_level: 'read',
    granted_by: customer.id,
    tenant_id: walidTenant.id,
  });
  console.log(error ? `  ⚠ Property access grant for e2e.customer@test.com failed: ${error.message}` : `  ✓ e2e.customer@test.com granted access to walid fixture property`);
}

/**
 * Engine A fixture: `e2e.admin@v2ecosystem.com` is the walid-tenant E2E admin.
 * /auth/me derives roles[] from user.scope (permissions.ts scopeToRoles), so
 * role promotion is cosmetic — the user's scope (tenant_admin) already maps to
 * ['admin'], which the admin layout accepts. The REAL gate is the backend's
 * mandatory-2FA rule: every privileged scope needs two_factor_enabled=true or
 * login 403s (TWO_FACTOR_SETUP_REQUIRED). Enroll the fixture user via the real
 * flow and persist the TOTP secret so test login helpers can answer the
 * /auth/2fa/verify challenge (see tests/setup/two-factor.ts).
 */
async function ensureEngineAE2EAdmin(supabase: ReturnType<typeof createClient>, backendUrl: string) {
  const { data: users } = await supabase
    .from('users')
    .select('id, roles, two_factor_enabled')
    .eq('email', 'e2e.admin@v2ecosystem.com');
  if (!users || users.length === 0) {
    console.warn('  ⚠ e2e.admin@v2ecosystem.com not found — skipping admin fixture setup');
    return;
  }

  for (const u of users) {
    // Role promotion is cosmetic (scope is the source of truth for /auth/me)
    // but keeps the DB rows sane for anything that still reads roles.
    const roles: string[] = Array.isArray(u.roles) ? u.roles : [];
    if (!roles.includes('admin')) {
      const promoted = [...new Set([...roles, 'admin'])];
      const { error } = await supabase.from('users').update({ roles: promoted }).eq('id', u.id);
      console.log(
        error
          ? `  ⚠ Admin role promotion for e2e.admin@v2ecosystem.com failed: ${error.message}`
          : `  ✓ e2e.admin@v2ecosystem.com promoted to roles=${JSON.stringify(promoted)}`,
      );
    }

    // ---- Mandatory-2FA enrollment --------------------------------------
    const stored = loadE2EAdminTwoFactor();
    if (stored) {
      // The two_factor_auth row (if present) holds OUR cached secret,
      // encrypted server-side. ensureV2EcosystemPasswords resets
      // two_factor_enabled=false on every run, so just restore the flag
      // instead of re-enrolling.
      const { data: tfa } = await supabase
        .from('two_factor_auth')
        .select('user_id')
        .eq('user_id', u.id)
        .maybeSingle();
      if (tfa) {
        await supabase.from('users').update({ two_factor_enabled: true }).eq('id', u.id);
        console.log('  ✓ e2e.admin@v2ecosystem.com 2FA flag restored (secret already in DB + cached)');
        continue;
      }
    }
    if (u.two_factor_enabled && !stored) {
      // Enabled but we lost the secret file: the DB secret is encrypted, so
      // re-seed instead — disable and re-enroll below. E2E-only account.
      console.log('  ⚠ e2e.admin 2FA enabled but TOTP secret file missing — re-enrolling');
      await supabase.from('users').update({ two_factor_enabled: false }).eq('id', u.id);
    }
    // Clean slate for enrollment: a live two_factor_auth row makes
    // /2fa/setup 400 ("already enabled") and a stale pending row confuses
    // verifyAndEnable.
    await supabase.from('two_factor_auth').delete().eq('user_id', u.id);
    await supabase.from('two_factor_pending').delete().eq('user_id', u.id);

    const email = 'e2e.admin@v2ecosystem.com';
    const password = 'admin123';
    // Login is tenant-scoped: walid user + walid slug header.
    const loginRes = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': 'walid' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(30_000),
    });
    const loginBody = await loginRes.json().catch(() => null);
    const setupToken =
      loginBody?.data?.twoFactorSetupToken ?? loginBody?.twoFactorSetupToken ?? null;
    if (loginRes.status !== 403 || !setupToken) {
      console.warn(
        `  ⚠ Expected 403 TWO_FACTOR_SETUP_REQUIRED with a setup token for e2e.admin, got HTTP ${loginRes.status}: ${JSON.stringify(loginBody).slice(0, 200)}`,
      );
      continue;
    }

    // Generate the secret (server stores it encrypted + pending)
    const setupRes = await fetch(`${backendUrl}/api/v1/auth/2fa/setup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${setupToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    const setupBody = await setupRes.json().catch(() => null);
    const secret = setupBody?.data?.secret;
    if (setupRes.status !== 200 || !secret) {
      console.warn(`  ⚠ 2FA setup failed for e2e.admin: HTTP ${setupRes.status} ${JSON.stringify(setupBody).slice(0, 200)}`);
      continue;
    }

    // Verify the current TOTP code and activate 2FA (this response already
    // completes the login server-side — completeLoginAfter2FA)
    const enableRes = await fetch(`${backendUrl}/api/v1/auth/2fa/enable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${setupToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: computeTotp(secret) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (enableRes.status !== 200) {
      const errBody = await enableRes.json().catch(() => null);
      console.warn(`  ⚠ 2FA enable failed for e2e.admin: HTTP ${enableRes.status} ${JSON.stringify(errBody).slice(0, 200)}`);
      continue;
    }

    saveE2EAdminTwoFactor({ email, userId: u.id, secret });
    console.log('  ✓ e2e.admin@v2ecosystem.com enrolled in 2FA (TOTP secret cached for login helpers)');
  }
}

/**
 * Engine A fixture hygiene: the staff KDS specs click "Start Shift", which
 * inserts an ACTIVE staff_shifts row (actual_end = NULL). The backend blocks
 * a new ad-hoc start while an open shift from a PREVIOUS day exists (409
 * "Still clocked in to a shift …"), and same-day shifts are reused instead —
 * so stale overnight shifts brick the gate until clocked out. Close any
 * still-open shifts belonging to the fixture staff user (shift_date < today,
 * or any open shift already in the past) to keep reruns self-healing.
 */
async function ensureEngineAShiftHygiene(supabase: ReturnType<typeof createClient>) {
  const { data: staff } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'e2e.staff@v2ecosystem.com')
    .maybeSingle();
  if (!staff) {
    console.warn('  ⚠ e2e.staff@v2ecosystem.com not found — skipping shift hygiene');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const { data: staleShifts, error: staleErr } = await supabase
    .from('staff_shifts')
    .select('id, shift_date')
    .eq('staff_id', staff.id)
    .in('status', ['active', 'scheduled'])
    .is('actual_end', null)
    .lt('shift_date', today);

  if (staleErr) {
    console.warn(`  ⚠ Shift hygiene query failed: ${staleErr.message}`);
    return;
  }
  if (!staleShifts || staleShifts.length === 0) return;

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('staff_shifts')
    .update({ actual_end: nowIso, status: 'completed' })
    .in('id', staleShifts.map((s) => s.id));
  console.log(
    updateErr
      ? `  ⚠ Shift hygiene update failed: ${updateErr.message}`
      : `  ✓ Closed ${staleShifts.length} stale open staff shift(s) (dates: ${staleShifts.map((s) => s.shift_date).join(', ')})`,
  );
}

async function getTenantId(supabase: ReturnType<typeof createClient>, subdomain: string): Promise<string | null> {
  const { data } = await supabase.from('tenants').select('id').eq('subdomain', subdomain).maybeSingle();
  return data?.id ?? null;
}

/**
 * Seeds the tenant's default property used for post-login admin redirects.
 * property_code = `${subdomain}-property` — the slug the login page's
 * `/{propertySlug}/admin` redirect resolves against. Idempotent.
 */
async function ensureTestProperty(supabase: ReturnType<typeof createClient>, tenantId: string, subdomain: string) {
  const propertyCode = `${subdomain}-property`;
  const { data: existing } = await supabase
    .from('properties')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`  ✓ Property for '${subdomain}' already exists`);
    return;
  }

  const { error } = await supabase.from('properties').insert({
    name: `${subdomain} Test Property`,
    tenant_id: tenantId,
    property_code: propertyCode,
    public_slug: propertyCode,
    is_active: true,
  });
  if (error) throw new Error(`[Seed] Failed to create property for '${subdomain}': ${error.message}`);
  console.log(`  ✓ Property '${propertyCode}' seeded for '${subdomain}'`);
}

async function ensureTestTenant(
  supabase: ReturnType<typeof createClient>,
  subdomain: string,
  planCode: string,
  billingStatus: string,
) {
  const { data: existing } = await supabase
    .from('tenants')
    .select('id, billing_status')
    .eq('subdomain', subdomain)
    .maybeSingle();

  if (existing) {
    // If billing_status has drifted from a previous test run, reset it
    if (existing.billing_status !== billingStatus) {
      await supabase
        .from('tenants')
        .update({ billing_status: billingStatus })
        .eq('id', existing.id);
      console.log(`  ✓ Tenant '${subdomain}' billing_status reset to '${billingStatus}'`);
    } else {
      console.log(`  ✓ Tenant '${subdomain}' already exists`);
    }
    return existing.id;
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('id')
    .eq('code', planCode)
    .maybeSingle();

  const { data, error } = await supabase
    .from('tenants')
    .insert({
      subdomain,
      billing_status: billingStatus,
      // subscription_tier is a legacy enum (starter|growth|enterprise).
      // plan_id is now the real source of truth for feature limits.
      // Use 'starter' as a safe enum value regardless of what the plan code is.
      subscription_tier: 'starter',
      plan_id: plan?.id ?? null,
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      is_platform_root: false,
    })
    .select('id')
    .single();

  if (error) throw new Error(`[Seed] Failed to create tenant '${subdomain}': ${error.message}`);
  console.log(`  ✓ Tenant '${subdomain}' seeded (id: ${data.id})`);
  return data.id;
}

async function ensureTestAdminUser(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  subdomain: string,
) {
  // Known test credentials — hardcoded because this is a test-only Supabase project.
  // Any test file that needs to log in imports these constants from test-credentials.ts.
  const email    = `admin@${subdomain}.v2platform.com`;
  const password = 'V2e2eTest!2026';

  const { data: existing } = await supabase
    .from('users')
    .select('id, password_hash')
    .eq('email', email)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existing) {
    // User exists — force back to a known-good credential + role in case
    // password or role drifted from earlier sessions (register would 409).
    const passwordHash = await bcrypt.hash(password, 12);
    const { error: updateErr } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, email_verified: true, two_factor_enabled: false })
      .eq('id', existing.id);
    if (updateErr) {
      console.warn(`  ⚠ Password reset for '${email}' failed: ${updateErr.message}`);
    } else {
      console.log(`  ✓ Test admin '${email}' password re-synced`);
    }
    await patchUserRole(supabase, email, tenantId);
    return;
  }

  // Call the backend's own register endpoint — no bcrypt dependency in e2e.
  // The backend hashes the password itself via its auth service.
  const res = await fetch('http://localhost:3005/api/v1/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-slug': subdomain,
    },
    body: JSON.stringify({ email, password, fullName: 'E2E Test Admin' }),
  });

  // 201 = created, 409 = already exists (race condition safety)
  if (!res.ok && res.status !== 409) {
    const body = await res.text().catch(() => '(no body)');
    throw new Error(`[Seed] Failed to create test admin '${email}': HTTP ${res.status} — ${body}`);
  }

  // Register sets role to 'customer' by default — patch it to super_admin via service key
  await patchUserRole(supabase, email, tenantId);

  console.log(`  ✓ Test admin '${email}' seeded`);
}

async function patchUserRole(
  supabase: ReturnType<typeof createClient>,
  email: string,
  tenantId: string,
) {
  const { data: user, error: lookupErr } = await supabase
    .from('users')
    .select('id, role, two_factor_enabled')
    .eq('email', email)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (lookupErr) {
    console.warn(`  ⚠ patchUserRole lookup failed for '${email}': ${lookupErr.message}`);
    return;
  }

  if (!user) {
    // Row not committed yet — retry once after a short delay
    await new Promise(r => setTimeout(r, 1500));
    const { data: retried } = await supabase
      .from('users')
      .select('id, role')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!retried) {
      console.warn(`  ⚠ patchUserRole: user '${email}' not found after retry — role not patched`);
      return;
    }
    Object.assign(user ?? {}, retried); // point local var at retried
    const { error: updateErr } = await supabase
      .from('users')
      .update({ role: 'super_admin', email_verified: true, two_factor_enabled: false })
      .eq('id', retried.id);
    if (updateErr) console.warn(`  ⚠ patchUserRole update failed: ${updateErr.message}`);
    return;
  }

  if (user.role !== 'super_admin' || user.two_factor_enabled !== false) {
    const { error: updateErr } = await supabase
      .from('users')
      .update({ role: 'super_admin', email_verified: true, two_factor_enabled: false })
      .eq('id', user.id);
    if (updateErr) console.warn(`  ⚠ patchUserRole update failed: ${updateErr.message}`);
  }
}
