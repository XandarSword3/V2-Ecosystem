// Quick database check script
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env from backend root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  console.error('SUPABASE_URL:', supabaseUrl ? 'set' : 'missing');
  console.error('SUPABASE_SERVICE_KEY:', supabaseServiceKey ? 'set' : 'missing');
  console.error('CWD:', process.cwd());
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabase() {
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('📊 DATABASE INSPECTION REPORT\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Check roles
  console.log('🔐 ROLES:');
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, name, display_name, description, business_unit')
    .order('name');

  if (rolesError) {
    console.error('  Error fetching roles:', rolesError.message);
  } else {
    console.log(`  Found ${roles?.length || 0} roles:\n`);
    roles?.forEach(role => {
      console.log(`    - ${role.name} (${role.display_name})`);
      console.log(`      Business Unit: ${role.business_unit || 'N/A'}`);
    });
  }

  console.log('\n───────────────────────────────────────────────────────────────\n');

  // 2. Check users
  console.log('👥 USERS:');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, full_name, is_active, email_verified, created_at')
    .is('deleted_at', null)
    .order('created_at');

  if (usersError) {
    console.error('  Error fetching users:', usersError.message);
  } else {
    console.log(`  Found ${users?.length || 0} users:\n`);
    
    for (const user of users || []) {
      // Get roles for this user
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role_id, roles(name, display_name)')
        .eq('user_id', user.id);

      const roleNames = userRoles?.map((ur: { role_id: string; roles?: { name: string; display_name: string }[] | { name: string; display_name: string } }) => {
        const roles = ur.roles;
        if (Array.isArray(roles)) return roles[0]?.name;
        return roles?.name;
      }).filter(Boolean) || [];
      
      console.log(`    📧 ${user.email}`);
      console.log(`       Name: ${user.full_name}`);
      console.log(`       Active: ${user.is_active}, Verified: ${user.email_verified}`);
      console.log(`       Roles: ${roleNames.length > 0 ? roleNames.join(', ') : 'NONE'}`);
      console.log('');
    }
  }

  console.log('───────────────────────────────────────────────────────────────\n');

  // 3. Check user_roles join table
  console.log('🔗 USER_ROLES TABLE:');
  const { data: userRoles, error: urError } = await supabase
    .from('user_roles')
    .select('user_id, role_id');

  if (urError) {
    console.error('  Error fetching user_roles:', urError.message);
  } else {
    console.log(`  Found ${userRoles?.length || 0} user-role assignments`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

checkDatabase().catch(console.error);
