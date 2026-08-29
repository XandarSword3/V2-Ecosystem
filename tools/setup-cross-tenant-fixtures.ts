/**
 * Setup cross-tenant test fixtures for F2 authorization E2E.
 *
 * Uses the backend's own Supabase client (runs server-side, connected to DB).
 * Creates:
 *   - Tenant B admin (email-verified)
 *   - Tenant B staff user
 *   - Tenant B module (instant_transaction with catalog items)
 *
 * Run: cd v2-resort && npx tsx tools/setup-cross-tenant-fixtures.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qxtmeuuuiarzsimvwqsy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TENANT_A_ID = 'cef22e40-fac4-49d5-ac56-215e1db3fae4';
const TENANT_B_EMAIL = 'e2e-tenant-b@v2ecosystem.com';
const TENANT_B_STAFF_EMAIL = 'e2e-staff-b@v2ecosystem.com';

async function main() {
  console.log('=== Cross-tenant fixture setup ===\n');

  // 1. Verify Tenant B admin email
  console.log('1. Verifying Tenant B admin email...');
  const { error: verifyErr } = await supabase
    .from('users')
    .update({ email_verified: true, updated_at: new Date().toISOString() })
    .eq('email', TENANT_B_EMAIL)
    .eq('email_verified', false);

  if (verifyErr) {
    console.log(`   Warning: ${verifyErr.message} (may already be verified)`);
  } else {
    console.log('   ✅ Email verified');
  }

  // 2. Get Tenant B's tenant_id
  const { data: tenantBUser } = await supabase
    .from('users')
    .select('id, tenant_id')
    .eq('email', TENANT_B_EMAIL)
    .single();

  if (!tenantBUser) {
    console.error('   ❌ Tenant B admin user not found');
    process.exit(1);
  }

  const TENANT_B_ID = tenantBUser.tenant_id;
  console.log(`   Tenant B ID: ${TENANT_B_ID}`);

  // 3. Create Tenant B staff user (auto-verified since admin-created)
  console.log('\n2. Creating Tenant B staff user...');
  const { data: existingStaff } = await supabase
    .from('users')
    .select('id')
    .eq('email', TENANT_B_STAFF_EMAIL)
    .single();

  let staffBId: string;
  if (existingStaff) {
    console.log(`   Staff B already exists: ${existingStaff.id}`);
    staffBId = existingStaff.id;
  } else {
    // Hash password using bcrypt (backend dependency)
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash('staff123', 12);

    const { data: newStaff, error: staffErr } = await supabase
      .from('users')
      .insert({
        email: TENANT_B_STAFF_EMAIL,
        password_hash: passwordHash,
        full_name: 'E2E Staff B',
        scope: 'property_staff',
        app_roles: ['staff'],
        tenant_id: TENANT_B_ID,
        email_verified: true,
        is_active: true,
      })
      .select('id')
      .single();

    if (staffErr || !newStaff) {
      console.error(`   ❌ Failed to create staff B: ${staffErr?.message}`);
      process.exit(1);
    }
    staffBId = newStaff.id;
    console.log(`   ✅ Staff B created: ${staffBId}`);
  }

  // 4. Create Tenant B property if needed
  console.log('\n3. Ensuring Tenant B has a property...');
  const { data: existingProp } = await supabase
    .from('properties')
    .select('id')
    .eq('tenant_id', TENANT_B_ID)
    .limit(1)
    .single();

  let propertyBId: string;
  if (existingProp) {
    propertyBId = existingProp.id;
    console.log(`   Property B exists: ${propertyBId}`);
  } else {
    const { data: newProp, error: propErr } = await supabase
      .from('properties')
      .insert({
        tenant_id: TENANT_B_ID,
        name: 'E2E Property B',
        slug: 'e2e-property-b',
        is_active: true,
      })
      .select('id')
      .single();

    if (propErr || !newProp) {
      console.error(`   ❌ Failed to create property B: ${propErr?.message}`);
      process.exit(1);
    }
    propertyBId = newProp.id;
    console.log(`   ✅ Property B created: ${propertyBId}`);
  }

  // 5. Create Tenant B module (instant_transaction)
  console.log('\n4. Creating Tenant B module...');
  const { data: existingMod } = await supabase
    .from('modules')
    .select('id, slug')
    .eq('tenant_id', TENANT_B_ID)
    .eq('engine_type', 'instant_transaction')
    .limit(1)
    .single();

  let moduleBSlug: string;
  if (existingMod) {
    moduleBSlug = existingMod.slug;
    console.log(`   Module B exists: ${moduleBSlug}`);
  } else {
    const { data: newMod, error: modErr } = await supabase
      .from('modules')
      .insert({
        tenant_id: TENANT_B_ID,
        property_id: propertyBId,
        name: 'E2E Module B',
        slug: 'e2e-module-b',
        engine_type: 'instant_transaction',
        is_active: true,
        show_in_main: true,
      })
      .select('slug')
      .single();

    if (modErr || !newMod) {
      console.error(`   ❌ Failed to create module B: ${modErr?.message}`);
      process.exit(1);
    }
    moduleBSlug = newMod.slug;
    console.log(`   ✅ Module B created: ${moduleBSlug}`);
  }

  // 6. Create catalog items in Tenant B module
  console.log('\n5. Creating catalog items in Module B...');
  const { data: moduleB } = await supabase
    .from('modules')
    .select('id')
    .eq('slug', moduleBSlug)
    .single();

  const { data: existingItems } = await supabase
    .from('catalog_items')
    .select('id')
    .eq('module_id', moduleB!.id)
    .limit(1);

  if (!existingItems || existingItems.length === 0) {
    const { error: itemErr } = await supabase
      .from('catalog_items')
      .insert({
        module_id: moduleB!.id,
        tenant_id: TENANT_B_ID,
        name: 'Tenant B Salad',
        price: 12,
        category: 'e2e-test',
        is_available: true,
      });

    if (itemErr) {
      console.log(`   ⚠️  Catalog item creation: ${itemErr.message}`);
    } else {
      console.log('   ✅ Catalog item created');
    }
  } else {
    console.log('   Catalog items already exist');
  }

  // 7. Assign staff B to the module
  console.log('\n6. Assigning staff B to module...');
  const { data: existingAccess } = await supabase
    .from('user_module_access')
    .select('id')
    .eq('user_id', staffBId)
    .eq('module_id', moduleB!.id)
    .limit(1);

  if (!existingAccess || existingAccess.length === 0) {
    const { error: accessErr } = await supabase
      .from('user_module_access')
      .insert({
        user_id: staffBId,
        module_id: moduleB!.id,
        tenant_id: TENANT_B_ID,
      });

    if (accessErr) {
      console.log(`   ⚠️  Module access: ${accessErr.message}`);
    } else {
      console.log('   ✅ Staff B assigned to module');
    }
  } else {
    console.log('   Staff B already assigned');
  }

  // 8. Also assign staff A to Module A (delete module) if not already
  console.log('\n7. Ensuring staff A has module access...');
  const { data: staffA } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'menu.service.staff@v2ecosystem.com')
    .single();

  const { data: moduleA } = await supabase
    .from('modules')
    .select('id')
    .eq('slug', 'delete')
    .single();

  if (staffA && moduleA) {
    const { data: existingAccessA } = await supabase
      .from('user_module_access')
      .select('id')
      .eq('user_id', staffA.id)
      .eq('module_id', moduleA.id)
      .limit(1);

    if (!existingAccessA || existingAccessA.length === 0) {
      const { error: accessErr } = await supabase
        .from('user_module_access')
        .insert({
          user_id: staffA.id,
          module_id: moduleA.id,
          tenant_id: TENANT_A_ID,
        });

      if (accessErr) {
        console.log(`   ⚠️  Module access A: ${accessErr.message}`);
      } else {
        console.log('   ✅ Staff A assigned to module A');
      }
    } else {
      console.log('   Staff A already assigned to module A');
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Tenant A ID: ${TENANT_A_ID}`);
  console.log(`Tenant A Staff: menu.service.staff@v2ecosystem.com / staff123`);
  console.log(`Tenant A Module: delete`);
  console.log(``);
  console.log(`Tenant B ID: ${TENANT_B_ID}`);
  console.log(`Tenant B Admin: e2e-tenant-b@v2ecosystem.com / SecurePass123!`);
  console.log(`Tenant B Staff: ${TENANT_B_STAFF_EMAIL} / staff123`);
  console.log(`Tenant B Module: ${moduleBSlug}`);
}

main().catch(console.error);
