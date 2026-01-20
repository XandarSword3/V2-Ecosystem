import jwt from 'jsonwebtoken';
import { config } from "../../config/index";

interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  tokenVersion?: number;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // default 15 minutes
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: return 900;
  }
}

export function generateTokens(payload: TokenPayload): GeneratedTokens {
  // JWT v9 requires expiresIn to be a number (seconds)
  const accessExpiresIn = parseExpiryToSeconds(config.jwt.expiresIn);
  const refreshExpiresIn = parseExpiryToSeconds(config.jwt.refreshExpiresIn);

  const accessToken = jwt.sign(
    { 
      userId: payload.userId, 
      email: payload.email, 
      roles: payload.roles,
      tokenVersion: payload.tokenVersion ?? 0
    },
    config.jwt.secret,
    { expiresIn: accessExpiresIn }
  );

  // Use separate secret for refresh tokens for better security
  const refreshToken = jwt.sign(
    { userId: payload.userId, type: 'refresh', tokenVersion: payload.tokenVersion ?? 0 },
    config.jwt.refreshSecret,
    { expiresIn: refreshExpiresIn }
  );

  return { accessToken, refreshToken, expiresIn: accessExpiresIn };
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
  return decoded;
}

export function verifyRefreshToken(token: string): { userId: string; tokenVersion?: number } {
  // Use separate secret for refresh tokens
  const decoded = jwt.verify(token, config.jwt.refreshSecret) as { userId: string; type: string; tokenVersion?: number };
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return { userId: decoded.userId, tokenVersion: decoded.tokenVersion };
}
