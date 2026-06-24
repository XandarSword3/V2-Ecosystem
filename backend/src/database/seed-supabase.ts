import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log('🌱 Starting database seed with Supabase...\n');

  // Get passwords from environment or use defaults only in development
  const isDev = process.env.NODE_ENV !== 'production';
  const adminPasswordPlain = process.env.SEED_ADMIN_PASSWORD || (isDev ? 'admin123' : undefined);
  const customerPasswordPlain = process.env.SEED_CUSTOMER_PASSWORD || (isDev ? 'TestPass123!' : undefined);
  const legacyCustomerPasswordPlain = process.env.SEED_LEGACY_CUSTOMER_PASSWORD || (isDev ? 'password123' : undefined);

  if (!adminPasswordPlain || !customerPasswordPlain || !legacyCustomerPasswordPlain) {
    throw new Error('SEED_ADMIN_PASSWORD, SEED_CUSTOMER_PASSWORD, and SEED_LEGACY_CUSTOMER_PASSWORD are required in production');
  }

  try {
    // 1. Create system roles
    // Module-specific roles (e.g. <slug>_admin, <slug>_staff) are auto-created
    // when modules are added via the admin panel (modules.controller.ts → createModule).
    // Do NOT add them here.
    console.log('Creating roles...');
    const roles = [
      { name: 'super_admin', display_name: 'Super Administrator', description: 'Full system access', business_unit: 'admin' },
      { name: 'customer', display_name: 'Customer', description: 'Registered customer', business_unit: null },
    ];

    for (const role of roles) {
      const { error } = await supabase.from('roles').upsert(role, { onConflict: 'name' });
      if (error) console.error(`  Error creating role ${role.name}:`, error.message);
    }
    console.log('  ✓ Roles created\n');

    // 2. Create admin user
    console.log('Creating admin user...');
    const adminPassword = await bcrypt.hash(adminPasswordPlain, 12);
    
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .upsert({
        email: 'admin@v2ecosystem.com',
        password_hash: adminPassword,
        full_name: 'System Administrator',
        email_verified: true,
        is_active: true,
      }, { onConflict: 'email' })
      .select('id')
      .single();

    if (adminError) {
      console.error('  Error creating admin:', adminError.message);
    } else {
      console.log('  ✓ Admin user created\n');

      // 3. Assign super_admin role
      console.log('Assigning super_admin role...');
      const { data: superAdminRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'super_admin')
        .single();

      if (superAdminRole && adminUser) {
        // First check if role exists
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', adminUser.id)
          .eq('role_id', superAdminRole.id);
        
        if (!existingRole || existingRole.length === 0) {
          await supabase.from('user_roles').insert({
            user_id: adminUser.id,
            role_id: superAdminRole.id,
          });
        }
        console.log('  ✓ Role assigned\n');
      }
    }

    // Step 4 removed — hardcoded module-specific staff users (e.g. <module>.admin@, <module>.staff@)
    // violate the white-label architecture. Staff users are auto-created by
    // modules.controller.ts → createModule when modules are added via the admin panel.

    // 5. Create customer users used by Playwright suites
    console.log('Creating customer users...');
    const customerPassword = await bcrypt.hash(customerPasswordPlain, 12);
    const legacyCustomerPassword = await bcrypt.hash(legacyCustomerPasswordPlain, 12);
    const customerUsers = [
      { email: 'e2e.customer@test.com', full_name: 'E2E Customer', password_hash: customerPassword },
      { email: 'customer@test.com', full_name: 'Test Customer', password_hash: legacyCustomerPassword },
    ];

    const { data: customerRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'customer')
      .single();

    for (const customer of customerUsers) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .upsert({
          email: customer.email,
          password_hash: customer.password_hash,
          full_name: customer.full_name,
          email_verified: true,
          is_active: true,
        }, { onConflict: 'email' })
        .select('id')
        .single();

      if (userError || !user || !customerRole) continue;

      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('role_id', customerRole.id);

      if (!existingRole || existingRole.length === 0) {
        await supabase.from('user_roles').insert({
          user_id: user.id,
          role_id: customerRole.id,
        });
      }
    }
    console.log('  ✓ Customer users created\n');

    // Steps 6–11 removed — module-specific data seeding (catalog tables, unit/capacity tables,
    // and business-type-specific sample reviews) violates the white-label architecture.
    // Business data is created by operators via the admin panel after module setup.

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎉 Database seeding completed successfully!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📧 Admin credentials:');
    console.log('   Email: admin@v2ecosystem.com');
    console.log('   Password: [from SEED_ADMIN_PASSWORD env var or "admin123" in dev]');
    console.log('');
    console.log('🧪 E2E test customer accounts:');
    console.log('   - e2e.customer@test.com  (SEED_CUSTOMER_PASSWORD)');
    console.log('   - customer@test.com      (SEED_LEGACY_CUSTOMER_PASSWORD)');
    console.log('');
    console.log('ℹ️  Module-specific roles, staff users, and business data are');
    console.log('   created via the admin panel when modules are added.');
    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
