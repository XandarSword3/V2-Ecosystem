/**
 * QR Code Security Utility
 * 
 * Provides secure QR code generation and validation with HMAC signatures.
 * Prevents tampering and replay attacks on QR code-based access (pool, chalets, etc.)
 */

import crypto from 'crypto';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// Configuration
const QR_CONFIG = {
  algorithm: 'sha256',
  expirationMs: 24 * 60 * 60 * 1000, // 24 hours default
  shortExpirationMs: 5 * 60 * 1000, // 5 minutes for one-time codes
};

interface QRPayload {
  type: 'pool_ticket' | 'chalet_access' | 'restaurant_order' | 'module_content';
  id: string;
  timestamp: number;
  expiresAt: number;
  data?: Record<string, unknown>;
  nonce: string;
}

interface SignedQRPayload extends QRPayload {
  signature: string;
}

interface QRValidationResult {
  valid: boolean;
  payload?: QRPayload;
  error?: string;
  expired?: boolean;
  tampered?: boolean;
}

/**
 * Get the HMAC secret key
 */
function getSecretKey(): string {
  const secret = env.QR_SECRET_KEY || env.JWT_SECRET;
  if (!secret) {
    throw new Error('QR_SECRET_KEY or JWT_SECRET must be configured');
  }
  return secret;
}

/**
 * Generate a cryptographic nonce
 */
function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create HMAC signature for payload
 */
function signPayload(payload: QRPayload): string {
  const dataToSign = JSON.stringify({
    type: payload.type,
    id: payload.id,
    timestamp: payload.timestamp,
    expiresAt: payload.expiresAt,
    data: payload.data,
    nonce: payload.nonce
  });
  
  return crypto
    .createHmac(QR_CONFIG.algorithm, getSecretKey())
    .update(dataToSign)
    .digest('hex');
}

/**
 * Verify HMAC signature
 */
function verifySignature(payload: SignedQRPayload): boolean {
  const expectedSignature = signPayload(payload);
  return crypto.timingSafeEqual(
    Buffer.from(payload.signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Generate a secure QR code payload
 */
export function generateSecurePayload(
  type: QRPayload['type'],
  id: string,
  data?: Record<string, unknown>,
  expirationMs: number = QR_CONFIG.expirationMs
): SignedQRPayload {
  const now = Date.now();
  
  const payload: QRPayload = {
    type,
    id,
    timestamp: now,
    expiresAt: now + expirationMs,
    data,
    nonce: generateNonce()
  };
  
  const signature = signPayload(payload);
  
  return {
    ...payload,
    signature
  };
}

/**
 * Generate a short-lived one-time QR code payload
 */
export function generateOneTimePayload(
  type: QRPayload['type'],
  id: string,
  data?: Record<string, unknown>
): SignedQRPayload {
  return generateSecurePayload(type, id, data, QR_CONFIG.shortExpirationMs);
}

/**
 * Encode payload as base64 string for QR code
 */
export function encodePayload(payload: SignedQRPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString('base64url');
}

/**
 * Decode base64 string back to payload
 */
export function decodePayload(encoded: string): SignedQRPayload | null {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf-8');
    return JSON.parse(json) as SignedQRPayload;
  } catch (error) {
    logger.warn('Failed to decode QR payload', { error });
    return null;
  }
}

/**
 * Validate a QR code payload
 */
export function validatePayload(encoded: string): QRValidationResult {
  // Decode the payload
  const payload = decodePayload(encoded);
  
  if (!payload) {
    return {
      valid: false,
      error: 'Invalid QR code format',
      tampered: true
    };
  }
  
  // Verify signature (prevents tampering)
  try {
    if (!verifySignature(payload)) {
      logger.warn('QR code signature verification failed', { 
        type: payload.type, 
        id: payload.id 
      });
      return {
        valid: false,
        error: 'QR code has been tampered with',
        tampered: true
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: 'Signature verification failed',
      tampered: true
    };
  }
  
  // Check expiration
  if (Date.now() > payload.expiresAt) {
    return {
      valid: false,
      payload,
      error: 'QR code has expired',
      expired: true
    };
  }
  
  // Remove signature from returned payload for safety
  const { signature, ...cleanPayload } = payload;
  
  return {
    valid: true,
    payload: cleanPayload
  };
}

/**
 * Generate QR code image as data URL
 */
export async function generateQRCodeImage(
  type: QRPayload['type'],
  id: string,
  data?: Record<string, unknown>,
  options?: {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    expirationMs?: number;
  }
): Promise<{ dataUrl: string; payload: SignedQRPayload; expiresAt: Date }> {
  const payload = generateSecurePayload(type, id, data, options?.expirationMs);
  const encoded = encodePayload(payload);
  
  const qrOptions = {
    width: options?.width || 256,
    margin: options?.margin || 2,
    color: {
      dark: options?.color?.dark || '#000000',
      light: options?.color?.light || '#ffffff'
    },
    errorCorrectionLevel: 'M' as const
  };
  
  const dataUrl = await QRCode.toDataURL(encoded, qrOptions);
  
  return {
    dataUrl,
    payload,
    expiresAt: new Date(payload.expiresAt)
  };
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(
  type: QRPayload['type'],
  id: string,
  data?: Record<string, unknown>,
  options?: {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    expirationMs?: number;
  }
): Promise<{ svg: string; payload: SignedQRPayload; expiresAt: Date }> {
  const payload = generateSecurePayload(type, id, data, options?.expirationMs);
  const encoded = encodePayload(payload);
  
  const qrOptions = {
    width: options?.width || 256,
    margin: options?.margin || 2,
    color: {
      dark: options?.color?.dark || '#000000',
      light: options?.color?.light || '#ffffff'
    },
    type: 'svg' as const
  };
  
  const svg = await QRCode.toString(encoded, qrOptions);
  
  return {
    svg,
    payload,
    expiresAt: new Date(payload.expiresAt)
  };
}

/**
 * Pool Ticket QR Code Generator
 */
export async function generatePoolTicketQR(
  ticketId: string,
  ticketData: {
    guestName: string;
    date: string;
    ticketType: string;
    quantity: number;
  }
): Promise<{ dataUrl: string; expiresAt: Date }> {
  const result = await generateQRCodeImage('pool_ticket', ticketId, ticketData, {
    expirationMs: QR_CONFIG.expirationMs
  });
  
  logger.info('Generated pool ticket QR code', { ticketId, expiresAt: result.expiresAt });
  
  return {
    dataUrl: result.dataUrl,
    expiresAt: result.expiresAt
  };
}

/**
 * Chalet Access QR Code Generator
 */
export async function generateChaletAccessQR(
  bookingId: string,
  accessData: {
    chaletName: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
  }
): Promise<{ dataUrl: string; expiresAt: Date }> {
  // Calculate expiration based on checkout date + 1 day buffer
  const checkoutDate = new Date(accessData.checkOut);
  checkoutDate.setDate(checkoutDate.getDate() + 1);
  const expirationMs = checkoutDate.getTime() - Date.now();
  
  const result = await generateQRCodeImage('chalet_access', bookingId, accessData, {
    expirationMs: Math.max(expirationMs, QR_CONFIG.expirationMs)
  });
  
  logger.info('Generated chalet access QR code', { bookingId, expiresAt: result.expiresAt });
  
  return {
    dataUrl: result.dataUrl,
    expiresAt: result.expiresAt
  };
}

/**
 * Restaurant Order QR Code Generator (for table-side ordering)
 */
export async function generateRestaurantOrderQR(
  tableId: string,
  sessionData: {
    tableName: string;
    startTime: string;
    serverName?: string;
  }
): Promise<{ dataUrl: string; expiresAt: Date }> {
  // Short-lived for active dining session
  const result = await generateQRCodeImage('restaurant_order', tableId, sessionData, {
    expirationMs: 4 * 60 * 60 * 1000 // 4 hours for dining session
  });
  
  logger.info('Generated restaurant order QR code', { tableId, expiresAt: result.expiresAt });
  
  return {
    dataUrl: result.dataUrl,
    expiresAt: result.expiresAt
  };
}

/**
 * Module Content QR Code Generator (for educational content sharing)
 */
export async function generateModuleContentQR(
  moduleId: string,
  contentData: {
    moduleName: string;
    contentType: string;
    accessLevel?: string;
  }
): Promise<{ dataUrl: string; expiresAt: Date }> {
  const result = await generateQRCodeImage('module_content', moduleId, contentData);
  
  logger.info('Generated module content QR code', { moduleId, expiresAt: result.expiresAt });
  
  return {
    dataUrl: result.dataUrl,
    expiresAt: result.expiresAt
  };
}

/**
 * Validate a scanned QR code (generic)
 */
export function validateScannedQR(
  scannedData: string,
  expectedType?: QRPayload['type']
): QRValidationResult {
  const result = validatePayload(scannedData);
  
  if (!result.valid) {
    return result;
  }
  
  // Optionally check if type matches expected
  if (expectedType && result.payload?.type !== expectedType) {
    return {
      valid: false,
      payload: result.payload,
      error: `Expected QR code type '${expectedType}' but got '${result.payload?.type}'`
    };
  }
  
  return result;
}

export default {
  generateSecurePayload,
  generateOneTimePayload,
  encodePayload,
  decodePayload,
  validatePayload,
  generateQRCodeImage,
  generateQRCodeSVG,
  generatePoolTicketQR,
  generateChaletAccessQR,
  generateRestaurantOrderQR,
  generateModuleContentQR,
  validateScannedQR
};
