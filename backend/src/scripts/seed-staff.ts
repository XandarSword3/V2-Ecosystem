import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Staff accounts to create. `scope` is the single source of truth for the
// authorization tier; `department` is the engine-specific sub-role that lives
// on the staff record (staff_profiles), not the user row.
const STAFF_ACCOUNTS = [
  { email: 'restaurant.staff@v2ecosystem.com', name: 'Restaurant Staff', scope: 'property_staff', department: 'restaurant' },
  { email: 'restaurant.manager@v2ecosystem.com', name: 'Restaurant Manager', scope: 'property_manager', department: 'restaurant' },
  { email: 'restaurant.admin@v2ecosystem.com', name: 'Restaurant Admin', scope: 'property_manager', department: 'restaurant' },
  { email: 'kitchen.staff@v2ecosystem.com', name: 'Kitchen Staff', scope: 'property_staff', department: 'kitchen' },
  { email: 'pool.staff@v2ecosystem.com', name: 'Pool Staff', scope: 'property_staff', department: 'pool' },
  { email: 'pool.admin@v2ecosystem.com', name: 'Pool Admin', scope: 'property_manager', department: 'pool' },
  { email: 'chalet.staff@v2ecosystem.com', name: 'Chalet Staff', scope: 'property_staff', department: 'chalet' },
  { email: 'chalet.manager@v2ecosystem.com', name: 'Chalet Manager', scope: 'property_manager', department: 'chalet' },
  { email: 'chalet.admin@v2ecosystem.com', name: 'Chalet Admin', scope: 'property_manager', department: 'chalet' },
  { email: 'snack.staff@v2ecosystem.com', name: 'Snack Bar Staff', scope: 'property_staff', department: 'snack_bar' },
  { email: 'snack.admin@v2ecosystem.com', name: 'Snack Bar Admin', scope: 'property_manager', department: 'snack_bar' },
];

// Get password from environment or use default only in development
const isDev = process.env.NODE_ENV !== 'production';
const DEFAULT_PASSWORD = process.env.SEED_STAFF_PASSWORD || (isDev ? 'staff123' : undefined);

async function resolveTenantId(): Promise<string | null> {
  if (process.env.SEED_TENANT_ID) {
    return process.env.SEED_TENANT_ID;
  }
  const { data } = await supabase.from('tenants').select('id').limit(1).maybeSingle();
  return data?.id ?? null;
}

async function seedStaff() {
  if (!DEFAULT_PASSWORD) {
    console.error('❌ SEED_STAFF_PASSWORD environment variable is required in production');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🌱 SEEDING STAFF ACCOUNTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const tenantId = await resolveTenantId();
  if (!tenantId) {
    console.error('❌ No tenant found. Set SEED_TENANT_ID or seed a tenant first.');
    process.exit(1);
  }
  console.log(`🏢 Tenant: ${tenantId}\n`);

  // Hash the password once
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  console.log(`🔐 Password for all staff: ${DEFAULT_PASSWORD}\n`);

  let created = 0;
  let failed = 0;

  for (const account of STAFF_ACCOUNTS) {
    // Upsert the user. users.scope is the authorization source of truth; no
    // roles/user_roles rows are written.
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert(
        {
          email: account.email,
          password_hash: passwordHash,
          full_name: account.name,
          is_active: true,
          email_verified: true,
          scope: account.scope,
          tenant_id: tenantId,
        },
        { onConflict: 'email' },
      )
      .select('id')
      .single();

    if (userError) {
      console.log(`❌ Failed to upsert ${account.email}: ${userError.message}`);
      failed++;
      continue;
    }

    // Upsert the staff record carrying the department/sub-role.
    const { error: profileError } = await supabase
      .from('staff_profiles')
      .upsert(
        {
          user_id: user.id,
          tenant_id: tenantId,
          department: account.department,
        },
        { onConflict: 'user_id' },
      );

    if (profileError) {
      console.log(`⚠️  Created ${account.email} but staff profile failed: ${profileError.message}`);
      failed++;
      continue;
    }

    console.log(`✅ Upserted ${account.email} as ${account.scope} (department: ${account.department})`);
    created++;
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Upserted: ${created}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

seedStaff()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
