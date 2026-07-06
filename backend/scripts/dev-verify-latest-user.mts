/**
 * DEV-ONLY throwaway script. Not part of the app.
 * Finds the most recently created user with email_verified = false
 * and flips it to true, so local testing isn't blocked on email delivery.
 * Run with: npx tsx scripts/dev-verify-latest-user.mts
 */
import { getSupabase } from '../src/database/supabase.js';

async function main() {
  const supabase = getSupabase();

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, email_verified, created_at')
    .eq('email_verified', false)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('No unverified users found.');
    process.exit(0);
  }

  console.log('Unverified users (most recent first):');
  users.forEach((u, i) => console.log(`  [${i}] ${u.email} — created ${u.created_at}`));

  const target = users[0];
  console.log(`\nVerifying: ${target.email} (id: ${target.id})`);

  const { error: updateError } = await supabase
    .from('users')
    .update({ email_verified: true, updated_at: new Date().toISOString() })
    .eq('id', target.id);

  if (updateError) {
    console.error('Update failed:', updateError.message);
    process.exit(1);
  }

  console.log(`✅ ${target.email} is now verified. You can log in.`);
}

main();
