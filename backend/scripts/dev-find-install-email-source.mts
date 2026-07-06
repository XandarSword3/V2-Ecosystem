/**
 * DEV-ONLY diagnostic script. Standalone — does not import any app modules,
 * to avoid unrelated import-resolution issues. Reads Supabase creds straight
 * from .env and queries directly.
 */
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  console.log('=== Checking email_templates table ===');
  const { data: templates, error: tplError } = await supabase
    .from('email_templates')
    .select('template_name, subject, html_body, is_active');

  if (tplError) {
    console.log('email_templates query failed:', tplError.message);
  } else if (!templates || templates.length === 0) {
    console.log('No rows in email_templates.');
  } else {
    templates.forEach(t => {
      const hasInstall = t.html_body?.includes('/install');
      const hasVercel = t.html_body?.includes('vercel.app');
      console.log(`- [${t.template_name}] active=${t.is_active} hasInstallLink=${!!hasInstall} hasVercelDomain=${!!hasVercel}`);
      if (hasInstall || hasVercel) {
        console.log('  >>> MATCH. Subject:', t.subject);
        console.log('  >>> Body snippet:', t.html_body.slice(0, 800));
      }
    });
  }

  console.log('\n=== Checking sessions table for the specific token ===');
  const token = '5fd914c9-1019-49c7-9fd7-18475ebd63e6';
  const { data: session, error: sessError } = await supabase
    .from('sessions')
    .select('*')
    .or(`token.eq.${token},refresh_token.eq.${token}`);

  if (sessError) {
    console.log('sessions query failed:', sessError.message);
  } else if (!session || session.length === 0) {
    console.log('No session row found for that token — it may have been consumed/expired, or it was never a "sessions" row (e.g. a Stripe/provisioning-generated token instead).');
  } else {
    console.log('Found session:', JSON.stringify(session, null, 2));
  }

  console.log('\n=== Recently created users (last 10) ===');
  const { data: recentUsers } = await supabase
    .from('users')
    .select('id, email, email_verified, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  (recentUsers || []).forEach(u => console.log(`- ${u.email} | verified=${u.email_verified} | ${u.created_at}`));
}

main();
