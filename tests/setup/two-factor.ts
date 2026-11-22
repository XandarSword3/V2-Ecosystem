/**
 * tests/setup/two-factor.ts
 *
 * TOTP helpers for E2E accounts that MUST be enrolled in 2FA.
 *
 * The backend blocks login for privileged scopes (tenant_admin, super_admin,
 * ...) unless two_factor_enabled is true (auth.service.ts — mandatory-2FA
 * gate), and there is no scope that maps to an `admin` role without hitting
 * that gate. So the Engine A browser suites' admin fixture
 * (e2e.admin@v2ecosystem.com, scope=tenant_admin) has to actually enroll:
 *
 *   1. POST /auth/login              → 403 { requiresTwoFactorSetup, twoFactorSetupToken }
 *   2. POST /auth/2fa/setup  (Bearer setupToken) → { data.secret }
 *   3. POST /auth/2fa/enable (Bearer setupToken, { code }) → tokens + enables 2FA
 *
 * global-setup (tests/setup/global-setup.ts) runs that enrollment once and
 * stores the raw TOTP secret in tests/.2fa-e2e-admin.json (gitignored test
 * fixture — a synthetic E2E-only account, never a real credential). Login
 * helpers import this module to answer the /auth/2fa/verify challenge:
 *
 *   POST /auth/login → { requiresTwoFactor, userId } →
 *   POST /auth/2fa/verify { userId, code } → tokens
 */
import fs from 'fs';
import path from 'path';

export interface E2EAdminTwoFactor {
  email: string;
  userId: string;
  secret: string;
}

export const TWO_FACTOR_SECRET_FILE = path.resolve(__dirname, '../.2fa-e2e-admin.json');

export function loadE2EAdminTwoFactor(): E2EAdminTwoFactor | null {
  try {
    return JSON.parse(fs.readFileSync(TWO_FACTOR_SECRET_FILE, 'utf8')) as E2EAdminTwoFactor;
  } catch {
    return null;
  }
}

export function saveE2EAdminTwoFactor(record: E2EAdminTwoFactor): void {
  fs.writeFileSync(TWO_FACTOR_SECRET_FILE, JSON.stringify(record, null, 2), 'utf8');
}

/**
 * Compute the 6-digit TOTP code with EXACTLY the backend's options
 * (services/two-factor.service.ts: digits 6, period 30s, sha1; verification
 * tolerates ±30s). otplib is hoisted in backend/node_modules.
 */
export function computeTotp(secret: string): string {
  const otplib = require(path.resolve(__dirname, '../../backend/node_modules/otplib'));
  return otplib.generateSync({ secret, digits: 6, period: 30, algorithm: 'sha1' });
}
