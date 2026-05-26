'use client';

import { useState, useCallback, useEffect } from 'react';
import { useModuleBuilderStore } from '@/stores/module-builder-store';
import type {
  UIBlock,
  UIBlockStyle,
  BlockPosition,
  SectionBackground,
  SectionLayout,
  SectionHeight,
  HeightMode,
} from '@/types/module-builder';

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_WIDTH = 1440;

const FONT_PAIRS = [
  { heading: 'Playfair Display', body: 'Lato', label: 'Playfair / Lato' },
  { heading: 'Montserrat', body: 'Open Sans', label: 'Montserrat / Open Sans' },
  { heading: 'DM Serif Display', body: 'DM Sans', label: 'DM Serif / DM Sans' },
  { heading: 'Cormorant Garamond', body: 'Proza Libre', label: 'Cormorant / Proza' },
  { heading: 'Libre Baskerville', body: 'Source Sans 3', label: 'Baskerville / Source Sans' },
  { heading: 'Josefin Sans', body: 'Josefin Slab', label: 'Josefin Sans / Slab' },
  { heading: 'Raleway', body: 'Merriweather', label: 'Raleway / Merriweather' },
  { heading: 'Nunito', body: 'Nunito Sans', label: 'Nunito / Nunito Sans' },
  { heading: 'Bebas Neue', body: 'Roboto Flex', label: 'Bebas Neue / Roboto' },
  { heading: 'Spectral', body: 'Karla', label: 'Spectral / Karla' },
  { heading: 'Cinzel', body: 'Fauna One', label: 'Cinzel / Fauna One' },
  { heading: 'Abril Fatface', body: 'Lora', label: 'Abril Fatface / Lora' },
  { heading: 'Syne', body: 'Inter', label: 'Syne / Inter' },
  { heading: 'Fraunces', body: 'Epilogue', label: 'Fraunces / Epilogue' },
  { heading: 'Yeseva One', body: 'Josefin Sans', label: 'Yeseva / Josefin' },
  { heading: 'Unbounded', body: 'Outfit', label: 'Unbounded / Outfit' },
  { heading: 'Big Shoulders Display', body: 'Big Shoulders Text', label: 'Big Shoulders' },
  { heading: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { heading: 'Lexend Deca', body: 'Lexend', label: 'Lexend Deca / Lexend' },
  { heading: 'Libre Franklin', body: 'Libre Franklin', label: 'Libre Franklin' },
] as const;

const SHADOW_PRESETS: { label: string; value: string }[] = [
  { label: 'None', value: 'none' },
  { label: 'sm', value: '0 1px 2px 0 rgba(0,0,0,0.05)' },
  { label: 'md', value: '0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1)' },
  { label: 'lg', value: '0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -4px rgba(0,0,0,0.1)' },
  { label: 'xl', value: '0 20px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1)' },
  { label: 'Inner', value: 'inset 0 2px 4px 0 rgba(0,0,0,0.05)' },
];

const SECTION_LAYOUTS: { label: string; value: SectionLayout }[] = [
  { label: 'Full Width', value: 'full-width' },
  { label: 'Contained', value: 'contained' },
  { label: '50 / 50', value: 'split-50-50' },
  { label: '60 / 40', value: 'split-60-40' },
  { label: '40 / 60', value: 'split-40-60' },
  { label: 'Narrow', value: 'centered-narrow' },
];

const HEIGHT_MODES: HeightMode[] = ['auto', 'fixed', 'min-height', 'full-screen', 'viewport'];

const SWATCH_COLORS = [
  '#0f172a', '#1e293b', '#475569', '#94a3b8',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#4f46e5', '#a855f7', '#ec4899',
];

const GRID_TYPES = new Set(['card_grid', 'features', 'stats', 'grid']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadGoogleFont(family: string) {
  const id = `gf-${family.replace(/\s+/g, '-')}`;
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

function parseFontSize(val: string | undefined): number {
  if (!val) return 16;
  const n = parseFloat(val);
  return isNaN(n) ? 16 : n;
}

function parsePxInt(val: string | number | undefined, fallback = 0): number {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'number') return val;
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

// ─── Primitive UI components ──────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mt-4 mb-2">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <label className="text-xs text-slate-500 w-20 shrink-0 leading-7">{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Input({
  value, onChange, type = 'text', min, max, step, suffix, className = '',
}: {
  value: string | number; onChange: (v: string) => void;
  type?: string; min?: number; max?: number; step?: number;
  suffix?: string; className?: string;
}) {
  return (
    <div className="relative flex items-center">
      <input
        type={type} value={value} min={min} max={max} step={step}
        onChange={e => onChange(e.target.value)}
        className={`w-full h-7 px-2 text-xs bg-slate-50 border border-slate-200 rounded
          text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1
          focus:ring-indigo-500/30 ${className}`}
      />
      {suffix && (
        <span className="absolute right-2 text-[10px] text-slate-400 pointer-events-none">{suffix}</span>
      )}
    </div>
  );
}

function Select<T extends string>({
  value, onChange, options,
}: {
  value: T; onChange: (v: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className="w-full h-7 px-2 text-xs bg-slate-50 border border-slate-200 rounded
        text-slate-800 focus:outline-none focus:border-indigo-500"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({
  active, onClick, title, children,
}: {
  active: boolean; onClick: () => void; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      title={title} onClick={onClick}
      className={`h-7 px-2 text-xs rounded border transition-colors ${
        active
          ? 'bg-indigo-600 border-indigo-600 text-white'
          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function Slider({
  label, value, min, max, step = 1, suffix = '', onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 accent-indigo-600"
        />
        <span className="text-xs text-slate-500 w-10 text-right shrink-0">{value}{suffix}</span>
      </div>
    </Row>
  );
}

// ─── Tab: Style ───────────────────────────────────────────────────────────────

function StyleTab({ block, updateBlock }: { block: UIBlock; updateBlock: (patch: Partial<UIBlock>) => void }) {
  const bg = block.background ?? {} as Partial<SectionBackground>;
  const style = block.style ?? {};

  const patchBg = (patch: Partial<SectionBackground>) =>
    updateBlock({ background: { ...bg, ...patch } as SectionBackground });

  const patchStyle = (patch: Partial<UIBlockStyle>) =>
    updateBlock({ style: { ...style, ...patch } });

  const bgType = bg.type ?? 'color';
  // opacity: 0-1 in CSS, display as 0-100
  const opacityPct = Math.round((style.opacity ?? 1) * 100);
  const boxShadow = style.boxShadow ?? 'none';

  return (
    <div>
      {/* Background type */}
      <Divider label="Background" />
      <Row label="Type">
        <div className="flex flex-wrap gap-1">
          {(['color', 'gradient', 'image', 'video'] as const).map(t => (
            <Toggle key={t} active={bgType === t} onClick={() => patchBg({ type: t })}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Toggle>
          ))}
        </div>
      </Row>

      {bgType === 'color' && (
        <Row label="Color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bg.color ?? '#ffffff'}
              onChange={e => patchBg({ color: e.target.value })}
              className="w-7 h-7 rounded border border-slate-200 p-0.5 cursor-pointer bg-slate-50"
            />
            <Input value={bg.color ?? '#ffffff'} onChange={v => patchBg({ color: v })} />
          </div>
        </Row>
      )}

      {bgType === 'gradient' && (
        <>
          <Row label="Direction">
            <Input
              value={bg.gradient?.direction ?? 'to bottom right'}
              onChange={v => patchBg({ gradient: { ...(bg.gradient ?? { stops: ['#6366f1', '#8b5cf6'] }), direction: v } })}
            />
          </Row>
          <Row label="Stop 1">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bg.gradient?.stops?.[0] ?? '#6366f1'}
                onChange={e => patchBg({ gradient: { direction: bg.gradient?.direction ?? 'to bottom right', stops: [e.target.value, bg.gradient?.stops?.[1] ?? '#8b5cf6'] } })}
                className="w-7 h-7 rounded border border-slate-200 p-0.5 cursor-pointer bg-slate-50"
              />
              <Input
                value={bg.gradient?.stops?.[0] ?? '#6366f1'}
                onChange={v => patchBg({ gradient: { direction: bg.gradient?.direction ?? 'to bottom right', stops: [v, bg.gradient?.stops?.[1] ?? '#8b5cf6'] } })}
              />
            </div>
          </Row>
          <Row label="Stop 2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bg.gradient?.stops?.[1] ?? '#8b5cf6'}
                onChange={e => patchBg({ gradient: { direction: bg.gradient?.direction ?? 'to bottom right', stops: [bg.gradient?.stops?.[0] ?? '#6366f1', e.target.value] } })}
                className="w-7 h-7 rounded border border-slate-200 p-0.5 cursor-pointer bg-slate-50"
              />
              <Input
                value={bg.gradient?.stops?.[1] ?? '#8b5cf6'}
                onChange={v => patchBg({ gradient: { direction: bg.gradient?.direction ?? 'to bottom right', stops: [bg.gradient?.stops?.[0] ?? '#6366f1', v] } })}
              />
            </div>
          </Row>
        </>
      )}

      {(bgType === 'image' || bgType === 'video') && (
        <>
          <Row label="URL">
            <Input
              value={bgType === 'image' ? (bg.image?.url ?? '') : (bg.video?.url ?? '')}
              onChange={v => {
                if (bgType === 'image') patchBg({ image: { ...(bg.image ?? {}), url: v } });
                else patchBg({ video: { ...(bg.video ?? { muted: true, loop: true, autoplay: true }), url: v } });
              }}
            />
          </Row>
          {bgType === 'image' && (
            <Row label="Position">
              <Select
                value={(bg.image?.position ?? 'center') as string}
                onChange={v => patchBg({ image: { ...(bg.image ?? { url: '' }), position: v } })}
                options={['center', 'top', 'bottom', 'left', 'right'].map(p => ({ label: p.charAt(0).toUpperCase() + p.slice(1), value: p }))}
              />
            </Row>
          )}
          <Row label="Overlay">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bg.overlay?.color ?? '#000000'}
                onChange={e => patchBg({ overlay: { color: e.target.value, opacity: bg.overlay?.opacity ?? 0.4 } })}
                className="w-7 h-7 rounded border border-slate-200 p-0.5 cursor-pointer bg-slate-50"
              />
              <Input
                type="number" min={0} max={100}
                value={Math.round((bg.overlay?.opacity ?? 0.4) * 100)}
                onChange={v => patchBg({ overlay: { color: bg.overlay?.color ?? '#000000', opacity: Number(v) / 100 } })}
                suffix="%"
              />
            </div>
          </Row>
        </>
      )}

      {/* Background color on style (used by many blocks alongside the SectionBackground) */}
      <Divider label="Fill" />
      <Row label="Bg Color">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={style.backgroundColor ?? '#ffffff'}
            onChange={e => patchStyle({ backgroundColor: e.target.value })}
            className="w-7 h-7 rounded border border-slate-200 p-0.5 cursor-pointer bg-slate-50"
          />
          <Input value={style.backgroundColor ?? ''} onChange={v => patchStyle({ backgroundColor: v })} />
        </div>
      </Row>

      {/* Border */}
      <Divider label="Border" />
      <Row label="Radius">
        <input
          list="v2-radius-list"
          value={style.borderRadius ?? ''}
          onChange={e => patchStyle({ borderRadius: e.target.value })}
          placeholder="0"
          className="w-full h-7 px-2 text-xs bg-slate-50 border border-slate-200 rounded
            text-slate-800 focus:outline-none focus:border-indigo-500"
        />
        <datalist id="v2-radius-list">
          {['0', '4px', '8px', '12px', '16px', '24px', '9999px'].map(v => <option key={v} value={v} />)}
        </datalist>
      </Row>
      <Row label="Width">
        <Select
          value={style.borderWidth ?? '0'}
          onChange={v => patchStyle({ borderWidth: v })}
          options={[
            { label: 'None', value: '0' },
            { label: '1px', value: '1px' },
            { label: '2px', value: '2px' },
            { label: '4px', value: '4px' },
          ]}
        />
      </Row>
      {style.borderWidth && style.borderWidth !== '0' && (
        <>
          <Row label="Style">
            <Select
              value={(style.borderStyle ?? 'solid') as string}
              onChange={v => patchStyle({ borderStyle: v as UIBlockStyle['borderStyle'] })}
              options={['solid', 'dashed', 'dotted'].map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))}
            />
          </Row>
          <Row label="Color">
            <div className="flex items-center gap-2">
              <input
                type="color" value={style.borderColor ?? '#e2e8f0'}
                onChange={e => patchStyle({ borderColor: e.target.value })}
                className="w-7 h-7 rounded border border-slate-200 p-0.5 cursor-pointer bg-slate-50"
              />
              <Input value={style.borderColor ?? ''} onChange={v => patchStyle({ borderColor: v })} />
            </div>
          </Row>
        </>
      )}

      {/* Shadow */}
      <Divider label="Shadow" />
      <div className="flex flex-wrap gap-1 mb-2">
        {SHADOW_PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => patchStyle({ boxShadow: p.value })}
            className={`h-7 px-2.5 text-xs rounded border transition-colors ${
              boxShadow === p.value
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Opacity + blend */}
      <Divider label="Visibility" />
      <Slider
        label="Opacity" value={opacityPct} min={0} max={100} suffix="%"
        onChange={v => patchStyle({ opacity: v / 100 })}
      />
      {opacityPct < 100 && (
        <Row label="Blend">
          <Select
            value={(style.mixBlendMode ?? 'normal') as string}
            onChange={v => patchStyle({ mixBlendMode: v as UIBlockStyle['mixBlendMode'] })}
            options={[
              'normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light',
              'color-dodge', 'color-burn', 'difference', 'exclusion',
            ].map(m => ({ label: m, value: m }))}
          />
        </Row>
      )}
    </div>
  );
}

// ─── Tab: Typography ──────────────────────────────────────────────────────────

function TypographyTab({ block, updateBlock }: { block: UIBlock; updateBlock: (patch: Partial<UIBlock>) => void }) {
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());
  const style = block.style ?? {};

  const patchStyle = (patch: Partial<UIBlockStyle>) =>
    updateBlock({ style: { ...style, ...patch } });

  const handleFontPair = (heading: string, body: string) => {
    [heading, body].forEach(f => {
      if (!loadedFonts.has(f)) {
        loadGoogleFont(f);
        setLoadedFonts(s => new Set([...s, f]));
      }
    });
    patchStyle({ fontFamily: `"${heading}", "${body}", sans-serif` });
  };

  // Pre-load font that's already set
  useEffect(() => {
    FONT_PAIRS.forEach(pair => {
      if (style.fontFamily?.includes(pair.heading) && !loadedFonts.has(pair.heading)) {
        loadGoogleFont(pair.heading);
        loadGoogleFont(pair.body);
        setLoadedFonts(s => new Set([...s, pair.heading, pair.body]));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fontSize = parseFontSize(style.fontSize);
  const fontWeight = style.fontWeight ?? '400';
  const isItalic = style.fontStyle === 'italic';
  const isUnderline = style.textDecoration === 'underline';
  const isStrike = style.textDecoration === 'line-through';
  const textColor = style.color ?? '#0f172a';
  const lineHeight = style.lineHeight ?? '1.5';
  const letterSpacing = style.letterSpacing ?? 'normal';
  const textAlign = style.textAlign ?? 'left';

  return (
    <div>
      <Divider label="Font Pair" />
      <div className="grid grid-cols-1 gap-1 max-h-52 overflow-y-auto pr-1 mb-2">
        {FONT_PAIRS.map(pair => {
          const isActive = style.fontFamily?.includes(pair.heading) ?? false;
          return (
            <button
              key={pair.heading}
              onClick={() => handleFontPair(pair.heading, pair.body)}
              className={`flex items-center justify-between px-3 py-1.5 rounded border text-left transition-colors ${
                isActive
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-800'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <span
                className="text-sm font-semibold"
                style={loadedFonts.has(pair.heading) ? { fontFamily: `"${pair.heading}", serif` } : undefined}
              >
                Aa
              </span>
              <span className="text-xs text-slate-500 ml-2 flex-1 text-right truncate">{pair.label}</span>
            </button>
          );
        })}
      </div>

      <Divider label="Size & Weight" />
      <Row label="Size">
        <div className="flex items-center gap-2">
          <input
            type="range" min={10} max={120} value={fontSize}
            onChange={e => patchStyle({ fontSize: `${e.target.value}px` })}
            className="flex-1 h-1.5 accent-indigo-600"
          />
          <div className="w-16">
            <Input
              type="text" value={style.fontSize ?? '16px'}
              onChange={v => patchStyle({ fontSize: v })}
            />
          </div>
        </div>
      </Row>

      <Row label="Weight">
        <div className="flex flex-wrap gap-1">
          {[{ l: 'Regular', v: '400' }, { l: 'Medium', v: '500' }, { l: 'Semi', v: '600' }, { l: 'Bold', v: '700' }].map(w => (
            <Toggle key={w.v} active={fontWeight === w.v} onClick={() => patchStyle({ fontWeight: w.v as UIBlockStyle['fontWeight'] })}>
              {w.l}
            </Toggle>
          ))}
        </div>
      </Row>

      <Row label="Style">
        <div className="flex gap-1">
          <Toggle active={isItalic} onClick={() => patchStyle({ fontStyle: isItalic ? 'normal' : 'italic' })} title="Italic">
            <em>I</em>
          </Toggle>
          <Toggle active={isUnderline} onClick={() => patchStyle({ textDecoration: isUnderline ? 'none' : 'underline' })} title="Underline">
            <span className="underline">U</span>
          </Toggle>
          <Toggle active={isStrike} onClick={() => patchStyle({ textDecoration: isStrike ? 'none' : 'line-through' })} title="Strikethrough">
            <span className="line-through">S</span>
          </Toggle>
        </div>
      </Row>

      <Divider label="Spacing" />
      <Row label="Line Height">
        <div className="flex flex-wrap gap-1">
          {[{ l: 'Tight', v: '1.25' }, { l: 'Normal', v: '1.5' }, { l: 'Relaxed', v: '1.75' }, { l: 'Loose', v: '2' }].map(o => (
            <Toggle key={o.v} active={lineHeight === o.v} onClick={() => patchStyle({ lineHeight: o.v })}>{o.l}</Toggle>
          ))}
        </div>
      </Row>

      <Row label="Tracking">
        <div className="flex flex-wrap gap-1">
          {[{ l: 'Tight', v: '-0.05em' }, { l: 'Normal', v: 'normal' }, { l: 'Wide', v: '0.05em' }, { l: 'Wider', v: '0.1em' }].map(o => (
            <Toggle key={o.v} active={letterSpacing === o.v} onClick={() => patchStyle({ letterSpacing: o.v })}>{o.l}</Toggle>
          ))}
        </div>
      </Row>

      <Divider label="Alignment & Color" />
      <Row label="Align">
        <div className="flex gap-1">
          {[{ l: '←', v: 'left' as const }, { l: '↔', v: 'center' as const }, { l: '→', v: 'right' as const }, { l: '≡', v: 'justify' as const }].map(o => (
            <Toggle key={o.v} active={textAlign === o.v} onClick={() => patchStyle({ textAlign: o.v })}>{o.l}</Toggle>
          ))}
        </div>
      </Row>

      <Row label="Color">
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {SWATCH_COLORS.map(c => (
              <button
                key={c} title={c}
                onClick={() => patchStyle({ color: c })}
                className={`w-5 h-5 rounded-sm border-2 transition-transform hover:scale-110 ${
                  textColor === c ? 'border-indigo-600 scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color" value={textColor}
              onChange={e => patchStyle({ color: e.target.value })}
              className="w-7 h-7 rounded border border-slate-200 p-0.5 cursor-pointer bg-slate-50"
            />
            <Input value={textColor} onChange={v => patchStyle({ color: v })} />
          </div>
        </div>
      </Row>
    </div>
  );
}

// ─── Tab: Layout ──────────────────────────────────────────────────────────────

function LayoutTab({ block, updateBlock }: { block: UIBlock; updateBlock: (patch: Partial<UIBlock>) => void }) {
  const style = block.style ?? {};
  const sectionLayout = block.sectionLayout ?? 'full-width';
  const sectionHeight = block.sectionHeight ?? { mode: 'auto' };
  const isGridType = GRID_TYPES.has(block.type);

  const patchStyle = (patch: Partial<UIBlockStyle>) =>
    updateBlock({ style: { ...style, ...patch } });

  const patchHeight = (patch: Partial<SectionHeight>) =>
    updateBlock({ sectionHeight: { ...sectionHeight, ...patch } });

  return (
    <div>
      <Divider label="Section Layout" />
      <div className="grid grid-cols-2 gap-1 mb-2">
        {SECTION_LAYOUTS.map(l => (
          <button
            key={l.value}
            onClick={() => updateBlock({ sectionLayout: l.value })}
            className={`py-2 px-3 text-xs rounded border transition-colors ${
              sectionLayout === l.value
                ? 'bg-indigo-50 border-indigo-400 text-indigo-800'
                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <Divider label="Height" />
      <Row label="Mode">
        <Select
          value={sectionHeight.mode}
          onChange={v => patchHeight({ mode: v as HeightMode })}
          options={HEIGHT_MODES.map(m => ({ label: m.charAt(0).toUpperCase() + m.slice(1).replace('-', ' '), value: m }))}
        />
      </Row>
      {sectionHeight.mode !== 'auto' && sectionHeight.mode !== 'full-screen' && (
        <Row label="Value">
          <Input
            value={sectionHeight.value ?? ''}
            onChange={v => patchHeight({ value: v })}
            placeholder="400px"
          />
        </Row>
      )}

      <Divider label="Padding" />
      <div className="grid grid-cols-2 gap-2 mb-1">
        {[
          ['paddingTop', 'Top'],
          ['paddingRight', 'Right'],
          ['paddingBottom', 'Bottom'],
          ['paddingLeft', 'Left'],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <label className="text-[10px] text-slate-400 w-8 shrink-0">{label}</label>
            <Input
              value={(style as Record<string, string>)[key] ?? ''}
              onChange={v => patchStyle({ [key]: v } as Partial<UIBlockStyle>)}
              placeholder="0"
            />
          </div>
        ))}
      </div>
      <div className="mb-1">
        <Row label="Padding">
          <Input
            value={style.padding ?? ''}
            onChange={v => patchStyle({ padding: v })}
            placeholder="shorthand: 16px 24px"
          />
        </Row>
      </div>

      {isGridType && (
        <>
          <Divider label="Gap" />
          <Row label="Gap">
            <Input
              value={style.gap ?? '16px'}
              onChange={v => patchStyle({ gap: v })}
              placeholder="16px"
            />
          </Row>
        </>
      )}
    </div>
  );
}

// ─── Tab: Position ────────────────────────────────────────────────────────────

type QuickPreset = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right';

function PositionTab({ block, updateBlock }: { block: UIBlock; updateBlock: (patch: Partial<UIBlock>) => void }) {
  const pos = block.position ?? {};

  const patchPos = (patch: Partial<BlockPosition>) =>
    updateBlock({ position: { ...pos, ...patch } });

  const applyPreset = (preset: QuickPreset) => {
    const w = parsePxInt(pos.width, 400);
    const h = parsePxInt(pos.height, 200);
    const snap = (n: number) => Math.round(n / 8) * 8;
    const map: Record<QuickPreset, { x: number; y: number }> = {
      'top-left':     { x: 0,                              y: 0 },
      'top-center':   { x: (CANVAS_WIDTH - w) / 2,         y: 0 },
      'top-right':    { x: CANVAS_WIDTH - w,               y: 0 },
      'center-left':  { x: 0,                              y: Math.max(0, (600 - h) / 2) },
      'center':       { x: (CANVAS_WIDTH - w) / 2,         y: Math.max(0, (600 - h) / 2) },
      'center-right': { x: CANVAS_WIDTH - w,               y: Math.max(0, (600 - h) / 2) },
    };
    patchPos({ x: snap(map[preset].x), y: snap(map[preset].y) });
  };

  return (
    <div>
      <Divider label="Position" />
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-slate-400 shrink-0">X</label>
          <Input type="number" value={pos.x ?? 0} onChange={v => patchPos({ x: Number(v) })} suffix="px" />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-slate-400 shrink-0">Y</label>
          <Input type="number" value={pos.y ?? 0} onChange={v => patchPos({ y: Number(v) })} suffix="px" />
        </div>
      </div>

      <Divider label="Dimensions" />
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-slate-400 shrink-0">W</label>
          <Input value={pos.width ?? ''} onChange={v => patchPos({ width: v })} placeholder="400px" />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-slate-400 shrink-0">H</label>
          <Input value={pos.height ?? ''} onChange={v => patchPos({ height: v })} placeholder="auto" />
        </div>
      </div>

      <Divider label="Quick Position" />
      <div className="grid grid-cols-3 gap-1 mb-2">
        {([
          ['top-left', '↖ TL'], ['top-center', '↑ TC'], ['top-right', '↗ TR'],
          ['center-left', '← CL'], ['center', '⊙ C'], ['center-right', '→ CR'],
        ] as [QuickPreset, string][]).map(([preset, label]) => (
          <button
            key={preset} onClick={() => applyPreset(preset)}
            className="h-8 text-xs rounded border bg-white border-slate-200 text-slate-600
              hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>

      <Divider label="Layer Order" />
      <div className="flex items-start gap-2 px-2 py-2 rounded bg-slate-50 border border-slate-200 mb-2">
        <span className="text-base leading-none mt-0.5 shrink-0">☰</span>
        <p className="text-xs text-slate-500 leading-relaxed">
          Z-order is set by <strong className="text-slate-700">row position</strong> in the Layers Panel — drag rows to reorder depth.
        </p>
      </div>

      <Divider label="Transform" />
      <Slider
        label="Rotation" value={pos.rotation ?? 0} min={-180} max={180} suffix="°"
        onChange={v => patchPos({ rotation: v })}
      />
      <Slider
        label="Scale" value={Math.round((pos.scale ?? 1) * 100)} min={25} max={300} suffix="%"
        onChange={v => patchPos({ scale: v / 100 })}
      />
    </div>
  );
}

// ─── Empty / multi-select states ──────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-slate-400">
          <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-500">No block selected</p>
      <p className="text-xs text-slate-400 mt-1">Click a block on the canvas to edit its properties.</p>
    </div>
  );
}

function MultiSelectState({ count }: { count: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
        <span className="text-base font-bold text-indigo-600">{count}</span>
      </div>
      <p className="text-sm font-medium text-slate-700">{count} blocks selected</p>
      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
        Use the alignment bar above the canvas to align or distribute.
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

type Tab = 'style' | 'typography' | 'layout' | 'position';

const TABS: { id: Tab; label: string }[] = [
  { id: 'style', label: 'Style' },
  { id: 'typography', label: 'Type' },
  { id: 'layout', label: 'Layout' },
  { id: 'position', label: 'Position' },
];

export function PropertyPanelV2() {
  const [activeTab, setActiveTab] = useState<Tab>('style');

  const layout = useModuleBuilderStore(s => s.layout);
  const selectedBlockId = useModuleBuilderStore(s => s.selectedBlockId);
  const selectedBlockIds = useModuleBuilderStore(s => s.selectedBlockIds);
  const updateBlock = useModuleBuilderStore(s => s.updateBlock);

  // Single-select: prefer selectedBlockIds[0], fall back to selectedBlockId
  const activeId = selectedBlockIds.length === 1
    ? selectedBlockIds[0]
    : selectedBlockIds.length === 0
    ? selectedBlockId
    : null;

  const block = activeId ? layout.find(b => b.id === activeId) ?? null : null;

  const update = useCallback(
    (patch: Partial<UIBlock>) => {
      if (!activeId) return;
      updateBlock(activeId, patch);
    },
    [activeId, updateBlock],
  );

  const multiCount = selectedBlockIds.length;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center px-4 h-11 border-b border-slate-200 shrink-0">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Properties</span>
      </div>

      {multiCount > 1 ? (
        <MultiSelectState count={multiCount} />
      ) : !block ? (
        <EmptyState />
      ) : (
        <>
          {/* Block info strip */}
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-600
                bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 shrink-0">
                {block.type}
              </span>
              {block.label && (
                <span className="text-xs text-slate-500 truncate">{block.label}</span>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-slate-200 shrink-0">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 h-9 text-xs font-medium transition-colors relative ${
                  activeTab === t.id ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
                {activeTab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {activeTab === 'style' && <StyleTab block={block} updateBlock={update} />}
            {activeTab === 'typography' && <TypographyTab block={block} updateBlock={update} />}
            {activeTab === 'layout' && <LayoutTab block={block} updateBlock={update} />}
            {activeTab === 'position' && <PositionTab block={block} updateBlock={update} />}
          </div>
        </>
      )}
    </div>
  );
}

export default PropertyPanelV2;
