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
import { createClient } from '@supabase/supabase-js';

const BACKEND_URL = 'http://localhost:3005';

export default async function globalSetup(_config: FullConfig) {
  console.log('\n🔧 V2 E2E — Global Setup\n');

  await verifyServers();
  await seedTestEnvironment();

  console.log('\n✅ Global Setup complete — running tests\n');
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

  // 5. Seed testcorp super_admin user with a known test password
  //    Password is hardcoded here — this is a test-only account on a test-only DB.
  //    Never use this pattern for real credentials.
  await ensureTestAdminUser(supabase, testcorpId, 'testcorp');

  console.log('  ✓ Test tenants ready');
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
    .select('id')
    .eq('email', email)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existing) {
    // User exists — still check and patch role in case it drifted back to 'customer'
    await patchUserRole(supabase, email, tenantId);
    console.log(`  ✓ Test admin '${email}' already exists`);
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
