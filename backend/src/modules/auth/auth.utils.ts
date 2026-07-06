import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index';

interface TokenPayload {
  userId:          string;
  email:           string;
  scope:           string;
  roles:           string[];
  tokenVersion?:   number;
  tenantId?:       string;
  isPlatformAdmin?: boolean;
}

function parseExpiryToSeconds(expiresIn: string | number): number {
  if (typeof expiresIn === 'number') return expiresIn;
  const match = expiresIn.match(/^(\d+)([smhd])$/i);
  if (!match) return 900;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default:  return 900;
  }
}

/**
 * Generate an access + refresh token pair.
 * Each access token gets a unique `jti` (JWT ID) so it can be individually
 * blacklisted on single-session logout (P3 fix).
 */
export function generateTokens(payload: TokenPayload): {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
  jti:          string;
} {
  const jti = uuidv4(); // unique per token — used for blacklisting
  const accessExpiresIn = parseExpiryToSeconds(config.jwt.expiresIn as string | number);
  const refreshExpiresIn = parseExpiryToSeconds(config.jwt.refreshExpiresIn as string | number);
  const tokenVersion = payload.tokenVersion ?? 0;

  const accessToken = jwt.sign(
    {
      userId:          payload.userId,
      email:           payload.email,
      scope:           payload.scope,
      roles:           payload.roles,
      tokenVersion,
      jti,
      tenantId:        payload.tenantId,
      isPlatformAdmin: payload.isPlatformAdmin ?? false,
    },
    config.jwt.secret,
    { expiresIn: accessExpiresIn },
  );

  const refreshToken = jwt.sign(
    {
      userId:       payload.userId,
      tokenVersion,
      type:         'refresh',
    },
    config.jwt.refreshSecret,
    { expiresIn: refreshExpiresIn },
  );

  return { accessToken, refreshToken, expiresIn: accessExpiresIn, jti };
}

export function verifyRefreshToken(token: string): {
  userId:       string;
  tokenVersion: number;
  type:         string;
  iat?:         number;
  exp?:         number;
} {
  const decoded = jwt.verify(token, config.jwt.refreshSecret) as {
    userId:       string;
    tokenVersion: number;
    type:         string;
    iat?:         number;
    exp?:         number;
  };

  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return decoded;
}

export function verifyToken(token: string): {
  userId:          string;
  email:           string;
  scope:           string;
  roles:           string[];
  tokenVersion?:   number;
  jti?:            string;
  iat?:            number;
  exp?:            number;
  tenantId?:       string;
  isPlatformAdmin?: boolean;
} {
  return jwt.verify(token, config.jwt.secret) as {
    userId:          string;
    email:           string;
    scope:           string;
    roles:           string[];
    tokenVersion?:   number;
    jti?:            string;
    iat?:            number;
    exp?:            number;
    tenantId?:       string;
    isPlatformAdmin?: boolean;
  };
}

/**
 * Short-lived, single-purpose token issued instead of real session tokens
 * when login() blocks a privileged account for mandatory 2FA enrollment
 * (see auth.service.ts login(), Q103). Without this, a freshly-provisioned
 * tenant_owner/admin account could never get in at all: /2fa/setup and
 * /2fa/enable normally require a real access token, but login() refuses to
 * issue one until 2FA is already enabled — a chicken-and-egg deadlock.
 *
 * This token carries a `purpose` claim specifically so the general
 * `authenticate` middleware can and does reject it outright (see
 * auth.middleware.ts) — it must never work as a substitute access token
 * anywhere except the dedicated 2FA-enrollment routes.
 */
export function generateTwoFactorSetupToken(userId: string, email: string): { token: string; expiresIn: number } {
  const expiresIn = 10 * 60; // 10 minutes — long enough to scan a QR code and enter one code
  const token = jwt.sign(
    { userId, email, purpose: 'twofa_setup' },
    config.jwt.secret,
    { expiresIn },
  );
  return { token, expiresIn };
}

export function verifyTwoFactorSetupToken(token: string): {
  userId:  string;
  email:   string;
  purpose: string;
  iat?:    number;
  exp?:    number;
} {
  const decoded = jwt.verify(token, config.jwt.secret) as {
    userId:  string;
    email:   string;
    purpose: string;
    iat?:    number;
    exp?:    number;
  };

  if (decoded.purpose !== 'twofa_setup') {
    throw new Error('Invalid token purpose');
  }

  return decoded;
}
