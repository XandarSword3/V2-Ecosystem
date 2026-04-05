import { getSupabase } from './src/database/connection';
import { logger } from './src/utils/logger.js';

async function fullReset() {
    console.log('=== FULL SYSTEM RESET ===');
    const supabase = getSupabase();

    try {
        // 1. Delete Custom Modules (Everything except Core if any?)
        // Actually, we want to delete EVERYTHING for White Label test.
        // Core modules (Restaurant/Pool default) are likely re-seeded by migration or should be kept.
        // But white-label test implies we replace them.
        // We will delete ALL modules created during Scenario 1.
        // GYM Modules: fitness-classes, personal-training, nutrition-store.
        // Also 'gym-floor' or 'GYM' if created.
        const slugs = [
            'fitness-classes', 'personal-training', 'nutrition-store',
            'gym-floor', 'gym', 'bootcamp', 'yoga-studio'
        ];

        console.log('1. Deleting Modules...');
        const { error: mErr } = await supabase.from('modules').delete().in('slug', slugs);
        if (mErr) console.error('Error deleting modules:', mErr.message);
        else console.log('   ✅ Modules deleted');

        // 2. Delete Custom Roles
        console.log('2. Deleting Roles...');
        const roles = [
            'fitness-classes_admin', 'fitness-classes_staff',
            'personal-training_admin', 'personal-training_staff',
            'nutrition-store_admin', 'nutrition-store_staff'
        ];
        const { error: rErr } = await supabase.from('roles').delete().in('name', roles);
        if (rErr) console.error('Error deleting roles:', rErr.message);
        else console.log('   ✅ Roles deleted');

        // 3. Reset CMS / Branding
        console.log('3. Resetting CMS & Branding...');
        // We can delete the keys, or set them to default.
        // Deleting is safer, system should fallback or be empty.
        const keys = ['branding', 'homepage', 'footer'];
        const { error: sErr } = await supabase.from('site_settings').delete().in('key', keys);
        if (sErr) console.error('Error resetting settings:', sErr.message);
        else console.log('   ✅ Settings reset');

        // 4. Delete Users (Customers created during test)
        console.log('4. Cleaning up Users...');
        // Delete users with email starting with gymuser_
        const { error: uErr } = await supabase.from('users').delete().ilike('email', 'gymuser_%');
        if (uErr) console.error('Error deleting users:', uErr.message);
        else console.log('   ✅ Users cleaned up');

        console.log('\nResult: System returned to neutral state.');

    } catch (e: any) {
        console.error('Reset Failed:', e.message);
    }
    process.exit(0);
}

fullReset();
