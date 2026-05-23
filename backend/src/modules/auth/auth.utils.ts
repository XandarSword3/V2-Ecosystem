import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';

interface TokenPayload {
  userId:       string;
  email:        string;
  roles:        string[];
  tokenVersion?: number;
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
      userId:       payload.userId,
      email:        payload.email,
      roles:        payload.roles,
      tokenVersion,
      jti,
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
  userId:       string;
  email:        string;
  roles:        string[];
  tokenVersion?: number;
  jti?:         string;
  iat?:         number;
  exp?:         number;
} {
  return jwt.verify(token, config.jwt.secret) as {
    userId:       string;
    email:        string;
    roles:        string[];
    tokenVersion?: number;
    jti?:         string;
    iat?:         number;
    exp?:         number;
  };
}
