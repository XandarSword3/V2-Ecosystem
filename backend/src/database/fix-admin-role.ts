import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixAllUserRoles() {
  console.log('🔧 Fixing all user role assignments...\n');

  const usersToFix = [
    { email: 'admin@v2resort.com', role: 'super_admin' },
    { email: 'restaurant.staff@v2resort.com', role: 'restaurant_staff' },
    { email: 'restaurant.admin@v2resort.com', role: 'restaurant_admin' },
    { email: 'snack.staff@v2resort.com', role: 'snack_bar_staff' },
    { email: 'chalet.staff@v2resort.com', role: 'chalet_staff' },
    { email: 'chalet.admin@v2resort.com', role: 'chalet_admin' },
    { email: 'pool.staff@v2resort.com', role: 'pool_staff' },
    { email: 'pool.admin@v2resort.com', role: 'pool_admin' },
  ];

  for (const userInfo of usersToFix) {
    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', userInfo.email)
      .single();

    if (userError || !user) {
      console.log(`User ${userInfo.email} not found, skipping`);
      continue;
    }

    // Get role
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, name')
      .eq('name', userInfo.role)
      .single();

    if (roleError || !role) {
      console.log(`Role ${userInfo.role} not found, skipping`);
      continue;
    }

    // Check existing assignment
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .eq('role_id', role.id);

    if (!existingRole || existingRole.length === 0) {
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role_id: role.id,
        });

      if (insertError) {
        console.error(`Error assigning ${userInfo.role} to ${userInfo.email}:`, insertError.message);
      } else {
        console.log(`✓ Assigned ${userInfo.role} to ${userInfo.email}`);
      }
    } else {
      console.log(`✓ ${userInfo.email} already has ${userInfo.role}`);
    }
  }

  console.log('\n🎉 All user roles fixed!');
}

fixAllUserRoles().catch(console.error);
