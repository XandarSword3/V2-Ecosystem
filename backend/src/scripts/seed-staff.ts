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

// Staff accounts to create
const STAFF_ACCOUNTS = [
  { email: 'restaurant.staff@v2resort.com', name: 'Restaurant Staff', role: 'restaurant_staff' },
  { email: 'restaurant.manager@v2resort.com', name: 'Restaurant Manager', role: 'restaurant_manager' },
  { email: 'restaurant.admin@v2resort.com', name: 'Restaurant Admin', role: 'restaurant_admin' },
  { email: 'kitchen.staff@v2resort.com', name: 'Kitchen Staff', role: 'kitchen_staff' },
  { email: 'pool.staff@v2resort.com', name: 'Pool Staff', role: 'pool_staff' },
  { email: 'pool.admin@v2resort.com', name: 'Pool Admin', role: 'pool_admin' },
  { email: 'chalet.staff@v2resort.com', name: 'Chalet Staff', role: 'chalet_staff' },
  { email: 'chalet.manager@v2resort.com', name: 'Chalet Manager', role: 'chalet_manager' },
  { email: 'chalet.admin@v2resort.com', name: 'Chalet Admin', role: 'chalet_admin' },
  { email: 'snack.staff@v2resort.com', name: 'Snack Bar Staff', role: 'snack_bar_staff' },
  { email: 'snack.admin@v2resort.com', name: 'Snack Bar Admin', role: 'snack_bar_admin' },
];

// Get password from environment or use default only in development
const isDev = process.env.NODE_ENV !== 'production';
const DEFAULT_PASSWORD = process.env.SEED_STAFF_PASSWORD || (isDev ? 'staff123' : undefined);

async function seedStaff() {
  if (!DEFAULT_PASSWORD) {
    console.error('❌ SEED_STAFF_PASSWORD environment variable is required in production');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🌱 SEEDING STAFF ACCOUNTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Hash the password once
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  console.log(`🔐 Password for all staff: ${DEFAULT_PASSWORD}\n`);

  // Get all roles for lookup
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, name');

  if (rolesError) {
    console.error('❌ Failed to fetch roles:', rolesError.message);
    process.exit(1);
  }

  const roleMap = new Map(roles?.map(r => [r.name, r.id]) || []);
  console.log(`📋 Found ${roleMap.size} roles in database\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const account of STAFF_ACCOUNTS) {
    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', account.email)
      .single();

    if (existing) {
      console.log(`⏭️  Skipping ${account.email} (already exists)`);
      skipped++;
      continue;
    }

    // Get role ID
    const roleId = roleMap.get(account.role);
    if (!roleId) {
      console.log(`❌ Role not found: ${account.role} for ${account.email}`);
      failed++;
      continue;
    }

    // Create user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email: account.email,
        password_hash: passwordHash,
        name: account.name,
        is_active: true,
        is_verified: true,
      })
      .select('id')
      .single();

    if (userError) {
      console.log(`❌ Failed to create ${account.email}: ${userError.message}`);
      failed++;
      continue;
    }

    // Assign role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: user.id,
        role_id: roleId,
      });

    if (roleError) {
      console.log(`⚠️  Created ${account.email} but failed to assign role: ${roleError.message}`);
      failed++;
      continue;
    }

    console.log(`✅ Created ${account.email} with role ${account.role}`);
    created++;
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Created: ${created}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Failed:  ${failed}`);
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
