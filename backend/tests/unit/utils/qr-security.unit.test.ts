import { describe, it, expect, vi } from 'vitest';
import {
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
  validateScannedQR,
} from '../../../src/utils/qr-security.js';

describe('QR Security Utilities (Unit Tests)', () => {
  it('should generate a valid signed QR payload and verify successfully', () => {
    const signed = generateSecurePayload('instant_transaction', 'order-123', { amount: 50 });
    expect(signed.type).toBe('instant_transaction');
    expect(signed.id).toBe('order-123');
    expect(signed.signature).toBeDefined();

    const encoded = encodePayload(signed);
    expect(typeof encoded).toBe('string');

    const decoded = decodePayload(encoded);
    expect(decoded?.id).toBe('order-123');

    const validation = validatePayload(encoded);
    expect(validation.valid).toBe(true);
    expect(validation.payload?.id).toBe('order-123');
  });

  it('should reject tampered payload signature', () => {
    const signed = generateSecurePayload('shared_capacity_access', 'ticket-456');
    const encoded = encodePayload(signed);

    // Tamper with payload
    const decoded = decodePayload(encoded)!;
    decoded.id = 'ticket-tampered';
    const tamperedEncoded = encodePayload(decoded);

    const validation = validatePayload(tamperedEncoded);
    expect(validation.valid).toBe(false);
    expect(validation.tampered).toBe(true);
    expect(validation.error).toBe('QR code has been tampered with');
  });

  it('should detect expired QR code payloads', () => {
    // Generate payload expired 10 seconds ago
    const signed = generateSecurePayload('shared_capacity_access', 'ticket-789', {}, -10000);
    const encoded = encodePayload(signed);

    const validation = validatePayload(encoded);
    expect(validation.valid).toBe(false);
    expect(validation.expired).toBe(true);
    expect(validation.error).toBe('QR code has expired');
  });

  it('should handle corrupt or invalid base64 payloads gracefully', () => {
    const validation = validatePayload('not_a_valid_json_payload');
    expect(validation.valid).toBe(false);
    expect(validation.tampered).toBe(true);
    expect(validation.error).toBe('Invalid QR code format');
  });

  it('should validate scanned QR and enforce expected type', () => {
    const signed = generateSecurePayload('instant_transaction', 'order-999');
    const encoded = encodePayload(signed);

    // Matches expected type
    const matchValidation = validateScannedQR(encoded, 'instant_transaction');
    expect(matchValidation.valid).toBe(true);

    // Mismatched expected type
    const mismatchValidation = validateScannedQR(encoded, 'pool_ticket');
    expect(mismatchValidation.valid).toBe(false);
    expect(mismatchValidation.error).toContain("Expected QR code type 'pool_ticket' but got 'instant_transaction'");
  });

  it('should generate QR code images and SVG representations', async () => {
    const qrImage = await generateQRCodeImage('instant_transaction', 'order-img-1');
    expect(qrImage.dataUrl).toContain('data:image/png;base64,');
    expect(qrImage.expiresAt).toBeInstanceOf(Date);

    const qrSvg = await generateQRCodeSVG('instant_transaction', 'order-svg-1');
    expect(qrSvg.svg).toContain('<svg');
  });

  it('should generate domain-specific QR codes (pool tickets, chalet access, dining orders)', async () => {
    const poolTicket = await generatePoolTicketQR('ticket-p1', {
      guestName: 'Alice',
      date: '2026-11-04',
      ticketType: 'all_day',
      quantity: 2,
    });
    expect(poolTicket.dataUrl).toContain('data:image/png;base64,');

    const chaletAccess = await generateChaletAccessQR('booking-c1', {
      chaletName: 'Alpine Villa 1',
      guestName: 'Bob',
      checkIn: '2026-11-04T14:00:00Z',
      checkOut: '2026-11-06T11:00:00Z',
    });
    expect(chaletAccess.dataUrl).toBeDefined();

    const diningOrder = await generateRestaurantOrderQR('table-5', {
      tableName: 'Table 5 Patio',
      startTime: '2026-11-04T12:00:00Z',
    });
    expect(diningOrder.dataUrl).toBeDefined();

    const moduleContent = await generateModuleContentQR('mod-science', {
      moduleName: 'Planetarium Exhibit',
      contentType: 'audio_guide',
    });
    expect(moduleContent.dataUrl).toBeDefined();
  });
});
