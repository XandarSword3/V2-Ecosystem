import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';

interface TokenPayload {
  userId:       string;
  email:        string;
  roles:        string[];
  tokenVersion: number;
}

/**
 * Generate an access + refresh token pair.
 * Each access token gets a unique `jti` (JWT ID) so it can be individually
 * blacklisted on single-session logout (P3 fix).
 */
export function generateTokens(payload: TokenPayload): {
  accessToken:  string;
  refreshToken: string;
  jti:          string;
} {
  const jti = uuidv4(); // unique per token — used for blacklisting

  const accessToken = jwt.sign(
    {
      userId:       payload.userId,
      email:        payload.email,
      roles:        payload.roles,
      tokenVersion: payload.tokenVersion,
      jti,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as any },
  );

  const refreshToken = jwt.sign(
    {
      userId:       payload.userId,
      tokenVersion: payload.tokenVersion,
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn as any },
  );

  return { accessToken, refreshToken, jti };
}

export function verifyRefreshToken(token: string): {
  userId:       string;
  tokenVersion: number;
  iat?:         number;
  exp?:         number;
} {
  return jwt.verify(token, config.jwt.refreshSecret) as {
    userId:       string;
    tokenVersion: number;
    iat?:         number;
    exp?:         number;
  };
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
