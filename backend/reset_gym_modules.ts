import { getSupabase } from './src/database/connection';

async function reset() {
    const supabase = getSupabase();
    const slugs = ['fitness-classes', 'personal-training', 'nutrition-store', 'test-fitness'];
    const roles = [
        'fitness-classes_admin', 'fitness-classes_staff',
        'personal-training_admin', 'personal-training_staff',
        'nutrition-store_admin', 'nutrition-store_staff',
        'test-fitness_admin', 'test-fitness_staff'
    ];

    console.log('Deleting roles...');
    const { error: rErr } = await supabase.from('roles').delete().in('name', roles);
    if (rErr) console.log('Error deleting roles:', rErr.message);
    else console.log('Roles deleted');

    console.log('Deleting modules...');
    const { error: mErr } = await supabase.from('modules').delete().in('slug', slugs);
    if (mErr) console.log('Error deleting modules:', mErr.message);
    else console.log('Modules deleted');

    process.exit(0);
}

reset();
