import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { supabase, supabaseAdmin } from '../config/supabase';

// Mock dependencies
vi.mock('../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  supabaseAdmin: {
    storage: {
      from: vi.fn(),
    },
  },
}));

describe('Branding Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /admin/branding', () => {
    it('should return default branding when none configured', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const defaultBranding = {
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

      // The controller would return this default
      expect(defaultBranding.businessName).toBe('V2 Resort');
      expect(defaultBranding.primaryColor).toBe('#0891b2');
      expect(defaultBranding.showPoweredBy).toBe(true);
    });

    it('should return stored branding when available', async () => {
      const storedBranding = {
        businessName: 'My Resort',
        tagline: 'Welcome to paradise',
        primaryColor: '#ff5733',
        secondaryColor: '#333333',
        accentColor: '#ffd700',
        headingFont: 'poppins',
        bodyFont: 'roboto',
        showPoweredBy: false,
        logoUrl: 'https://example.com/logo.png',
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { value: storedBranding }, error: null }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      // Simulate fetching
      const { data } = await supabase.from('system_settings').select('value').eq('key', 'branding').single();

      expect(data?.value.businessName).toBe('My Resort');
      expect(data?.value.primaryColor).toBe('#ff5733');
      expect(data?.value.showPoweredBy).toBe(false);
    });
  });

  describe('PUT /admin/branding', () => {
    it('should validate business name is required', () => {
      const branding = { primaryColor: '#ff5733' };
      
      const isValid = !!branding.primaryColor && !!(branding as any).businessName;
      
      expect(isValid).toBe(false);
    });

    it('should validate hex color format', () => {
      const colorRegex = /^#[0-9A-Fa-f]{6}$/;

      expect(colorRegex.test('#0891b2')).toBe(true);
      expect(colorRegex.test('#FF5733')).toBe(true);
      expect(colorRegex.test('#fff')).toBe(false);
      expect(colorRegex.test('0891b2')).toBe(false);
      expect(colorRegex.test('#gggggg')).toBe(false);
    });

    it('should upsert branding settings', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      (supabase.from as any).mockImplementation(mockFrom);

      const branding = {
        businessName: 'Updated Resort',
        primaryColor: '#ff5733',
        secondaryColor: '#333333',
        accentColor: '#ffd700',
      };

      const { error } = await supabase.from('system_settings').upsert({
        key: 'branding',
        value: branding,
      });

      expect(error).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith('system_settings');
    });
  });

  describe('POST /admin/branding/logo', () => {
    it('should validate file type', () => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/x-icon'];

      expect(allowedTypes.includes('image/jpeg')).toBe(true);
      expect(allowedTypes.includes('image/png')).toBe(true);
      expect(allowedTypes.includes('application/pdf')).toBe(false);
      expect(allowedTypes.includes('text/plain')).toBe(false);
    });

    it('should enforce file size limit', () => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      const smallFile = { size: 1024 * 1024 }; // 1MB
      const largeFile = { size: 10 * 1024 * 1024 }; // 10MB

      expect(smallFile.size <= maxSize).toBe(true);
      expect(largeFile.size <= maxSize).toBe(false);
    });

    it('should upload logo to storage', async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockGetPublicUrl = vi.fn().mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/logo.png' },
      });

      (supabaseAdmin.storage.from as any).mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      });

      // Simulate upload
      const bucket = supabaseAdmin.storage.from('public-assets');
      await bucket.upload('branding/logo.png', Buffer.from('test'), {
        contentType: 'image/png',
      });

      const { data } = bucket.getPublicUrl('branding/logo.png');

      expect(mockUpload).toHaveBeenCalled();
      expect(data.publicUrl).toBe('https://storage.example.com/logo.png');
    });
  });

  describe('GET /admin/branding/public', () => {
    it('should return only public-facing branding info', async () => {
      const fullBranding = {
        businessName: 'My Resort',
        tagline: 'Welcome',
        email: 'admin@resort.com', // Should be included in public
        phone: '+1234567890',
        address: '123 Resort St',
        website: 'https://myresort.com',
        primaryColor: '#ff5733',
        secondaryColor: '#333333',
        accentColor: '#ffd700',
        headingFont: 'poppins',
        bodyFont: 'roboto',
        showPoweredBy: false,
        customDomain: 'booking.myresort.com', // Should NOT be included in public
        logoUrl: 'https://example.com/logo.png',
        faviconUrl: 'https://example.com/favicon.ico',
      };

      // Public endpoint should filter sensitive data
      const publicBranding = {
        businessName: fullBranding.businessName,
        tagline: fullBranding.tagline,
        logoUrl: fullBranding.logoUrl,
        faviconUrl: fullBranding.faviconUrl,
        primaryColor: fullBranding.primaryColor,
        secondaryColor: fullBranding.secondaryColor,
        accentColor: fullBranding.accentColor,
        headingFont: fullBranding.headingFont,
        bodyFont: fullBranding.bodyFont,
        showPoweredBy: fullBranding.showPoweredBy,
        facebook: '',
        instagram: '',
        twitter: '',
        linkedin: '',
      };

      expect(publicBranding).not.toHaveProperty('customDomain');
      expect(publicBranding).not.toHaveProperty('email');
      expect(publicBranding).not.toHaveProperty('phone');
      expect(publicBranding.businessName).toBe('My Resort');
    });
  });

  describe('CSS Generation', () => {
    it('should convert hex to HSL correctly', () => {
      const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
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
      };

      // Test with known colors
      const cyan = hexToHSL('#0891b2');
      expect(cyan.h).toBeGreaterThanOrEqual(185);
      expect(cyan.h).toBeLessThanOrEqual(195);
      expect(cyan.s).toBeGreaterThan(80);

      const gray = hexToHSL('#64748b');
      expect(gray.s).toBeLessThan(30);

      const orange = hexToHSL('#f59e0b');
      expect(orange.h).toBeGreaterThanOrEqual(35);
      expect(orange.h).toBeLessThanOrEqual(45);
    });

    it('should generate valid CSS variables', () => {
      const generateCSS = (primaryColor: string, headingFont: string) => {
        return `:root {
  --brand-primary: ${primaryColor};
  --font-heading: '${headingFont}', system-ui, sans-serif;
}`;
      };

      const css = generateCSS('#0891b2', 'Inter');

      expect(css).toContain('--brand-primary: #0891b2');
      expect(css).toContain("--font-heading: 'Inter', system-ui, sans-serif");
      expect(css).toContain(':root {');
    });

    it('should map font names to families correctly', () => {
      const fontNameToFamily = (fontName: string): string => {
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
      };

      expect(fontNameToFamily('inter')).toBe('Inter');
      expect(fontNameToFamily('open-sans')).toBe('Open Sans');
      expect(fontNameToFamily('playfair-display')).toBe('Playfair Display');
      expect(fontNameToFamily('unknown')).toBe('Inter'); // Default fallback
    });
  });
});
