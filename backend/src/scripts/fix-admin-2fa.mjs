/**
 * fix-admin-2fa.mjs
 *
 * Resets the super_admin user's 2FA enrollment from scratch.
 * Instead of deleting/recreating the user (which hits FK constraints),
 * this script resets the user in-place and re-enrolls 2FA properly,
 * matching the backend TwoFactorService's crypto expectations:
 *   - AES-256-GCM encrypted secret in `two_factor_auth` table
 *   - SHA-256 hashed backup codes
 *
 * Run from v2-resort/backend:
 *   node --env-file=.env src/scripts/fix-admin-2fa.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { generateSecret, generateURI } from 'otplib';
import qrcode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const ADMIN_EMAIL = 'admin@v2ecosystem.com';
const ADMIN_PASSWORD = 'admin123';
const APP_NAME = 'V2 Ecosystem';

// ── Supabase client ───────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
  process.exit(1);
}
if (!jwtSecret) {
  console.error('❌ JWT_SECRET must be set in .env (needed for 2FA secret encryption)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Crypto helpers (mirrors TwoFactorService exactly) ─────────────────────────
function encryptSecret(secret) {
  const iv = crypto.randomBytes(12); // GCM standard: 12-byte IV
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    crypto.createHash('sha256').update(jwtSecret).digest(),
    iv
  );
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + encrypted + ':' + authTag;
}

function hashBackupCode(code) {
  const normalized = code.replace(/-/g, '').toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function generateBackupCodes(count) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════ Super Admin 2FA Reset ══════════════');
console.log('  Target: ', ADMIN_EMAIL);
console.log('  Supabase:', supabaseUrl);
console.log('');

// ── Step 1: Find or create admin user ─────────────────────────────────────────
let { data: user, error: userErr } = await supabase
  .from('users')
  .select('id, email, two_factor_enabled')
  .eq('email', ADMIN_EMAIL)
  .single();

if (userErr || !user) {
  // User doesn't exist — create from scratch
  console.log('ℹ️  Admin user not found. Creating fresh...');

  // Ensure super_admin role exists
  await supabase.from('roles').upsert(
    { name: 'super_admin', display_name: 'Super Administrator', description: 'Full system access', business_unit: 'admin' },
    { onConflict: 'name' }
  );

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const { data: newUser, error: createErr } = await supabase
    .from('users')
    .insert({
      email: ADMIN_EMAIL,
      password_hash: passwordHash,
      full_name: 'System Administrator',
      email_verified: true,
      is_active: true,
      two_factor_enabled: false,
    })
    .select('id, email, two_factor_enabled')
    .single();

  if (createErr) {
    console.error('❌ User creation failed:', createErr.message);
    process.exit(1);
  }

  user = newUser;
  console.log(`  ✓ User created (id: ${user.id})`);

  // Assign super_admin role
  const { data: roleData } = await supabase.from('roles').select('id').eq('name', 'super_admin').single();
  if (roleData) {
    await supabase.from('user_roles').upsert(
      { user_id: user.id, role_id: roleData.id },
      { onConflict: 'user_id,role_id' }
    );
    console.log('  ✓ super_admin role assigned');
  }
} else {
  console.log(`🔧 Found existing admin (id: ${user.id}). Resetting...`);
}

const userId = user.id;

// ── Step 2: Reset password ────────────────────────────────────────────────────
console.log('\n🔧 Resetting password...');
const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
const { error: pwErr } = await supabase
  .from('users')
  .update({
    password_hash: passwordHash,
    full_name: 'System Administrator',
    email_verified: true,
    is_active: true,
  })
  .eq('id', userId);

if (pwErr) console.error('  ⚠️  Password reset warning:', pwErr.message);
else console.log('  ✓ Password reset');

// ── Step 3: Ensure super_admin role is assigned ───────────────────────────────
console.log('\n🔧 Verifying role assignment...');
const { data: roleData } = await supabase.from('roles').select('id').eq('name', 'super_admin').single();
if (roleData) {
  // Check existing
  const { data: existing } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .eq('role_id', roleData.id);

  if (!existing || existing.length === 0) {
    await supabase.from('user_roles').insert({ user_id: userId, role_id: roleData.id });
    console.log('  ✓ super_admin role assigned (was missing)');
  } else {
    console.log('  ✓ super_admin role already assigned');
  }
}

// ── Step 4: Wipe old 2FA data ─────────────────────────────────────────────────
console.log('\n🗑️  Clearing old 2FA data...');

await supabase.from('two_factor_auth').delete().eq('user_id', userId);
console.log('  ✓ two_factor_auth cleared');

await supabase.from('two_factor_pending').delete().eq('user_id', userId);
console.log('  ✓ two_factor_pending cleared');

// Clear user-level 2FA fields too
await supabase
  .from('users')
  .update({
    two_factor_enabled: false,
    two_factor_secret: null,
    backup_codes: null,
  })
  .eq('id', userId);
console.log('  ✓ User 2FA fields cleared');

// ── Step 5: Generate & store 2FA properly ─────────────────────────────────────
console.log('\n🔐 Setting up TOTP 2FA...');

// Generate a base32 TOTP secret (otplib v13)
const totpSecret = generateSecret({ length: 20 });

// Encrypt it the same way TwoFactorService does
const encryptedSecret = encryptSecret(totpSecret);

// Generate 8 backup codes, store them hashed
const backupCodes = generateBackupCodes(8);
const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));

// Write to the two_factor_auth table (where TwoFactorService.verifyCode reads from)
const { error: tfaErr } = await supabase.from('two_factor_auth').upsert(
  {
    user_id: userId,
    secret: encryptedSecret,
    backup_codes: hashedBackupCodes,
    enabled_at: new Date().toISOString(),
  },
  { onConflict: 'user_id' }
);

if (tfaErr) {
  console.error('  ❌ 2FA enrollment failed:', tfaErr.message);
  process.exit(1);
}

// Update user record to mark 2FA enabled
const { error: userUpdateErr } = await supabase
  .from('users')
  .update({
    two_factor_enabled: true,
    two_factor_secret: totpSecret,   // Also store plaintext for any legacy paths
    backup_codes: backupCodes,       // Store plaintext for any legacy paths
  })
  .eq('id', userId);

if (userUpdateErr) {
  // Non-fatal — the primary 2FA table is what matters
  console.log('  ⚠️  User field update warning:', userUpdateErr.message);
}

console.log('  ✓ 2FA enrolled in two_factor_auth table (AES-256-GCM encrypted)');
console.log('  ✓ Backup codes stored (SHA-256 hashed)');

// ── Step 6: Build the OTP Auth URI and QR code ───────────────────────────────
const otpUri = generateURI({
  secret: totpSecret,
  label: ADMIN_EMAIL,
  issuer: APP_NAME,
  digits: 6,
  period: 30,
  algorithm: 'sha1',
});

let qrTerminal = '';
try {
  qrTerminal = await qrcode.toString(otpUri, { type: 'terminal', small: true });
} catch {
  qrTerminal = '  (QR code generation failed — use the manual secret below)';
}

// ══════════════════════════════════════════════════════════════════════════════
//  OUTPUT — ALL THE INFO YOU NEED
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║              SUPER ADMIN CREDENTIALS — SAVE THESE              ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log('║                                                                ║');
console.log('║  📧 LOGIN                                                      ║');
console.log(`║     Email:    ${ADMIN_EMAIL.padEnd(49)}║`);
console.log(`║     Password: ${ADMIN_PASSWORD.padEnd(49)}║`);
console.log('║                                                                ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log('║                                                                ║');
console.log('║  🔐 TOTP 2FA SECRET (enter this in your authenticator app)     ║');
console.log(`║     ${totpSecret.padEnd(59)}║`);
console.log('║                                                                ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log('║                                                                ║');
console.log('║  📱 QR CODE — Scan with Google Authenticator / Authy:          ║');
console.log('║                                                                ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(qrTerminal);
console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║  🔑 BACKUP CODES (one-time use, save somewhere safe)           ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
backupCodes.forEach((code, i) => {
  console.log(`║     ${String(i + 1).padStart(2)}. ${code.padEnd(57)}║`);
});
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log('║                                                                ║');
console.log('║  🔗 OTP Auth URI (for manual import into authenticator):       ║');
console.log(`║     ${otpUri.length > 59 ? otpUri.substring(0, 56) + '...' : otpUri.padEnd(59)}║`);
console.log('║                                                                ║');
console.log('║  Full URI:                                                     ║');
console.log(`║  ${otpUri}`);
console.log('║                                                                ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');

console.log('\n══════════════ Login Flow ══════════════');
console.log('  1. POST /api/v1/auth/login  { email, password }');
console.log('     → { requiresTwoFactor: true, userId: "..." }');
console.log('  2. POST /api/v1/auth/2fa/verify  { userId, code: "<6-digit TOTP>" }');
console.log('     → { accessToken, refreshToken }');
console.log('  (The frontend login screen handles this automatically)');
console.log('\nDone. ✅\n');
