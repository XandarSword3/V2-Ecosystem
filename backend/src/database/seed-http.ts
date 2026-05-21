import bcrypt from 'bcryptjs';
import { getSupabase } from './connection.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

async function seed() {
    try {
        const supabase = getSupabase();
        logger.info('Seeding database via HTTP API...');

        const defaultPassword = process.env.NODE_ENV === 'production' ? undefined : 'admin123';
        const adminPasswordPlain = process.env.SEED_ADMIN_PASSWORD || defaultPassword;

        if (!adminPasswordPlain) throw new Error('SEED_ADMIN_PASSWORD required');

        // 1. Create Roles
        const roles = [
            { name: 'super_admin', display_name: 'Super Administrator', description: 'Full access', business_unit: 'admin' },
            { name: 'customer', display_name: 'Customer', description: 'Registered customer', business_unit: null },
            { name: 'restaurant_admin', display_name: 'Restaurant Admin', description: 'Restaurant management', business_unit: 'restaurant' },
            { name: 'restaurant_staff', display_name: 'Restaurant Staff', description: 'Restaurant operations', business_unit: 'restaurant' }
        ];

        for (const role of roles) {
            const { error } = await supabase.from('roles').upsert(role, { onConflict: 'name' });
            if (error) logger.warn(`Role upsert error: ${error.message}`);
        }

        // 2. Create Admin User
        const adminPassword = await bcrypt.hash(adminPasswordPlain, 12);
        const { data: user, error: userError } = await supabase
            .from('users')
            .upsert({
                email: 'admin@v2ecosystem.com',
                password_hash: adminPassword,
                full_name: 'System Administrator',
                email_verified: true,
                is_active: true
            }, { onConflict: 'email' })
            .select('id')
            .single();

        if (userError) throw userError;
        const adminId = user.id;

        // 3. Assign Role via user_roles (Supabase join table)
        const { data: superRole } = await supabase.from('roles').select('id').eq('name', 'super_admin').single();

        if (superRole) {
            await supabase.from('user_roles').upsert({
                user_id: adminId,
                role_id: superRole.id
            }, { onConflict: 'user_id,role_id' }); // adjust conflict target if needed or use ignore
        }

        logger.info('Seeding completed via HTTP.');
        logger.info('Admin: admin@v2ecosystem.com / ' + adminPasswordPlain);
        process.exit(0);
    } catch (error) {
        logger.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
