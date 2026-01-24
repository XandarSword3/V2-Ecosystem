import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase, getSupabaseAdmin } from '../../database/supabase';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/async-handler';
import { AppError } from '../../utils/AppError';

const supabase = getSupabase();
const supabaseAdmin = getSupabaseAdmin();
import { logger } from '../../utils/logger';

const router = Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/x-icon'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
});

// Branding settings interface
interface BrandingSettings {
  businessName: string;
  tagline?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  showPoweredBy: boolean;
  customDomain?: string;
  logoUrl?: string;
  faviconUrl?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
}

// Get branding settings
router.get(
  '/',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'branding')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new AppError('Failed to fetch branding settings', 500);
    }

    // Return defaults if not set
    const defaultBranding: BrandingSettings = {
      businessName: 'V2 Resort',
      tagline: '',
      description: '',
      email: '',
      phone: '',
      address: '',
      website: '',
      primaryColor: '#0891b2',
      secondaryColor: '#64748b',
      accentColor: '#f59e0b',
      headingFont: 'inter',
      bodyFont: 'inter',
      showPoweredBy: true,
      customDomain: '',
      logoUrl: '',
      faviconUrl: '',
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: '',
    };

    res.json({
      success: true,
      data: settings?.value || defaultBranding,
    });
  })
);

// Update branding settings
router.put(
  '/',
  authenticate,
  authorize(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const branding: BrandingSettings = req.body;
    const userId = (req as any).user.id;

    // Validate required fields
    if (!branding.businessName) {
      throw new AppError('Business name is required', 400);
    }

    // Validate colors
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!colorRegex.test(branding.primaryColor) ||
        !colorRegex.test(branding.secondaryColor) ||
        !colorRegex.test(branding.accentColor)) {
      throw new AppError('Invalid color format. Use hex colors like #0891b2', 400);
    }

    // Upsert branding settings
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'branding',
        value: branding,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      }, {
        onConflict: 'key',
      });

    if (error) {
      throw new AppError('Failed to save branding settings', 500);
    }

    // Log the change
    logger.info(`Branding settings updated by user ${userId}`);

    // Generate CSS variables file
    await generateBrandingCSS(branding);

    res.json({
      success: true,
      message: 'Branding settings saved successfully',
    });
  })
);

// Upload logo
router.post(
  '/logo',
  authenticate,
  authorize(['admin']),
  upload.single('logo'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const fileName = `logo-${uuidv4()}${path.extname(req.file.originalname)}`;
    const filePath = `branding/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('public-assets')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw new AppError('Failed to upload logo', 500);
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin
      .storage
      .from('public-assets')
      .getPublicUrl(filePath);

    res.json({
      success: true,
      data: {
        url: urlData.publicUrl,
      },
    });
  })
);

// Upload favicon
router.post(
  '/favicon',
  authenticate,
  authorize(['admin']),
  upload.single('favicon'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const fileName = `favicon-${uuidv4()}${path.extname(req.file.originalname)}`;
    const filePath = `branding/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('public-assets')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw new AppError('Failed to upload favicon', 500);
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin
      .storage
      .from('public-assets')
      .getPublicUrl(filePath);

    res.json({
      success: true,
      data: {
        url: urlData.publicUrl,
      },
    });
  })
);

// Get public branding (for frontend without auth)
router.get(
  '/public',
  asyncHandler(async (req: Request, res: Response) => {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'branding')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new AppError('Failed to fetch branding settings', 500);
    }

    // Only return public-facing branding info
    const branding = settings?.value || {};
    
    res.json({
      success: true,
      data: {
        businessName: branding.businessName || 'V2 Resort',
        tagline: branding.tagline || '',
        logoUrl: branding.logoUrl || '',
        faviconUrl: branding.faviconUrl || '',
        primaryColor: branding.primaryColor || '#0891b2',
        secondaryColor: branding.secondaryColor || '#64748b',
        accentColor: branding.accentColor || '#f59e0b',
        headingFont: branding.headingFont || 'inter',
        bodyFont: branding.bodyFont || 'inter',
        showPoweredBy: branding.showPoweredBy ?? true,
        facebook: branding.facebook || '',
        instagram: branding.instagram || '',
        twitter: branding.twitter || '',
        linkedin: branding.linkedin || '',
      },
    });
  })
);

// Helper function to generate CSS variables
async function generateBrandingCSS(branding: BrandingSettings): Promise<void> {
  const css = `:root {
  /* Brand Colors */
  --brand-primary: ${branding.primaryColor};
  --brand-secondary: ${branding.secondaryColor};
  --brand-accent: ${branding.accentColor};
  
  /* HSL versions for Tailwind */
  --brand-primary-h: ${hexToHSL(branding.primaryColor).h};
  --brand-primary-s: ${hexToHSL(branding.primaryColor).s}%;
  --brand-primary-l: ${hexToHSL(branding.primaryColor).l}%;
  
  --brand-secondary-h: ${hexToHSL(branding.secondaryColor).h};
  --brand-secondary-s: ${hexToHSL(branding.secondaryColor).s}%;
  --brand-secondary-l: ${hexToHSL(branding.secondaryColor).l}%;
  
  --brand-accent-h: ${hexToHSL(branding.accentColor).h};
  --brand-accent-s: ${hexToHSL(branding.accentColor).s}%;
  --brand-accent-l: ${hexToHSL(branding.accentColor).l}%;
  
  /* Typography */
  --font-heading: '${fontNameToFamily(branding.headingFont)}', system-ui, sans-serif;
  --font-body: '${fontNameToFamily(branding.bodyFont)}', system-ui, sans-serif;
}`;

  // Store CSS in system settings for frontend to fetch
  await supabase
    .from('system_settings')
    .upsert({
      key: 'branding_css',
      value: { css },
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'key',
    });
}

// Helper to convert hex to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Helper to convert font name to CSS family
function fontNameToFamily(fontName: string): string {
  const fontMap: Record<string, string> = {
    'inter': 'Inter',
    'roboto': 'Roboto',
    'open-sans': 'Open Sans',
    'lato': 'Lato',
    'poppins': 'Poppins',
    'montserrat': 'Montserrat',
    'playfair-display': 'Playfair Display',
    'merriweather': 'Merriweather',
  };
  return fontMap[fontName] || 'Inter';
}

export default router;
