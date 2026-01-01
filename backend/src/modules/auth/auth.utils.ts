import jwt from 'jsonwebtoken';
import { config } from "../../config/index";

interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function generateTokens(payload: TokenPayload): GeneratedTokens {
  const accessToken = jwt.sign(
    { userId: payload.userId, email: payload.email, roles: payload.roles },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  const refreshToken = jwt.sign(
    { userId: payload.userId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  // Parse expiresIn to seconds
  const expiresIn = parseExpiry(config.jwt.expiresIn);

  return { accessToken, refreshToken, expiresIn };
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
  return decoded;
}

export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; type: string };
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return { userId: decoded.userId };
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // default 15 minutes

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 900;
  }
}
