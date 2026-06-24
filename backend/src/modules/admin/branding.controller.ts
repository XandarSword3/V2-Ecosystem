/**
 * Branding Controller — Section-based PATCH with JSONB merging
 *
 * Branding is scoped to a property (via property_settings table).
 * Each logical section (colors, fonts, identity, social, navbar, hero, footer)
 * is stored as its own row keyed by  property_id + 'branding.<section>'.
 *
 * PATCH /branding/:section deep-merges only the changed fields into the
 * existing section value — no full-blob overwrites, no race conditions
 * between concurrent editors working on different sections.
 *
 * GET /branding assembles all sections into a single response object.
 *
 * NOTE: authenticate and validatePropertyAccess are already applied by
 * admin.routes.ts at the router level — not re-applied here.
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authorize } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// ── Section registry ──────────────────────────────────────────────────

const BRANDING_SECTIONS = [
  'identity', 'colors', 'fonts', 'style', 'social',
  'navbar', 'hero', 'footer',
] as const;
type BrandingSection = typeof BRANDING_SECTIONS[number];

function sectionKey(section: string): string {
  return `branding.${section}`;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Resolve property ID from the request. Throws if missing. */
function requirePropertyId(req: Request): string {
  const id = (req as any).propertyId || req.property?.id;
  if (!id) {
    throw new AppError(
      'Property context required. Send x-property-id header or ensure property resolution middleware ran.',
      400,
    );
  }
  return id;
}

/**
 * Recursively deep-merge `source` into `target`.
 * Arrays and primitives in source overwrite target; objects merge recursively.
 */
function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (
      sv && typeof sv === 'object' && !Array.isArray(sv) &&
      tv && typeof tv === 'object' && !Array.isArray(tv)
    ) {
      result[key] = deepMerge(tv, sv);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

// ── Section validation ───────────────────────────────────────────────

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const ALLOWED_FONTS = new Set([
  'inter', 'roboto', 'open-sans', 'lato', 'poppins',
  'montserrat', 'playfair-display', 'merriweather',
  'lora', 'nunito', 'raleway', 'dm-sans', 'system-ui',
]);

function validateSection(section: BrandingSection, body: Record<string, any>): void {
  switch (section) {
    case 'colors': {
      for (const [key, val] of Object.entries(body)) {
        if (typeof val === 'string' && !HEX_COLOR.test(val)) {
          throw new AppError(
            `Invalid hex color for "${key}": "${val}". Expected format: #0891b2`,
            400,
          );
        }
      }
      break;
    }
    case 'fonts': {
      for (const [key, val] of Object.entries(body)) {
        if (['headingFont', 'bodyFont'].includes(key) && typeof val === 'string') {
          const normalizedVal = val.toLowerCase().replace(/\s+/g, '-');
          if (!ALLOWED_FONTS.has(normalizedVal)) {
            throw new AppError(
              `Unknown font "${val}" for "${key}". Allowed: ${[...ALLOWED_FONTS].join(', ')}`,
              400,
            );
          }
        }
      }
      break;
    }
    case 'identity': {
      if ('businessName' in body && (typeof body.businessName !== 'string' || body.businessName.trim() === '')) {
        throw new AppError('businessName must be a non-empty string', 400);
      }
      break;
    }
    // navbar, hero, footer, social: open schema — no strict validation yet
  }
}

// ── Multer for logo / favicon uploads ────────────────────────────────

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/x-icon'];
    cb(null, allowed.includes(file.mimetype) ? true : false);
  },
});

// ── CSS generation helpers ───────────────────────────────────────────

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { h: 0, s: 0, l: 0 };
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const FONT_MAP: Record<string, string> = {
  'inter': 'Inter', 'roboto': 'Roboto', 'open-sans': 'Open Sans',
  'lato': 'Lato', 'poppins': 'Poppins', 'montserrat': 'Montserrat',
  'playfair-display': 'Playfair Display', 'merriweather': 'Merriweather',
  'lora': 'Lora', 'nunito': 'Nunito', 'raleway': 'Raleway',
  'dm-sans': 'DM Sans', 'system-ui': 'system-ui',
};

/**
 * Regenerate the CSS custom-properties string from the current colors + fonts
 * sections and persist it to property_settings as `branding.css`.
 */
async function regenerateBrandingCSS(propertyId: string): Promise<void> {
  try {
    const { resolveSettings, setPropertySetting } = await import(
      '../multi-property/settings-resolution.service.js'
    );
    const resolved = await resolveSettings(propertyId, [
      sectionKey('colors'),
      sectionKey('fonts'),
    ]);
    const colors = (resolved[sectionKey('colors')]?.value as Record<string, string>) || {};
    const fonts  = (resolved[sectionKey('fonts')]?.value as Record<string, string>) || {};

    const primary   = colors.primaryColor   || '#0891b2';
    const secondary = colors.secondaryColor || '#64748b';
    const accent    = colors.accentColor    || '#f59e0b';
    const heading   = (fonts.headingFont    || 'inter').toLowerCase().replace(/\s+/g, '-');
    const body      = (fonts.bodyFont       || 'inter').toLowerCase().replace(/\s+/g, '-');

    const ph = hexToHSL(primary), sh = hexToHSL(secondary), ah = hexToHSL(accent);

    const css = `:root {
  --brand-primary: ${primary};
  --brand-secondary: ${secondary};
  --brand-accent: ${accent};
  --brand-primary-h: ${ph.h}; --brand-primary-s: ${ph.s}%; --brand-primary-l: ${ph.l}%;
  --brand-secondary-h: ${sh.h}; --brand-secondary-s: ${sh.s}%; --brand-secondary-l: ${sh.l}%;
  --brand-accent-h: ${ah.h}; --brand-accent-s: ${ah.s}%; --brand-accent-l: ${ah.l}%;
  --font-heading: '${FONT_MAP[heading] || 'Inter'}', system-ui, sans-serif;
  --font-body: '${FONT_MAP[body] || 'Inter'}', system-ui, sans-serif;
}`;

    await setPropertySetting(propertyId, sectionKey('css'), { css }, 'branding');
  } catch (err) {
    logger.error('Failed to regenerate branding CSS', { propertyId, err });
  }
}

// ══════════════════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════════════════

/**
 * GET /branding
 * Assemble all branding sections into a single response for the admin UI.
 */
router.get(
  '/',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const propertyId = requirePropertyId(req);
    const { resolveSettings } = await import(
      '../multi-property/settings-resolution.service.js'
    );

    const keys = BRANDING_SECTIONS.map(s => sectionKey(s));
    const resolved = await resolveSettings(propertyId, keys);

    const branding: Record<string, any> = {};
    for (const section of BRANDING_SECTIONS) {
      branding[section] = resolved[sectionKey(section)]?.value ?? {};
    }

    res.json({ success: true, data: branding });
  }),
);

/**
 * PATCH /branding/:section
 * Deep-merge incoming fields into one section. Only provided fields change.
 */
router.patch(
  '/:section',
  authorize('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const section = req.params.section as BrandingSection;
    if (!(BRANDING_SECTIONS as readonly string[]).includes(section)) {
      throw new AppError(
        `Unknown branding section "${section}". Valid: ${BRANDING_SECTIONS.join(', ')}`,
        400,
      );
    }

    const propertyId = requirePropertyId(req);
    const userId = req.user?.id;
    const incoming = req.body;

    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming) || Object.keys(incoming).length === 0) {
      throw new AppError('Request body must be a non-empty JSON object', 400);
    }

    validateSection(section, incoming);

    const key = sectionKey(section);
    const { resolveSetting, setPropertySetting } = await import(
      '../multi-property/settings-resolution.service.js'
    );

    // Read → merge → write
    const current = await resolveSetting(propertyId, key, {});
    const existing =
      current.value && typeof current.value === 'object' && !Array.isArray(current.value)
        ? current.value
        : {};
    const merged = deepMerge(existing as Record<string, any>, incoming);

    await setPropertySetting(propertyId, key, merged, 'branding', userId);

    logger.info(`Branding "${section}" patched`, {
      propertyId,
      userId,
      changedKeys: Object.keys(incoming),
    });

    // Regenerate CSS when visual sections change
    if (section === 'colors' || section === 'fonts') {
      await regenerateBrandingCSS(propertyId);
    }
    
    // Emit socket event to notify frontend to refetch settings
    const { emitToAll } = await import('../../socket/index.js');
    emitToAll('settings.updated', { brandingUpdated: true });

    res.json({
      success: true,
      message: `Branding section "${section}" updated`,
      data: merged,
    });
  }),
);

/**
 * POST /branding/logo
 * Upload a logo to Supabase storage, auto-patch identity.logoUrl.
 */
router.post(
  '/logo',
  authorize('admin'),
  upload.single('logo'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const propertyId = requirePropertyId(req);

    const { getSupabaseAdmin } = await import('../../database/supabase.js');
    const admin = getSupabaseAdmin();

    const ext = path.extname(req.file.originalname);
    const fileName = `logo-${propertyId}-${Date.now()}${ext}`;
    const filePath = `branding/${propertyId}/${fileName}`;

    const { error } = await admin.storage
      .from('assets')
      .upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (error) throw new AppError('Failed to upload logo', 500);

    const url = `/api/assets/${filePath}`;

    // Auto-patch identity section
    const { resolveSetting, setPropertySetting } = await import(
      '../multi-property/settings-resolution.service.js'
    );
    const cur = await resolveSetting(propertyId, sectionKey('identity'), {});
    const existing = (cur.value && typeof cur.value === 'object') ? cur.value : {};
    await setPropertySetting(
      propertyId,
      sectionKey('identity'),
      { ...(existing as Record<string, any>), logoUrl: url },
      'branding',
      req.user?.id,
    );

    // Emit socket event to notify frontend to refetch settings
    const { emitToAll } = await import('../../socket/index.js');
    emitToAll('settings.updated', { brandingUpdated: true });
    
    res.json({ success: true, data: { url } });
  }),
);

/**
 * POST /branding/favicon
 * Upload a favicon to Supabase storage, auto-patch identity.faviconUrl.
 */
router.post(
  '/favicon',
  authorize('admin'),
  upload.single('favicon'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const propertyId = requirePropertyId(req);

    const { getSupabaseAdmin } = await import('../../database/supabase.js');
    const admin = getSupabaseAdmin();

    const ext = path.extname(req.file.originalname);
    const fileName = `favicon-${propertyId}-${Date.now()}${ext}`;
    const filePath = `branding/${propertyId}/${fileName}`;

    const { error } = await admin.storage
      .from('assets')
      .upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
    if (error) throw new AppError('Failed to upload favicon', 500);

    const url = `/api/assets/${filePath}`;

    // Auto-patch identity section
    const { resolveSetting, setPropertySetting } = await import(
      '../multi-property/settings-resolution.service.js'
    );
    const cur = await resolveSetting(propertyId, sectionKey('identity'), {});
    const existing = (cur.value && typeof cur.value === 'object') ? cur.value : {};
    await setPropertySetting(
      propertyId,
      sectionKey('identity'),
      { ...(existing as Record<string, any>), faviconUrl: url },
      'branding',
      req.user?.id,
    );

    // Emit socket event to notify frontend to refetch settings
    const { emitToAll } = await import('../../socket/index.js');
    emitToAll('settings.updated', { brandingUpdated: true });
    
    res.json({ success: true, data: { url } });
  }),
);

/**
 * GET /branding/public
 * Unauthenticated — returns assembled branding for the resolved property.
 * Property context comes from resolveProperty middleware (not x-property-id).
 */
router.get(
  '/public',
  asyncHandler(async (req: Request, res: Response) => {
    const propertyId = req.property?.id || (req as any).propertyId;

    if (!propertyId) {
      // No property context — return sensible defaults
      return res.json({
        success: true,
        data: {
          identity: { businessName: 'V2 Ecosystem' },
          colors: { primaryColor: '#0891b2', secondaryColor: '#64748b', accentColor: '#f59e0b' },
          fonts: { headingFont: 'inter', bodyFont: 'inter' },
          social: {},
        },
      });
    }

    const { resolveSettings } = await import(
      '../multi-property/settings-resolution.service.js'
    );

    const publicSections = ['identity', 'colors', 'fonts', 'social'] as const;
    const keys = publicSections.map(s => sectionKey(s));
    const resolved = await resolveSettings(propertyId, keys);

    const branding: Record<string, any> = {};
    for (const section of publicSections) {
      branding[section] = resolved[sectionKey(section)]?.value ?? {};
    }

    res.json({ success: true, data: branding });
  }),
);

export default router;
