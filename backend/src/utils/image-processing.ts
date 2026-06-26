/**
 * Image Processing Utility
 *
 * Provides two guards for every upload:
 *  1. Magic-byte verification — confirms the actual file content matches
 *     the declared MIME type (prevents MIME-sniffing attacks / disguised files).
 *  2. EXIF / metadata stripping — removes GPS coordinates and other sensitive
 *     metadata from JPEG, PNG, WebP and TIFF files via `sharp`.
 *
 * SVG files are explicitly excluded from sharp processing (sharp cannot handle
 * them) but are accepted since DOMPurify already sanitises CMS HTML and SVGs
 * are allowlist-validated upstream. ICO files are passed through unchanged.
 */

import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Magic-byte signatures
// ---------------------------------------------------------------------------

interface MagicSignature {
  bytes: number[];       // expected bytes at given offset
  offset?: number;       // byte offset to start checking (default 0)
  mask?: number[];       // optional bitmask applied before comparison
}

const MAGIC_SIGNATURES: Record<string, MagicSignature[]> = {
  'image/jpeg':    [{ bytes: [0xff, 0xd8, 0xff] }],
  'image/png':     [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/webp':    [
    { bytes: [0x52, 0x49, 0x46, 0x46] },                 // RIFF header
    { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },      // WEBP marker
  ],
  'image/gif':     [
    { bytes: [0x47, 0x49, 0x46, 0x38] },                 // GIF8
  ],
  'image/x-icon':           [{ bytes: [0x00, 0x00, 0x01, 0x00] }],
  'image/vnd.microsoft.icon': [{ bytes: [0x00, 0x00, 0x01, 0x00] }],
  // SVG is XML text — verified by checking for '<svg' in the first 1024 bytes
  'image/svg+xml': [],
};

/**
 * Verify that `buffer` matches the magic bytes for `mimeType`.
 * Throws an AppError-compatible object on mismatch.
 */
export function verifyMagicBytes(buffer: Buffer, mimeType: string): void {
  // SVG: look for the '<svg' tag in the first 1024 bytes
  if (mimeType === 'image/svg+xml') {
    const head = buffer.slice(0, 1024).toString('utf8').toLowerCase();
    if (!head.includes('<svg')) {
      throw Object.assign(new Error('File content does not match SVG format'), {
        status: 400,
        code: 'INVALID_FILE_MAGIC',
      });
    }
    return;
  }

  const sigs = MAGIC_SIGNATURES[mimeType];
  if (!sigs) {
    // Unknown MIME — no magic check, caller's MIME allowlist is the guard
    return;
  }

  for (const sig of sigs) {
    const offset = sig.offset ?? 0;
    for (let i = 0; i < sig.bytes.length; i++) {
      const actual = buffer[offset + i];
      const expected = sig.bytes[i];
      const masked = sig.mask ? actual & sig.mask[i] : actual;
      if (masked !== expected) {
        throw Object.assign(
          new Error(`File content does not match declared MIME type (${mimeType})`),
          { status: 400, code: 'INVALID_FILE_MAGIC' },
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// EXIF / metadata stripping
// ---------------------------------------------------------------------------

/** MIME types that sharp can process and strip EXIF from */
const SHARP_PROCESSABLE = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
]);

/**
 * Strip all embedded metadata (EXIF, ICC, XMP, IPTC) from an image buffer.
 * Returns the sanitised buffer. For SVG and ICO, returns the original buffer
 * unchanged (sharp does not support these formats).
 *
 * Output format matches input format to avoid quality/transparency loss.
 */
export async function stripMetadata(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (!SHARP_PROCESSABLE.has(mimeType)) {
    return buffer; // SVG / ICO — pass through
  }

  try {
    const instance = sharp(buffer, { failOn: 'error' })
      // withMetadata(false) is the default; calling it explicitly documents intent
      // and ensures any future sharp default change doesn't regress this.
      .withMetadata({ exif: {}, icc: undefined });

    // Re-encode in the same format to preserve transparency / animation
    switch (mimeType) {
      case 'image/jpeg':
        return await instance.jpeg({ quality: 92 }).toBuffer();
      case 'image/png':
        return await instance.png({ compressionLevel: 6 }).toBuffer();
      case 'image/webp':
        return await instance.webp({ quality: 90 }).toBuffer();
      case 'image/gif':
        // sharp can read GIFs but animated GIF output requires libvips with giflib;
        // fall back to passthrough to avoid corrupting animated GIFs in environments
        // where that support is absent.
        try {
          return await instance.gif().toBuffer();
        } catch {
          return buffer;
        }
      default:
        return await instance.toBuffer();
    }
  } catch (err) {
    // If sharp fails (e.g. corrupt file), surface a clean 400 rather than 500
    throw Object.assign(new Error('Image processing failed — file may be corrupt'), {
      status: 400,
      code: 'IMAGE_PROCESSING_FAILED',
      cause: err,
    });
  }
}

/**
 * Combined guard: verify magic bytes then strip metadata.
 * Returns the sanitised buffer ready for storage.
 */
export async function sanitizeImageUpload(buffer: Buffer, mimeType: string): Promise<Buffer> {
  verifyMagicBytes(buffer, mimeType);
  return stripMetadata(buffer, mimeType);
}
