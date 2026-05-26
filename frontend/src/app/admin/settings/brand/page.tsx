'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSiteSettings } from '@/lib/settings-context';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  ImageIcon,
  Palette,
  Type,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Save,
  Check,
  Upload,
  Loader2,
  RotateCcw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandState {
  // Logo
  logoUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  logoMaxWidth: number; // px

  // Colors  (stored under themeColors, but brand overrides live here)
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  // Typography
  fontHeading: string;
  fontBody: string;
  fontScale: 'sm' | 'md' | 'lg';
  headingTracking: 'tight' | 'normal' | 'wide';

  // Feel
  borderRadius: 'sharp' | 'rounded' | 'pill';
  density: 'compact' | 'default' | 'spacious';
  glassmorphism: 'none' | 'subtle' | 'heavy';
}

const STEPS = [
  { id: 'logo',       label: 'Logo',       icon: ImageIcon  },
  { id: 'colors',     label: 'Colors',     icon: Palette    },
  { id: 'typography', label: 'Typography', icon: Type       },
  { id: 'feel',       label: 'Feel',       icon: Sparkles   },
] as const;

type StepId = (typeof STEPS)[number]['id'];

// ─── Color math helpers ───────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
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
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generateShades(hex: string): Array<{ shade: string; color: string }> {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return [
    { shade: '50',  color: hslToHex(h, Math.min(s * 0.3, 100), 97) },
    { shade: '100', color: hslToHex(h, Math.min(s * 0.4, 100), 94) },
    { shade: '200', color: hslToHex(h, Math.min(s * 0.5, 100), 86) },
    { shade: '300', color: hslToHex(h, Math.min(s * 0.7, 100), 74) },
    { shade: '400', color: hslToHex(h, Math.min(s * 0.9, 100), 60) },
    { shade: '500', color: hex },
    { shade: '600', color: hslToHex(h, Math.min(s * 1.1, 100), Math.max(l * 0.85, 20)) },
    { shade: '700', color: hslToHex(h, Math.min(s * 1.2, 100), Math.max(l * 0.70, 15)) },
    { shade: '800', color: hslToHex(h, Math.min(s * 1.3, 100), Math.max(l * 0.55, 12)) },
    { shade: '900', color: hslToHex(h, Math.min(s * 1.4, 100), Math.max(l * 0.40, 10)) },
    { shade: '950', color: hslToHex(h, Math.min(s * 1.5, 100), Math.max(l * 0.25,  5)) },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColorInput({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-700 p-0.5 bg-transparent"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono"
          placeholder="#000000"
        />
      </div>
      {/* Shade strip */}
      <div className="mt-2 flex gap-1">
        {generateShades(value).map(({ shade, color }) => (
          <div
            key={shade}
            className="flex-1 h-5 rounded-sm"
            style={{ backgroundColor: color }}
            title={`${shade}: ${color}`}
          />
        ))}
      </div>
    </div>
  );
}

function FontSelect({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const FONTS = [
    { value: 'Inter',            label: 'Inter — clean & modern' },
    { value: 'Playfair Display', label: 'Playfair Display — elegant serif' },
    { value: 'Montserrat',       label: 'Montserrat — geometric sans' },
    { value: 'Lora',             label: 'Lora — literary serif' },
    { value: 'Nunito',           label: 'Nunito — friendly rounded' },
    { value: 'Raleway',          label: 'Raleway — thin & stylish' },
    { value: 'Merriweather',     label: 'Merriweather — reading-optimised' },
    { value: 'Poppins',          label: 'Poppins — geometric, bold' },
    { value: 'DM Sans',          label: 'DM Sans — low-contrast neutral' },
    { value: 'system-ui',        label: 'System UI — native OS default' },
  ];
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
      >
        {FONTS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <p
        className="mt-2 text-base text-slate-500 dark:text-slate-400 truncate"
        style={{ fontFamily: value === 'system-ui' ? 'system-ui' : `'${value}', sans-serif` }}
      >
        The quick brown fox jumps over the lazy dog
      </p>
    </div>
  );
}

function OptionCard<T extends string>({
  value, current, onClick, label, description, preview,
}: {
  value: T; current: T; onClick: (v: T) => void;
  label: string; description: string; preview: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      onClick={() => onClick(value)}
      className={[
        'relative flex flex-col items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
        active
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
      ].join(' ')}
    >
      {active && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <div className="w-full">{preview}</div>
      <div>
        <p className="font-semibold text-sm text-slate-900 dark:text-white">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
    </button>
  );
}

// ─── Step panels ──────────────────────────────────────────────────────────────

function LogoStep({ brand, onChange }: { brand: BrandState; onChange: (patch: Partial<BrandState>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Logo & Identity</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          URLs for your brand assets. Light logo is shown in light mode; dark logo overrides it in dark mode.
        </p>
      </div>

      {/* Logo light */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Logo (light mode)
        </label>
        <input
          type="url"
          placeholder="https://yourdomain.com/logo.svg"
          value={brand.logoUrl}
          onChange={(e) => onChange({ logoUrl: e.target.value })}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
        />
        {brand.logoUrl && (
          <div className="mt-2 p-4 rounded-lg bg-white border border-slate-100 inline-block">
            <img src={brand.logoUrl} alt="Logo preview" className="max-h-12 object-contain" style={{ maxWidth: brand.logoMaxWidth }} />
          </div>
        )}
      </div>

      {/* Logo dark */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Logo (dark mode) <span className="text-slate-400 font-normal">— optional</span>
        </label>
        <input
          type="url"
          placeholder="https://yourdomain.com/logo-white.svg"
          value={brand.logoDarkUrl}
          onChange={(e) => onChange({ logoDarkUrl: e.target.value })}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
        />
        {brand.logoDarkUrl && (
          <div className="mt-2 p-4 rounded-lg bg-slate-900 border border-slate-700 inline-block">
            <img src={brand.logoDarkUrl} alt="Dark logo preview" className="max-h-12 object-contain" style={{ maxWidth: brand.logoMaxWidth }} />
          </div>
        )}
      </div>

      {/* Favicon */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Favicon <span className="text-slate-400 font-normal">— 32×32 or 64×64 PNG/SVG</span>
        </label>
        <input
          type="url"
          placeholder="https://yourdomain.com/favicon.png"
          value={brand.faviconUrl}
          onChange={(e) => onChange({ faviconUrl: e.target.value })}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
        />
        {brand.faviconUrl && (
          <div className="mt-2 flex items-center gap-3">
            <img src={brand.faviconUrl} alt="Favicon preview" className="w-8 h-8 object-contain rounded" />
            <span className="text-xs text-slate-500">32px preview</span>
          </div>
        )}
      </div>

      {/* Logo max width */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Logo max-width — <span className="font-mono text-indigo-600">{brand.logoMaxWidth}px</span>
        </label>
        <input
          type="range"
          min={80} max={280} step={8}
          value={brand.logoMaxWidth}
          onChange={(e) => onChange({ logoMaxWidth: Number(e.target.value) })}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>80px compact</span>
          <span>280px wide</span>
        </div>
      </div>
    </div>
  );
}

function ColorsStep({ brand, onChange }: { brand: BrandState; onChange: (patch: Partial<BrandState>) => void }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Brand Colors</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          The three brand colors generate an 11-shade palette each used throughout the entire UI.
        </p>
      </div>

      <ColorInput
        label="Primary — main interactive color (buttons, links)"
        value={brand.primaryColor}
        onChange={(v) => onChange({ primaryColor: v })}
      />
      <ColorInput
        label="Secondary — supporting accent (tags, badges)"
        value={brand.secondaryColor}
        onChange={(v) => onChange({ secondaryColor: v })}
      />
      <ColorInput
        label="Accent — highlight & decorative usage"
        value={brand.accentColor}
        onChange={(v) => onChange({ accentColor: v })}
      />

      {/* Live mini preview */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live button preview</p>
        <div className="flex flex-wrap gap-3">
          <button
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold shadow"
            style={{ backgroundColor: brand.primaryColor }}
          >
            Primary action
          </button>
          <button
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold shadow"
            style={{ backgroundColor: brand.secondaryColor }}
          >
            Secondary
          </button>
          <button
            className="px-5 py-2 rounded-lg text-sm font-semibold border-2"
            style={{ color: brand.primaryColor, borderColor: brand.primaryColor }}
          >
            Outline
          </button>
          <span
            className="px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: brand.accentColor }}
          >
            Badge
          </span>
        </div>
      </div>
    </div>
  );
}

function TypographyStep({ brand, onChange }: { brand: BrandState; onChange: (patch: Partial<BrandState>) => void }) {
  const SCALE_OPTIONS: Array<{ value: BrandState['fontScale']; label: string; desc: string }> = [
    { value: 'sm', label: 'Small',   desc: 'Base 14px — dense, data-heavy UIs' },
    { value: 'md', label: 'Normal',  desc: 'Base 16px — recommended default' },
    { value: 'lg', label: 'Large',   desc: 'Base 18px — accessibility / screens' },
  ];
  const TRACKING_OPTIONS: Array<{ value: BrandState['headingTracking']; label: string; style: string }> = [
    { value: 'tight',  label: 'Tight',  style: '-0.025em' },
    { value: 'normal', label: 'Normal', style: '0em' },
    { value: 'wide',   label: 'Wide',   style: '0.05em' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Typography</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Fonts are loaded via Google Fonts at runtime.
        </p>
      </div>

      <FontSelect
        label="Heading font"
        value={brand.fontHeading}
        onChange={(v) => onChange({ fontHeading: v })}
      />
      <FontSelect
        label="Body font"
        value={brand.fontBody}
        onChange={(v) => onChange({ fontBody: v })}
      />

      {/* Scale */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Font scale</label>
        <div className="grid grid-cols-3 gap-3">
          {SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ fontScale: opt.value })}
              className={[
                'p-4 rounded-xl border-2 text-center transition-all',
                brand.fontScale === opt.value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-slate-200 dark:border-slate-700',
              ].join(' ')}
            >
              <p className="font-bold text-slate-900 dark:text-white">{opt.label}</p>
              <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Heading letter spacing */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Heading letter spacing</label>
        <div className="grid grid-cols-3 gap-3">
          {TRACKING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ headingTracking: opt.value })}
              className={[
                'p-4 rounded-xl border-2 text-center transition-all',
                brand.headingTracking === opt.value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-slate-200 dark:border-slate-700',
              ].join(' ')}
            >
              <p
                className="font-bold text-lg text-slate-900 dark:text-white"
                style={{
                  fontFamily: brand.fontHeading === 'system-ui' ? 'system-ui' : `'${brand.fontHeading}', sans-serif`,
                  letterSpacing: opt.style,
                }}
              >
                Aa
              </p>
              <p className="text-xs text-slate-500 mt-1">{opt.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeelStep({ brand, onChange }: { brand: BrandState; onChange: (patch: Partial<BrandState>) => void }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Visual Feel</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Governs corner rounding, spacing density, and the glass effect level on panels and cards.
        </p>
      </div>

      {/* Border radius */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Border radius</label>
        <div className="grid grid-cols-3 gap-3">
          <OptionCard
            value="sharp" current={brand.borderRadius} onClick={(v) => onChange({ borderRadius: v })}
            label="Sharp" description="0px — clinical / architectural"
            preview={
              <div className="w-full h-10 border-2 border-slate-400" style={{ borderRadius: 0, backgroundColor: brand.primaryColor + '22' }} />
            }
          />
          <OptionCard
            value="rounded" current={brand.borderRadius} onClick={(v) => onChange({ borderRadius: v })}
            label="Rounded" description="8px — contemporary default"
            preview={
              <div className="w-full h-10 border-2 border-slate-400" style={{ borderRadius: 8, backgroundColor: brand.primaryColor + '22' }} />
            }
          />
          <OptionCard
            value="pill" current={brand.borderRadius} onClick={(v) => onChange({ borderRadius: v })}
            label="Pill" description="9999px — soft & playful"
            preview={
              <div className="w-full h-10 border-2 border-slate-400" style={{ borderRadius: 9999, backgroundColor: brand.primaryColor + '22' }} />
            }
          />
        </div>
      </div>

      {/* Density */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Spacing density</label>
        <div className="grid grid-cols-3 gap-3">
          <OptionCard
            value="compact" current={brand.density} onClick={(v) => onChange({ density: v })}
            label="Compact" description="Less padding — more content visible"
            preview={
              <div className="flex flex-col gap-0.5 w-full">
                {[1,2,3].map(i => <div key={i} className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 w-full" />)}
              </div>
            }
          />
          <OptionCard
            value="default" current={brand.density} onClick={(v) => onChange({ density: v })}
            label="Default" description="Balanced padding — recommended"
            preview={
              <div className="flex flex-col gap-1.5 w-full">
                {[1,2,3].map(i => <div key={i} className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 w-full" />)}
              </div>
            }
          />
          <OptionCard
            value="spacious" current={brand.density} onClick={(v) => onChange({ density: v })}
            label="Spacious" description="More padding — editorial / luxury"
            preview={
              <div className="flex flex-col gap-3 w-full">
                {[1,2,3].map(i => <div key={i} className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 w-full" />)}
              </div>
            }
          />
        </div>
      </div>

      {/* Glassmorphism */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Glassmorphism level</label>
        <div className="grid grid-cols-3 gap-3">
          <OptionCard
            value="none" current={brand.glassmorphism} onClick={(v) => onChange({ glassmorphism: v })}
            label="Off" description="Solid backgrounds — fastest render"
            preview={
              <div className="w-full h-12 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600" />
            }
          />
          <OptionCard
            value="subtle" current={brand.glassmorphism} onClick={(v) => onChange({ glassmorphism: v })}
            label="Subtle" description="Light frosted glass — modern SaaS"
            preview={
              <div
                className="w-full h-12 rounded-lg border border-white/30"
                style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)' }}
              />
            }
          />
          <OptionCard
            value="heavy" current={brand.glassmorphism} onClick={(v) => onChange({ glassmorphism: v })}
            label="Heavy" description="Deep frosted glass — luxury resort"
            preview={
              <div
                className="w-full h-12 rounded-lg border border-white/20"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(24px)' }}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BrandConfigPage() {
  const { settings, refetch, loading } = useSiteSettings();
  const [step, setStep] = useState<StepId>('logo');
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const [brand, setBrand] = useState<BrandState>({
    logoUrl:         '',
    logoDarkUrl:     '',
    faviconUrl:      '',
    logoMaxWidth:    160,
    primaryColor:    '#6366f1',
    secondaryColor:  '#0ea5e9',
    accentColor:     '#f59e0b',
    fontHeading:     'Inter',
    fontBody:        'Inter',
    fontScale:       'md',
    headingTracking: 'tight',
    borderRadius:    'rounded',
    density:         'default',
    glassmorphism:   'subtle',
  });

  // Sync from backend on first load
  useEffect(() => {
    if (loading || initialized) return;
    setBrand({
      logoUrl:         (settings as any).logoUrl         || '',
      logoDarkUrl:     (settings as any).logoDarkUrl     || '',
      faviconUrl:      (settings as any).faviconUrl      || '',
      logoMaxWidth:    (settings as any).logoMaxWidth     || 160,
      primaryColor:    settings.themeColors?.primary     || '#6366f1',
      secondaryColor:  settings.themeColors?.secondary   || '#0ea5e9',
      accentColor:     settings.themeColors?.accent      || '#f59e0b',
      fontHeading:     (settings as any).fontHeading     || 'Inter',
      fontBody:        (settings as any).fontBody        || 'Inter',
      fontScale:       (settings as any).fontScale       || 'md',
      headingTracking: (settings as any).headingTracking || 'tight',
      borderRadius:    (settings as any).borderRadius    || 'rounded',
      density:         (settings as any).density         || 'default',
      glassmorphism:   (settings as any).glassmorphism   || 'subtle',
    });
    setInitialized(true);
  }, [loading, settings, initialized]);

  const patch = useCallback((p: Partial<BrandState>) => {
    setBrand((prev) => ({ ...prev, ...p }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...settings,
        // Brand identity fields
        logoUrl:         brand.logoUrl,
        logoDarkUrl:     brand.logoDarkUrl,
        faviconUrl:      brand.faviconUrl,
        logoMaxWidth:    brand.logoMaxWidth,
        fontHeading:     brand.fontHeading,
        fontBody:        brand.fontBody,
        fontScale:       brand.fontScale,
        headingTracking: brand.headingTracking,
        borderRadius:    brand.borderRadius,
        density:         brand.density,
        glassmorphism:   brand.glassmorphism,
        // Merge colors into themeColors so ThemeInjector picks them up
        themeColors: {
          ...(settings.themeColors || {}),
          primary:   brand.primaryColor,
          secondary: brand.secondaryColor,
          accent:    brand.accentColor,
        },
      };
      await api.put('/admin/settings', payload);
      await refetch();
      toast.success('Brand config saved.');
    } catch {
      toast.error('Failed to save brand config.');
    } finally {
      setIsSaving(false);
    }
  };

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const isFirst = stepIdx === 0;
  const isLast  = stepIdx === STEPS.length - 1;
  const goNext  = () => !isLast  && setStep(STEPS[stepIdx + 1].id);
  const goPrev  = () => !isFirst && setStep(STEPS[stepIdx - 1].id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Brand &amp; Identity</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Logo, colors, typography and visual feel for your property.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save all
        </button>
      </div>

      {/* Step bar */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = s.id === step;
          const done   = i < stepIdx;
          return (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors first:rounded-l-xl last:rounded-r-xl border-y border-r first:border-l',
                active ? 'bg-indigo-600 text-white border-indigo-600'
                : done  ? 'bg-slate-50 dark:bg-slate-800 text-indigo-500 border-slate-200 dark:border-slate-700'
                :         'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            {step === 'logo'       && <LogoStep       brand={brand} onChange={patch} />}
            {step === 'colors'     && <ColorsStep     brand={brand} onChange={patch} />}
            {step === 'typography' && <TypographyStep brand={brand} onChange={patch} />}
            {step === 'feel'       && <FeelStep       brand={brand} onChange={patch} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={isFirst}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <span className="text-xs text-slate-400">
          Step {stepIdx + 1} of {STEPS.length}
        </span>

        {isLast ? (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save &amp; finish
          </button>
        ) : (
          <button
            onClick={goNext}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-700 dark:hover:bg-white transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
