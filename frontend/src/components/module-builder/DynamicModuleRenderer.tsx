'use client';

import { UIBlock, SectionBackground, SectionHeight } from '@/types/module-builder';
import { Module } from '@/lib/settings-context';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { useContentTranslation } from '@/lib/translate';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCartStore } from '@/stores/cartStore';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Clock, Users, ShoppingCart, Plus, Minus, Calendar, Star, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

// Type definitions for menu and session data
interface MenuItem {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  price: number;
  image_url?: string;
  image?: string;
  category_id: string;
  is_available: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  sort_order: number;
}

interface PoolSession {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  description_ar?: string;
  description_fr?: string;
  start_time: string;
  end_time: string;
  capacity: number;
  available_spots?: number;
  price?: number;
  adult_price?: number;
  gender?: 'mixed' | 'male' | 'female';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BlockProps = Record<string, any>;

interface RendererProps {
  layout: UIBlock[];
  module: Module;
}

// Zod Schema for Run-time Validation
// IMPORTANT: .passthrough() preserves position, label, background, sectionHeight, layers etc.
const SafeBlockSchema: z.ZodType<any> = z.lazy(() => z.object({
  id: z.string(),
  type: z.string(),
  props: z.record(z.any()).optional(),
  style: z.record(z.any()).optional(),
  children: z.array(SafeBlockSchema).optional(),
}).passthrough());

// Helper to parse props - handles both JSON objects and PowerShell-style strings
function parseProps(props: Record<string, unknown>): BlockProps {
  if (!props) return {};

  if (typeof props !== 'object' || Array.isArray(props)) {
    return props as BlockProps;
  }

  const parsed: BlockProps = {};
  
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') {
      const isPowerShell = value.startsWith('@{') && value.endsWith('}');
      const isJsonArray = value.startsWith('[') && value.endsWith(']');
      const isJsonObject = value.startsWith('{') && value.endsWith('}');
      
      if (isPowerShell) {
        const inner = value.slice(2, -1);
        const pairs = inner.split(';').map(p => p.trim()).filter(Boolean);
        for (const pair of pairs) {
          const eqIndex = pair.indexOf('=');
          if (eqIndex > 0) {
            const k = pair.slice(0, eqIndex).trim();
            const v = pair.slice(eqIndex + 1).trim();
            parsed[k] = v;
          }
        }
      } else if (isJsonArray || isJsonObject) {
        try {
          parsed[key] = JSON.parse(value);
        } catch (e) {
          parsed[key] = value;
        }
      } else {
        parsed[key] = value;
      }
    } else {
      parsed[key] = value;
    }
  }

  return parsed;
}

// Hook to compute responsive scale factor for the 1920x1080 canvas
function useCanvasScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      // Scale the 1920px canvas to fit the viewport width
      setScale(Math.min(vw / 1920, 1));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return scale;
}

export function DynamicModuleRenderer({ layout, module, propertySlug }: RendererProps & { propertySlug?: string }) {
  const scale = useCanvasScale();

  // Validate schema version
  const result = z.array(SafeBlockSchema).safeParse(layout);
  if (!result.success) {
    console.error("Schema validation failed", result.error);
    // Fallback UI for P0 requirement
    return <div className="p-4 bg-amber-50 text-amber-800 rounded border border-amber-200">Module content format is incompatible.</div>;
  }
  const safeLayout = result.data as UIBlock[];

  if (!safeLayout || safeLayout.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] p-10 text-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-3xl border border-slate-200/50 dark:border-slate-700/50 shadow-xl max-w-2xl mx-auto my-16 backdrop-blur-md">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mb-6 shadow-lg shadow-primary-500/20">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
          Design Your Page
        </h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
          This module does not have any layout defined yet. Open the Customization Manager to drag and drop components, customize the styling, and publish your design.
        </p>
        <button 
          onClick={() => window.location.href = propertySlug ? `/${propertySlug}/admin/customizations` : '/admin/customizations'}
          className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-primary-600 to-secondary-600 hover:from-primary-700 hover:to-secondary-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
        >
          Open Customization Manager
        </button>
      </div>
    );
  }

  // Only switch to freeform canvas mode when EVERY block has explicit position data.
  // Using `some` caused a split-state bug: the moment the builder saved position to
  // one block (e.g. pricing_table after a drag), all blocks flipped to freeform mode.
  // Blocks without saved positions defaulted to top:0 / left:0 and overlapped each
  // other, making them appear to disappear in the builder preview while the live page
  // (still stack-mode in the DB) rendered correctly. `every` means freeform mode only
  // engages when all blocks have been explicitly placed by the builder.
  const hasPositionData = safeLayout.length > 0 && safeLayout.every(
    (b) => b.position?.x !== undefined && b.position?.y !== undefined
  );

  // Stack fallback: render blocks in normal document flow
  if (!hasPositionData) {
    return (
      <div className="relative w-full bg-slate-50 dark:bg-slate-900">
        {safeLayout.map((block) => (
          <BlockRenderer key={block.id} block={block} module={module} />
        ))}
      </div>
    );
  }

  // Freeform canvas mode - blocks positioned absolutely like PowerPoint
  // Scales down responsively on smaller viewports
  return (
    <div className="relative w-full bg-slate-50 dark:bg-slate-900 overflow-hidden" style={{ minHeight: `${1080 * scale}px` }}>
      <div style={{
        width: '1920px',
        height: '1080px',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        position: 'relative',
      }}>
        {safeLayout.map((block) => {
          const pos = block.position;
          const transforms: string[] = [];
          if (pos?.rotation) transforms.push(`rotate(${pos.rotation}deg)`);
          if (pos?.scale && pos.scale !== 1) transforms.push(`scale(${pos.scale})`);
          return (
            <div
              key={block.id}
              style={{
                position: 'absolute',
                left: pos?.x !== undefined ? `${pos.x}px` : '0px',
                top: pos?.y !== undefined ? `${pos.y}px` : '0px',
                zIndex: pos?.z || 1,
                width: pos?.width || '100%',
                height: pos?.height || 'auto',
                transform: transforms.length > 0 ? transforms.join(' ') : undefined,
                transformOrigin: 'center center',
              }}
            >
              <BlockRenderer block={block} module={module} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// LAYER 1: Section Background & Height Wrapper
// ============================================
interface SectionWrapperProps {
  block: UIBlock;
  children: React.ReactNode;
}

function SectionWrapper({ block, children }: SectionWrapperProps) {
  const { background, sectionHeight, sectionLayout, layers } = block;

  // Helper: Build layout class based on sectionLayout
  const getLayoutClass = (): string => {
    if (!sectionLayout) return '';

    switch (sectionLayout) {
      case 'full-width':
        return 'w-full h-full';
      case 'contained':
        return 'w-[90%] mx-auto h-full';
      case 'split-50-50':
        return 'grid grid-cols-1 md:grid-cols-2 gap-0 w-full h-full';
      case 'split-60-40':
        return 'grid grid-cols-1 md:grid-cols-[60%_40%] gap-0 w-full h-full';
      case 'split-40-60':
        return 'grid grid-cols-1 md:grid-cols-[40%_60%] gap-0 w-full h-full';
      case 'centered-narrow':
        return 'w-[60%] mx-auto h-full';
      default:
        return 'w-full h-full';
    }
  };

  // Helper: Build background styles
  const getBackgroundStyles = (): React.CSSProperties => {
    if (!background) return {};

    switch (background.type) {
      case 'color':
        return { backgroundColor: background.color || 'transparent' };

      case 'gradient':
        if (background.gradient) {
          const { direction, stops } = background.gradient;
          return {
            background: `linear-gradient(${direction}, ${stops.join(', ')})`,
          };
        }
        return {};

      case 'image':
        if (background.image) {
          const { url, position = 'center', size = 'cover', repeat = 'no-repeat', attachment = 'scroll' } = background.image;
          return {
            backgroundImage: `url(${url})`,
            backgroundPosition: position,
            backgroundSize: size,
            backgroundRepeat: repeat,
            backgroundAttachment: attachment,
          };
        }
        return {};

      case 'video':
        // Video is rendered as a separate element, not in CSS
        return { backgroundColor: '#000' };

      default:
        return {};
    }
  };

  // Helper: Build height styles
  const getHeightStyles = (): React.CSSProperties => {
    if (!sectionHeight) return {};

    switch (sectionHeight.mode) {
      case 'fixed':
        return { height: sectionHeight.value || '400px' };
      case 'min-height':
        return { minHeight: sectionHeight.value || '400px' };
      case 'full-screen':
      case 'viewport':
        return { minHeight: '100vh' };
      case 'auto':
      default:
        return {};
    }
  };

  const backgroundStyles = getBackgroundStyles();
  const heightStyles = getHeightStyles();
  const layoutClass = getLayoutClass();
  const hasBackground = !!background;
  const hasOverlay = background?.overlay && background.overlay.opacity > 0;

  // If no background or height control, just render children
  if (!hasBackground && !sectionHeight) {
    return <>{children}</>;
  }

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        ...backgroundStyles,
        ...heightStyles,
        position: 'relative',
      }}
    >
      {/* Video Background */}
      {background?.type === 'video' && background.video && (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={background.video.url}
          poster={background.video.poster}
          autoPlay={background.video.autoplay}
          loop={background.video.loop}
          muted={background.video.muted !== false}
          playsInline
        >
          <track kind="captions" />
        </video>
      )}

      {/* Overlay for text readability */}
      {hasOverlay && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            backgroundColor: background.overlay!.color,
            opacity: background.overlay!.opacity,
          }}
        />
      )}

      {/* Positioned Layers (Layer 3) */}
      {layers && layers.length > 0 && (
        <div className="absolute inset-0 z-20">
          {layers.map((layer) => (
            <div
              key={layer.id}
              className="absolute"
              style={{
                top: layer.position.top,
                right: layer.position.right,
                bottom: layer.position.bottom,
                left: layer.position.left,
                zIndex: layer.position.zIndex || 1,
                width: layer.size?.width,
                height: layer.size?.height,
              }}
            >
              {/* Layer content based on type */}
              {layer.type === 'text' && (
                <div style={layer.style as React.CSSProperties}>
                  {layer.content?.text}
                </div>
              )}
              {layer.type === 'image' && layer.content?.src && (
                <img
                  src={layer.content.src}
                  alt={layer.content.alt || ''}
                  className="w-full h-full object-cover"
                  style={{
                    objectFit: layer.content.objectFit || 'cover',
                    // Apply specific style properties separately to avoid transform type issues
                    opacity: layer.style?.opacity,
                    filter: layer.style?.filter,
                  }}
                />
              )}
              {layer.type === 'button' && (
                <button
                  style={layer.style as React.CSSProperties}
                  onClick={() => layer.content?.url && (window.location.href = layer.content.url)}
                >
                  {layer.content?.text || 'Button'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className={`relative z-30 w-full h-full ${hasBackground ? 'flex flex-col justify-center' : ''} ${layoutClass}`}>
        {children}
      </div>
    </section>
  );
}

// Error boundary wrapper for individual blocks
function BlockErrorBoundary({ children, blockType }: { children: React.ReactNode; blockType: string }) {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
        <p className="text-red-600 dark:text-red-400 text-sm font-medium">Failed to render: {blockType}</p>
        <button 
          onClick={() => setHasError(false)}
          className="mt-2 text-xs text-red-500 underline hover:text-red-700"
        >
          Try again
        </button>
      </div>
    );
  }

  try {
    return <>{children}</>;
  } catch (err) {
    console.error(`[BlockRenderer] Error rendering ${blockType}:`, err);
    setHasError(true);
    return null;
  }
}

// Safely coerce a prop value to an array — handles strings, arrays, and undefined
function safeArray(val: unknown): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { 
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

// ─── Inline editing helper ──────────────────────────────────────────────────
// Returns contentEditable props when active=true; an empty object otherwise.
// The dashed indigo underline signals editability without changing visual style.
// Pressing Enter commits the edit (same as blur). Shift+Enter inserts a newline.
function ep(
  active: boolean,
  onCommit: (v: string) => void,
): React.HTMLAttributes<HTMLElement> {
  if (!active) return {};
  return {
    contentEditable: true,
    suppressContentEditableWarning: true,
    onBlur: (e) => onCommit((e.currentTarget as HTMLElement).textContent?.trim() ?? ''),
    onKeyDown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
      }
      // Stop propagation so canvas keyboard shortcuts don't fire while typing
      e.stopPropagation();
    },
    onClick: (e) => e.stopPropagation(),
    style: { outline: 'none', cursor: 'text', borderBottom: '1.5px dashed rgba(99,102,241,0.55)' },
  };
}

export function BlockRenderer({
  block, module, isEditing = false, onUpdateProps,
}: {
  block: UIBlock;
  module: Module;
  isEditing?: boolean;
  onUpdateProps?: (updates: Record<string, any>) => void;
}) {
  const { type, style } = block;

  // Validate Block Type - Added new glassmorphic components
  const KNOWN_TYPES = [
    'hero', 'container', 'grid', 'text_block', 'image', 
    'menu_list', 'session_list', 'booking_calendar', 'button', 'form_container', 
    'testimonials', 'pricing_table',
    // New glassmorphic components
    'hero_v2', 'card_grid', 'stats', 'features', 'cta', 'video', 'divider', 'spacer',
    // Session/Activity specific components
    'class_schedule', 'calendar', 'testimonials_carousel'
  ];
  if (!KNOWN_TYPES.includes(type)) {
    return null;
  }

  const props = parseProps(block.props);

  // style object conversion if needed
  const inlineStyle = {
    ...style,
    // ensure background image works if provided in props or style
    backgroundImage: props.backgroundImage ? `url(${props.backgroundImage})` : style?.backgroundImage,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } as React.CSSProperties;

  // Render content based on block type
  let content: React.ReactNode;

  switch (type) {
    case 'hero':
      content = (
        <section
          style={inlineStyle}
          className="w-full flex items-center justify-center relative overflow-hidden text-white min-h-[300px]"
        >
          {/* Overlay if image exists */}
          {props.backgroundImage && <div className="absolute inset-0 bg-black/40 z-0" />}

          <div className="relative z-10 px-4 py-10 text-center w-full h-full flex flex-col items-center justify-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span {...ep(isEditing, (v) => onUpdateProps?.({ title: v }))}>
                {props.title || module.name}
              </span>
            </h1>
            <p className="text-xl md:text-2xl opacity-90">
              <span {...ep(isEditing, (v) => onUpdateProps?.({ subtitle: v }))}>
                {props.subtitle || module.description}
              </span>
            </p>
          </div>
        </section>
      );
      break;

    case 'container':
      content = (
        <div style={inlineStyle} className="w-full h-full p-4">
          {block.children?.map(child => (
            <BlockRenderer key={child.id} block={child} module={module} />
          ))}
        </div>
      );
      break;

    case 'grid':
      const gridCols = props.columns || 3;
      content = (
        <div className={`grid grid-cols-1 md:grid-cols-${gridCols} gap-6 w-full h-full p-4`} style={inlineStyle}>
          {block.children && block.children.length > 0
            ? block.children.map(child => <BlockRenderer key={child.id} block={child} module={module} />)
            : <div className="col-span-full text-center p-8 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">Grid - Add content in the builder</div>
          }
        </div>
      );
      break;

    case 'text_block':
      content = (
        <div
          style={inlineStyle}
          className="w-full h-full p-4 whitespace-pre-wrap"
          {...ep(isEditing, (v) => onUpdateProps?.({ content: v }))}
        >
          {props.content || 'Empty Text Block'}
        </div>
      );
      break;

    case 'image':
      content = (
        <div style={inlineStyle} className="relative w-full h-full p-2 flex items-center justify-center">
          <img
            src={props.src || '/placeholder-image.jpg'}
            alt={props.alt || 'Module Image'}
            className="max-w-full max-h-full object-contain rounded-lg shadow-md"
          />
          {isEditing && (
            <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded px-2 py-1">
              <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">Alt:</span>
              <span
                className="text-xs text-white flex-1 min-w-0"
                {...ep(true, (v) => onUpdateProps?.({ alt: v }))}
              >
                {props.alt || 'Image description…'}
              </span>
            </div>
          )}
        </div>
      );
      break;

    case 'menu_list':
      content = <MenuListComponent module={module} props={props} />;
      break;

    case 'session_list':
      content = <SessionListComponent module={module} props={props} />;
      break;

    case 'booking_calendar':
      content = <BookingCalendarComponent module={module} props={props} />;
      break;

    case 'button':
      const buttonSizeClasses = {
        sm: 'px-4 py-1.5 text-sm',
        md: 'px-6 py-2.5 text-base',
        lg: 'px-8 py-3 text-lg',
      };
      const sizeClass = buttonSizeClasses[props.size as keyof typeof buttonSizeClasses] || buttonSizeClasses.md;
      const isOutline = props.variant === 'outline';
      const isGhost = props.variant === 'ghost';
      const bgColor = props.backgroundColor || '#6366f1';

      const buttonStyle: React.CSSProperties = {
        backgroundColor: isOutline || isGhost ? 'transparent' : bgColor,
        color: isOutline || isGhost ? bgColor : (bgColor === '#ffffff' ? '#1e293b' : '#ffffff'),
        border: isOutline ? `2px solid ${bgColor}` : 'none',
      };

      const ButtonContent = (
        <button
          className={`${sizeClass} rounded-lg font-medium transition-all hover:opacity-90 inline-block`}
          style={buttonStyle}
        >
          <span {...ep(isEditing, (v) => onUpdateProps?.({ text: v }))}>
            {props.text || 'Button'}
          </span>
        </button>
      );

      content = (
        <div style={inlineStyle} className="flex justify-center py-4">
          {props.href ? (
            <a href={props.href} className="no-underline">
              {ButtonContent}
            </a>
          ) : ButtonContent}
        </div>
      );
      break;

    case 'form_container':
      content = <FormContainerComponent module={module} block={block} props={props} />;
      break;

    case 'testimonials':
      content = <TestimonialsComponent props={props} />;
      break;

    case 'pricing_table':
      content = <PricingTableComponent module={module} props={props} isEditing={isEditing} onUpdateProps={onUpdateProps} />;
      break;

    // ============================================
    // NEW GLASSMORPHIC COMPONENTS
    // ============================================

    case 'hero_v2':
      // Background is handled by SectionWrapper via block.background
      // Fallback gradient only if no background is set on the block
      const heroV2HasBackground = !!block.background;
      const heroV2FallbackStyle: React.CSSProperties = heroV2HasBackground
        ? inlineStyle
        : {
            ...inlineStyle,
            background: `linear-gradient(135deg, ${props.headerColor || '#0ea5e9'} 0%, ${props.accentColor || '#6366f1'} 50%, ${props.headerColor || '#0ea5e9'} 100%)`,
            backgroundSize: '400% 400%',
          };

      content = (
        <section
          style={heroV2FallbackStyle}
          className="w-full relative overflow-hidden min-h-[45vh] flex items-center justify-center"
        >
          {/* Aurora overlay - only when no image background */}
          {!block.background?.image && (
            <div
              className="absolute inset-0 opacity-60"
              style={{
                background: `
                  radial-gradient(ellipse 80% 50% at 30% 40%, rgba(255,255,255,0.3) 0%, transparent 50%),
                  radial-gradient(ellipse 60% 40% at 70% 60%, rgba(255,255,255,0.2) 0%, transparent 50%)
                `,
                filter: 'blur(40px)',
              }}
            />
          )}

          {/* Eyebrow / Badge */}
          {(props.eyebrow || props.badgeText || isEditing) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-8 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium"
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
            >
              <Sparkles className="w-4 h-4" />
              <span {...ep(isEditing, (v) => onUpdateProps?.({ eyebrow: v }))}>
                {props.eyebrow || props.badgeText || (isEditing ? 'Eyebrow…' : '')}
              </span>
            </motion.div>
          )}

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className={`relative z-10 px-4 ${props.align === 'left' ? 'text-left' : props.align === 'right' ? 'text-right' : 'text-center'}`}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
              <span {...ep(isEditing, (v) => onUpdateProps?.({ title: v }))}>
                {props.title || module.name}
              </span>
              {props.highlight && (
                <span className="text-amber-400"> {props.highlight}</span>
              )}
            </h1>
            {(props.subtitle || isEditing) && (
              <p className="text-xl text-white/90 mb-2">
                <span {...ep(isEditing, (v) => onUpdateProps?.({ subtitle: v }))}>
                  {props.subtitle || (isEditing ? 'Subtitle…' : '')}
                </span>
              </p>
            )}
            {props.description && (
              <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
                {props.description}
              </p>
            )}

            {/* Buttons */}
            {(props.primaryButton || props.secondaryButton) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex gap-4 flex-wrap justify-center mt-6"
              >
                {(props.primaryButton || isEditing) && (
                  <a
                    href={isEditing ? undefined : (props.primaryUrl || '#')}
                    onClick={isEditing ? (e) => e.preventDefault() : undefined}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg transition-colors shadow-lg"
                  >
                    <span {...ep(isEditing, (v) => onUpdateProps?.({ primaryButton: v }))}>
                      {props.primaryButton || (isEditing ? 'Primary Button' : '')}
                    </span>
                  </a>
                )}
                {(props.secondaryButton || isEditing) && (
                  <a
                    href={isEditing ? undefined : (props.secondaryUrl || '#')}
                    onClick={isEditing ? (e) => e.preventDefault() : undefined}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/30 transition-colors backdrop-blur-sm"
                  >
                    <span {...ep(isEditing, (v) => onUpdateProps?.({ secondaryButton: v }))}>
                      {props.secondaryButton || (isEditing ? 'Secondary Button' : '')}
                    </span>
                  </a>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Bottom wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 60" fill="none" className="w-full">
              <path d="M0 60L60 52.5C120 45 240 30 360 22.5C480 15 600 15 720 18.75C840 22.5 960 30 1080 33.75C1200 37.5 1320 37.5 1380 37.5L1440 37.5V60H1380C1320 60 1200 60 1080 60C960 60 840 60 720 60C600 60 480 60 360 60C240 60 120 60 60 60H0Z" className="fill-slate-50 dark:fill-slate-900"/>
            </svg>
          </div>
        </section>
      );
      break;

    case 'card_grid':
      const cardCols = props.columns || 3;
      const safeCards = safeArray(props.cards);
      content = (
        <div className={`grid grid-cols-1 md:grid-cols-${cardCols} gap-6 w-full h-full p-4`} style={inlineStyle}>
          {safeCards.map((card: any, index: number) => (
            <motion.div
              key={index}
              whileHover={{ y: -8, scale: 1.02 }}
              className="rounded-2xl overflow-hidden cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.5) 100%)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.15)',
              }}
            >
              {card.image && (
                <div className="h-48 overflow-hidden">
                  <img src={card.image} alt={card.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  <span {...ep(isEditing, (v) => {
                    const updated = safeCards.map((c: any, i: number) => i === index ? { ...c, title: v } : c);
                    onUpdateProps?.({ cards: updated });
                  })}>{card.title}</span>
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  <span {...ep(isEditing, (v) => {
                    const updated = safeCards.map((c: any, i: number) => i === index ? { ...c, description: v } : c);
                    onUpdateProps?.({ cards: updated });
                  })}>{card.description}</span>
                </p>
              </div>
            </motion.div>
          ))}
          {safeCards.length === 0 && <div className="col-span-full text-center p-8">Add cards in the builder</div>}
        </div>
      );
      break;

    case 'stats':
      content = (
        <div className="w-full h-full px-4 py-12" style={inlineStyle}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {safeArray(props.stats).map((stat: any, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
                className="text-center p-6 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                }}
              >
                <div className="text-3xl md:text-4xl font-bold mb-1" style={{ color: props.accentColor || '#6366f1' }}>
                  <span {...ep(isEditing, (v) => {
                    const updated = safeArray(props.stats).map((s: any, i: number) => i === index ? { ...s, value: v } : s);
                    onUpdateProps?.({ stats: updated });
                  })}>{stat.value}</span>
                </div>
                <div className="text-slate-600 dark:text-slate-400 text-sm">
                  <span {...ep(isEditing, (v) => {
                    const updated = safeArray(props.stats).map((s: any, i: number) => i === index ? { ...s, label: v } : s);
                    onUpdateProps?.({ stats: updated });
                  })}>{stat.label}</span>
                </div>
              </motion.div>
            ))}
            {safeArray(props.stats).length === 0 && <div className="col-span-full text-center p-8">Add stats in the builder</div>}
          </div>
        </div>
      );
      break;

    case 'features':
      content = (
        <div className="w-full h-full px-4 py-12" style={inlineStyle}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {safeArray(props.features).map((feature: any, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-4 p-6 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.5)',
                }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: props.accentColor || '#6366f1' }}
                >
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                    <span {...ep(isEditing, (v) => {
                      const updated = safeArray(props.features).map((f: any, i: number) => i === index ? { ...f, title: v } : f);
                      onUpdateProps?.({ features: updated });
                    })}>{feature.title}</span>
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    <span {...ep(isEditing, (v) => {
                      const updated = safeArray(props.features).map((f: any, i: number) => i === index ? { ...f, description: v } : f);
                      onUpdateProps?.({ features: updated });
                    })}>{feature.description}</span>
                  </p>
                </div>
              </motion.div>
            ))}
            {safeArray(props.features).length === 0 && <div className="col-span-full text-center p-8">Add features in the builder</div>}
          </div>
        </div>
      );
      break;

    case 'cta':
      content = (
        <div className="w-full h-full px-4 py-12" style={inlineStyle}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl p-8 md:p-12 text-center"
            style={{
              background: `linear-gradient(135deg, ${props.headerColor || '#0ea5e9'} 0%, ${props.accentColor || '#6366f1'} 100%)`,
            }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              <span {...ep(isEditing, (v) => onUpdateProps?.({ title: v }))}>
                {props.title || 'Ready to get started?'}
              </span>
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
              <span {...ep(isEditing, (v) => onUpdateProps?.({ description: v }))}>
                {props.description || 'Join us today and experience the difference.'}
              </span>
            </p>
            <button
              onClick={() => !isEditing && props.buttonUrl && (window.location.href = props.buttonUrl)}
              className="px-8 py-4 bg-white text-slate-900 rounded-xl font-semibold hover:bg-white/90 transition-colors shadow-xl"
            >
              <span {...ep(isEditing, (v) => onUpdateProps?.({ buttonText: v }))}>
                {props.buttonText || 'Get Started'}
              </span>
            </button>
          </motion.div>
        </div>
      );
      break;

    case 'divider':
      content = (
        <div className="w-full h-full p-4 flex items-center justify-center" style={inlineStyle}>
          <div 
            className="h-px w-full"
            style={{ 
              background: `linear-gradient(90deg, transparent, ${props.accentColor || '#6366f1'}40, transparent)` 
            }}
          />
        </div>
      );
      break;

    case 'spacer':
      content = (
        <div style={{ height: props.height || 40 }} />
      );
      break;

    // ============================================
    // SESSION/ACTIVITY SPECIFIC COMPONENTS
    // ============================================

    case 'class_schedule':
      content = <ClassScheduleComponent module={module} props={props} />;
      break;

    case 'calendar':
      content = <CalendarComponent module={module} props={props} />;
      break;

    case 'testimonials_carousel':
      content = <TestimonialsCarouselComponent module={module} props={props} isEditing={isEditing} onUpdateProps={onUpdateProps} />;
      break;

    default:
      // This case should be unreachable due to the check above, but as a safety net:
      content = null;
  }

  // Wrap content with SectionWrapper for background/height/layer support
  return (
    <BlockErrorBoundary blockType={type}>
      <SectionWrapper block={block}>
        {content}
      </SectionWrapper>
    </BlockErrorBoundary>
  );
}

// ============================================
// Menu List Component for menu_service modules
// ============================================
function MenuListComponent({ module, props }: { module: Module; props: BlockProps }) {
  const t = useTranslations('instantTransaction');
  const tCommon = useTranslations('common');
  const { translateContent } = useContentTranslation();
  const currency = useSettingsStore((s) => s.currency);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const allItems = useCartStore((s) => s.items);

  const { data, isLoading, error } = useQuery({
    queryKey: ['menu', module.id],
    // /items is the correct instant_transaction route — /menu never existed.
    // Returns { success: true, data: [...] } where each item has a `category`
    // text field (not a category_id FK — catalog_items has no categories table).
    queryFn: () => api.get(`/${module.slug}/items`),
  });

  // Flat item array from the /items response shape.
  const items: MenuItem[] = data?.data?.data || [];
  // Derive unique categories from the items themselves.
  const categories: MenuCategory[] = Array.from(
    new Set(items.map((i) => i.category).filter(Boolean))
  ).map((cat) => ({ id: cat as string, name: cat as string, sort_order: 0 }));

  const filteredItems = selectedCategory
    ? items.filter((item) => item.category === selectedCategory)
    : items;

  const getItemQuantity = (itemId: string) => {
    const item = allItems.find((i) => i.id === itemId && i.moduleId === module.id);
    return item?.quantity || 0;
  };

  const addToCart = (item: MenuItem) => {
    const cartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      moduleId: module.id,
      moduleSlug: module.slug,
      moduleName: module.name,
      type: 'instant_transaction' as const,
      imageUrl: item.image_url || item.image
    };
    addItem(cartItem);
    toast.success(`${translateContent(item, 'name')} added to cart`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">
        Failed to load menu items
      </div>
    );
  }

  return (
    <div className="w-full h-full px-4 py-8">
      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!selectedCategory
              ? 'bg-primary-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
          >
            {tCommon('all')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat.id
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
            >
              {translateContent(cat, 'name')}
            </button>
          ))}
        </div>
      )}

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const qty = getItemQuantity(item.id);
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden"
            >
              {item.image_url && (
                <div className="h-48 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={translateContent(item, 'name')}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    {translateContent(item, 'name')}
                  </h3>
                  <span className="text-primary-600 font-bold">
                    {formatCurrency(item.price, currency)}
                  </span>
                </div>
                {item.description && (
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                    {translateContent(item, 'description')}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  {qty > 0 ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-bold">{qty}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="p-2 rounded-full bg-primary-600 text-white hover:bg-primary-700"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No items available in this category
        </div>
      )}
    </div>
  );
}

// ============================================
// Session List Component for session_access modules
// ============================================
function SessionListComponent({ module, props }: { module: Module; props: BlockProps }) {
  const t = useTranslations('pool');
  const tCommon = useTranslations('common');
  const { translateContent } = useContentTranslation();
  const currency = useSettingsStore((s) => s.currency);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions', module.id, selectedDate],
    queryFn: () => api.get(`/${module.slug}/sessions`, { params: { date: selectedDate } }),
  });

  const sessions: PoolSession[] = data?.data?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">
        Failed to load sessions
      </div>
    );
  }

  return (
    <div className="w-full h-full px-4 py-8">
      {/* Date Picker */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <Calendar className="w-5 h-5 text-primary-600" />
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
        />
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden border border-slate-100 dark:border-slate-700"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {translateContent(session, 'name')}
                </h3>
                {session.gender && (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${session.gender === 'mixed'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : session.gender === 'female'
                      ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                    {session.gender}
                  </span>
                )}
              </div>

              {session.description && (
                <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">
                  {translateContent(session, 'description')}
                </p>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex items-center text-slate-600 dark:text-slate-400">
                  <Clock className="w-4 h-4 mr-3 text-primary-600" />
                  <span className="text-sm">
                    {session.start_time} - {session.end_time}
                  </span>
                </div>
                <div className="flex items-center text-slate-600 dark:text-slate-400">
                  <Users className="w-4 h-4 mr-3 text-primary-600" />
                  <span className="text-sm">
                    {session.available_spots || session.capacity} spots available
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <span className="text-2xl font-bold text-primary-600">
                    {formatCurrency(session.adult_price || session.price, currency)}
                  </span>
                  <span className="text-slate-500 text-sm ml-1">/person</span>
                </div>
                <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                  Book Now
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No sessions available for this date
        </div>
      )}
    </div>
  );
}

// ============================================
// Booking Calendar Component for multi_day_booking modules
// ============================================
function BookingCalendarComponent({ module, props }: { module: Module; props: BlockProps }) {
  const tCommon = useTranslations('common');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: availabilityResponse } = useQuery({
    queryKey: ['module-availability', module.slug, startDate, endDate],
    queryFn: () => api.get(`/${module.slug}/availability`, { params: { startDate, endDate } }),
    retry: 1,
  });

  const blockedDates: string[] = availabilityResponse?.data?.data?.blockedDates || [];
  const dateRows = Array.from({ length: 30 }).map((_, idx) => {
    const d = new Date(Date.now() + idx * 24 * 60 * 60 * 1000);
    const iso = d.toISOString().split('T')[0];
    return {
      date: iso,
      available: !blockedDates.includes(iso),
    };
  });

  return (
    <div className="w-full h-full px-4 py-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 max-w-2xl mx-auto">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 text-center">
          {props.title || 'Select Your Dates'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Check-in Date
            </label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Check-out Date
            </label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn || new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
            />
          </div>
        </div>

        <button
          disabled={!checkIn || !checkOut}
          className="w-full mt-6 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Search Availability
        </button>

        <div className="mt-6">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Next 30 days</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {dateRows.map((row) => (
              <button
                key={row.date}
                type="button"
                onClick={() => row.available && setCheckIn(row.date)}
                className={`px-2 py-1 rounded text-xs border ${
                  row.available
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-600 cursor-not-allowed'
                }`}
                disabled={!row.available}
                title={row.available ? 'Available' : 'Unavailable'}
              >
                {row.date}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Form Container Component
// ============================================
function FormContainerComponent({ module, block, props }: { module: Module; block: UIBlock; props: BlockProps }) {
  const tCommon = useTranslations('common');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { formAction } = props;
      let subject = 'Contact Form Submission';
      let message = '';

      if (formAction === 'reservation') {
        subject = 'Reservation Request';
        message = `Requested Date: ${formData.date}\nGuests: ${formData.guests}\nNotes: ${formData.notes || 'None'}`;
      } else if (formAction === 'feedback') {
        subject = 'Customer Feedback';
        message = `Rating: ${formData.rating || 'N/A'}\nFeedback: ${formData.feedback}`;
      } else {
        subject = formData.subject || 'Contact Inquiry';
        message = formData.message;
      }

      await api.post('/messaging/inquiries', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject,
        message,
        moduleId: module.id,
        moduleSlug: module.slug,
        moduleName: module.name,
      });

      toast.success('Your request has been submitted successfully!');
      setFormData({});
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to submit form. Please try again.';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Default form fields based on formAction
  const getDefaultFields = () => {
    switch (props.formAction) {
      case 'reservation':
        return [
          { name: 'name', label: 'Full Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Phone', type: 'tel', required: true },
          { name: 'date', label: 'Preferred Date', type: 'date', required: true },
          { name: 'guests', label: 'Number of Guests', type: 'number', required: true },
          { name: 'notes', label: 'Special Requests', type: 'textarea', required: false },
        ];
      case 'feedback':
        return [
          { name: 'name', label: 'Your Name', type: 'text', required: false },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'rating', label: 'Rating (1-5)', type: 'number', required: true },
          { name: 'feedback', label: 'Your Feedback', type: 'textarea', required: true },
        ];
      default: // contact
        return [
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'subject', label: 'Subject', type: 'text', required: false },
          { name: 'message', label: 'Message', type: 'textarea', required: true },
        ];
    }
  };

  const fields = getDefaultFields();

  return (
    <div className="w-full h-full px-4 py-8">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 max-w-xl mx-auto space-y-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                name={field.name}
                required={field.required}
                value={formData[field.name] || ''}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
                rows={4}
              />
            ) : (
              <input
                type={field.type}
                name={field.name}
                required={field.required}
                value={formData[field.name] || ''}
                onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white"
              />
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {props.submitText || tCommon('submit')}
        </button>
      </form>
    </div>
  );
}

// ============================================
// Testimonials Component
// ============================================
function TestimonialsComponent({ props }: { props: BlockProps }) {
  const staticTestimonials = [
    { name: 'John Doe', avatar: 'JD', text: 'Amazing experience! The staff was super friendly.', rating: 5 },
    { name: 'Sarah Smith', avatar: 'SS', text: 'The pool was crystal clear and very refreshing.', rating: 4 },
    { name: 'Michael Brown', avatar: 'MB', text: 'Best food I have had in a long time. Will come back!', rating: 5 },
  ];

  return (
    <div className="w-full h-full px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {staticTestimonials.slice(0, props.count || 3).map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700"
          >
            <div className="flex items-center gap-2 mb-4 text-amber-400">
              {Array.from({ length: item.rating }).map((_, r) => (
                <Star key={r} className="w-4 h-4 fill-current" />
              ))}
            </div>
            <p className="text-slate-600 dark:text-slate-400 italic mb-6">"{item.text}"</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold">
                {item.avatar}
              </div>
              <span className="font-bold text-slate-900 dark:text-white">{item.name}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Pricing Table Component
// ============================================
function PricingTableComponent({ module, props, isEditing = false, onUpdateProps }: { module: Module; props: BlockProps; isEditing?: boolean; onUpdateProps?: (updates: Record<string, any>) => void }) {
  const { data: pricingRes } = useQuery({
    queryKey: ['module-pricing', module.slug, module.engine_type],
    queryFn: async () => {
      if (module.engine_type === 'platform_entitlement') {
        // Engine E has its own real public plans endpoint — there is no
        // GET /{slug}/plans route for this engine type (that path is for
        // other engines' module-scoped pricing); calling it 404s.
        return api.get('/platform/plans');
      }
      if (module.engine_type === 'shared_capacity_access') {
        return api.get(`/${module.slug}/sessions`);
      }
      return api.get(`/${module.slug}/plans`);
    },
    retry: 1,
  });

  let plans: any[] = [];
  if (module.engine_type === 'platform_entitlement' && pricingRes?.data?.data) {
    plans = (pricingRes.data.data || []).map((p: any) => {
      const fl = p.feature_limits || {};
      // Derive human-readable bullets from the limit keys the admin UI actually stores.
      // Unlimited is stored as -1 (the convention set by the Plans admin form).
      const fmtLimit = (val: number | undefined | null, plural: string, singular: string): string | null => {
        if (val === undefined || val === null) return null;
        return val === -1 ? `Unlimited ${plural}` : `${val} ${val === 1 ? singular : plural}`;
      };
      const derivedFeatures = [
        fmtLimit(fl.maxProperties, 'Properties', 'Property'),
        fmtLimit(fl.maxModules,    'Modules',    'Module'),
        fmtLimit(fl.maxUsers,      'Users',       'User'),
      ].filter(Boolean) as string[];
      return {
        code: p.code,
        name: p.name || 'Plan',
        description: p.description ?? null,
        price: p.price_monthly_cents != null
          ? `$${(p.price_monthly_cents / 100).toFixed(0)}/mo`
          : 'Free',
        // Use derived limits if available; fall back to a `highlights` array if someone
        // manually set one, so legacy / manually-crafted plans still work.
        features: derivedFeatures.length > 0
          ? derivedFeatures
          : (Array.isArray(fl.highlights) ? fl.highlights : []),
        popular: Boolean(fl.popular),
      };
    });
  } else if (module.engine_type === 'shared_capacity_access') {
    plans = (pricingRes?.data?.data || []).map((s: any) => ({
      name: s.name || s.session_name || 'Session',
      price: String(s.price || s.adult_price || 0),
      features: [
        `${s.start_time || ''} - ${s.end_time || ''}`,
        `Capacity: ${s.capacity || 0}`,
      ],
      popular: false,
    }));
  } else if (pricingRes?.data?.data) {
    plans = (pricingRes.data.data || []).map((p: any) => ({
      name: p.name || p.title || 'Plan',
      price: String(p.price || 0),
      features: Array.isArray(p.features) ? p.features : [],
      popular: Boolean(p.popular),
    }));
  } else {
    try {
      plans = typeof props.plans === 'string' ? JSON.parse(props.plans) : (props.plans || []);
    } catch (e) {
      console.error("Failed to parse pricing plans", e);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Engine E (platform_entitlement) checkout — this engine's "special
  // button," same idea as MenuListComponent's Add to Cart or
  // SessionListComponent's Book Now elsewhere in this file. Every other
  // engine type keeps the original static button below, unchanged.
  // Collects email/name/subdomain, POSTs /platform/checkout, redirects
  // to the Stripe url it returns. Requires each plan object to carry a
  // `code` field ('starter' | 'growth' | 'enterprise') matching the
  // `tier` the checkout endpoint expects — see the seed migration.
  // ─────────────────────────────────────────────────────────────────
  const isPlatformEntitlement = module.engine_type === 'platform_entitlement';
  const [checkoutPlan, setCheckoutPlan] = useState<any | null>(null);
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', subdomain: '' });
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const openCheckout = (plan: any) => {
    setCheckoutError(null);
    setCheckoutForm({ name: '', email: '', subdomain: '' });
    setCheckoutPlan(plan);
  };

  const submitCheckout = async () => {
    if (!checkoutPlan?.code) {
      setCheckoutError('This plan is missing a billing code and cannot be checked out yet.');
      return;
    }
    setCheckoutSubmitting(true);
    setCheckoutError(null);
    try {
      const res = await api.post('/platform/checkout', {
        tier: checkoutPlan.code,
        email: checkoutForm.email,
        name: checkoutForm.name,
        subdomain: checkoutForm.subdomain,
      });
      const url = res.data?.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        setCheckoutError('Something went wrong starting checkout. Please try again.');
      }
    } catch (err: any) {
      setCheckoutError(err?.response?.data?.error || 'Could not start checkout. Please try again.');
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  const checkoutFormValid =
    checkoutForm.name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(checkoutForm.email) &&
    /^[a-z0-9-]{2,}$/.test(checkoutForm.subdomain);

  return (
    <div className="w-full h-full px-4 py-12">
      {props.title && <h2 className="text-3xl font-bold text-center mb-12 dark:text-white">{props.title}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan: any, i: number) => (
          <div
            key={i}
            className={`flex flex-col p-8 rounded-3xl border-2 transition-all ${plan.popular
              ? 'border-primary-500 bg-white dark:bg-slate-800 shadow-xl scale-105 z-10'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
              }`}
          >
            {plan.popular && (
              <span className="bg-primary-500 text-white text-xs font-bold uppercase py-1 px-3 rounded-full self-start mb-4">
                Most Popular
              </span>
            )}
            <h3 className="text-2xl font-bold mb-2 dark:text-white">
              <span {...ep(isEditing, (v) => {
                const updated = plans.map((p: any, j: number) => j === i ? { ...p, name: v } : p);
                onUpdateProps?.({ plans: updated });
              })}>{plan.name}</span>
            </h3>
            <div className="text-4xl font-bold mb-6 text-primary-600">
              <span {...ep(isEditing, (v) => {
                const updated = plans.map((p: any, j: number) => j === i ? { ...p, price: v } : p);
                onUpdateProps?.({ plans: updated });
              })}>{plan.price}</span>
            </div>
            {plan.description && (
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 leading-relaxed">
                {plan.description}
              </p>
            )}
            <ul className="space-y-4 mb-8 flex-grow">
              {plan.features.map((feature: string, f: number) => (
                <li key={f} className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                  <span {...ep(isEditing, (v) => {
                    const updatedFeatures = plan.features.map((feat: string, fi: number) => fi === f ? v : feat);
                    const updated = plans.map((p: any, j: number) => j === i ? { ...p, features: updatedFeatures } : p);
                    onUpdateProps?.({ plans: updated });
                  })}>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={isPlatformEntitlement && !isEditing ? () => openCheckout(plan) : undefined}
              className={`w-full py-3 px-6 rounded-xl font-bold transition-all ${plan.popular
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-slate-800 text-white hover:bg-slate-700'
                } ${isPlatformEntitlement && !isEditing ? 'cursor-pointer' : ''}`}
            >
              Get Started
            </button>
          </div>
        ))}
      </div>

      {isPlatformEntitlement && (
        <Dialog open={!!checkoutPlan} onOpenChange={(open) => { if (!open) setCheckoutPlan(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start your {checkoutPlan?.name} trial</DialogTitle>
              <DialogDescription>
                14-day free trial. A card is required to start — Stripe will not charge you until the trial ends.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="checkout-name">Your name</Label>
                <Input
                  id="checkout-name"
                  value={checkoutForm.name}
                  onChange={(e) => setCheckoutForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <Label htmlFor="checkout-email">Email</Label>
                <Input
                  id="checkout-email"
                  type="email"
                  value={checkoutForm.email}
                  onChange={(e) => setCheckoutForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@yourbusiness.com"
                />
              </div>
              <div>
                <Label htmlFor="checkout-subdomain">Subdomain</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="checkout-subdomain"
                    value={checkoutForm.subdomain}
                    onChange={(e) => setCheckoutForm((f) => ({ ...f, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    placeholder="yourbusiness"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.v2platform.com</span>
                </div>
              </div>
              {checkoutError && <p className="text-sm text-red-500">{checkoutError}</p>}
            </div>
            <DialogFooter>
              <Button
                onClick={submitCheckout}
                disabled={checkoutSubmitting || !checkoutFormValid}
                fullWidth
              >
                {checkoutSubmitting ? 'Starting checkout…' : 'Continue to payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============================================
// Class Schedule Component for Session/Activity modules
// ============================================
function ClassScheduleComponent({ module, props }: { module: Module; props: BlockProps }) {
  const t = useTranslations('common');
  const classes = props.classes || [
    { id: '1', name: 'Strength Training', time: '07:00 AM - 08:00 AM', trainer: 'Coach Mike', category: 'Full Body', icon: 'Dumbbell' },
    { id: '2', name: 'Yoga Flow', time: '09:30 AM - 10:30 AM', trainer: 'Coach Sarah', category: 'Mind & Flexibility', icon: 'Sparkles' },
    { id: '3', name: 'HIIT Blast', time: '05:00 PM - 06:00 PM', trainer: 'Coach Alex', category: 'High Intensity', icon: 'Zap' },
    { id: '4', name: 'Pilates Core', time: '06:30 PM - 07:30 PM', trainer: 'Coach Emma', category: 'Core Strength', icon: 'Heart' },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-amber-500 uppercase tracking-wider">{props.subtitle || 'Upcoming Sessions'}</h3>
          <h2 className="text-2xl font-bold text-white">{props.title || 'Next Classes'}</h2>
        </div>
        <button className="text-amber-500 hover:text-amber-400 text-sm font-medium flex items-center gap-1">
          {t('viewFullSchedule') || 'View Full Schedule'} →
        </button>
      </div>

      <div className="space-y-3">
        {classes.map((cls: any, index: number) => (
          <motion.div
            key={cls.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-4 p-4 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 hover:border-amber-500/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-amber-500 text-lg">
              {cls.icon === 'Dumbbell' && '💪'}
              {cls.icon === 'Sparkles' && '✨'}
              {cls.icon === 'Zap' && '⚡'}
              {cls.icon === 'Heart' && '❤️'}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h4 className="font-semibold text-white">{cls.name}</h4>
                <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">{cls.category}</span>
              </div>
              <p className="text-sm text-slate-400">{cls.time} • {cls.trainer}</p>
            </div>

            <button className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium text-sm rounded-lg transition-colors">
              Book
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Calendar Component
// ============================================
function CalendarComponent({ module, props }: { module: Module; props: BlockProps }) {
  const [currentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  const generateDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const days = generateDays();
  const hasEvent = (day: number | null) => day && [4, 12, 15, 19, 26].includes(day);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">{props.title || 'Weekly Schedule'}</h3>
        <div className="flex items-center gap-2 text-slate-300">
          <button className="p-1 hover:bg-slate-700 rounded">←</button>
          <span className="text-sm font-medium">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
          <button className="p-1 hover:bg-slate-700 rounded">→</button>
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => (
            <button
              key={index}
              onClick={() => day && setSelectedDate(day)}
              disabled={!day}
              className={`
                aspect-square flex items-center justify-center rounded-lg text-sm font-medium
                ${!day ? 'invisible' : ''}
                ${selectedDate === day ? 'bg-amber-500 text-slate-900' : ''}
                ${selectedDate !== day && hasEvent(day) ? 'bg-slate-700 text-amber-400 border border-amber-500/50' : ''}
                ${selectedDate !== day && day && !hasEvent(day) ? 'text-slate-300 hover:bg-slate-700' : ''}
              `}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <button className="w-full mt-4 py-2 text-center text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
        View Full Calendar →
      </button>
    </div>
  );
}

// ============================================
// Testimonials Carousel Component
// ============================================
function TestimonialsCarouselComponent({ module, props, isEditing = false, onUpdateProps }: { module: Module; props: BlockProps; isEditing?: boolean; onUpdateProps?: (updates: Record<string, any>) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const testimonials = props.testimonials || [
    { id: '1', text: 'The facilities are top-notch and the trainers are incredibly supportive. A perfect addition to my stay.', name: 'Jessica M.', role: 'Member', rating: 5, avatar: 'JM' },
    { id: '2', text: 'I love starting my day with a session here. The environment is motivating and the classes are amazing!', name: 'David L.', role: 'Member', rating: 5, avatar: 'DL' },
    { id: '3', text: 'From yoga to strength training, everything I need is here. Highly recommend the fitness module!', name: 'Sophia K.', role: 'Member', rating: 5, avatar: 'SK' },
  ];

  const nextSlide = () => setActiveIndex((prev: number) => (prev + 1) % testimonials.length);
  const prevSlide = () => setActiveIndex((prev: number) => (prev - 1 + testimonials.length) % testimonials.length);

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h3 className="text-sm font-semibold text-amber-500 uppercase tracking-wider mb-2">{props.subtitle || 'What Our Members Say'}</h3>
        <h2 className="text-3xl font-bold text-white">{props.title || 'Stronger Together'}</h2>
      </div>

      <div className="relative">
        <button onClick={prevSlide} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-white border border-slate-700 transition-colors">←</button>
        <button onClick={nextSlide} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-white border border-slate-700 transition-colors">→</button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
          {testimonials.map((testimonial: any, index: number) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50"
            >
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-500 fill-current" />
                ))}
              </div>
              <p className="text-slate-300 italic mb-6 leading-relaxed">
                &ldquo;<span {...ep(isEditing, (v) => {
                  const updated = testimonials.map((t: any, i: number) => i === index ? { ...t, text: v } : t);
                  onUpdateProps?.({ testimonials: updated });
                })}>{testimonial.text}</span>&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-amber-500 font-semibold text-sm">{testimonial.avatar}</div>
                <div>
                  <div className="font-semibold text-white">
                    <span {...ep(isEditing, (v) => {
                      const updated = testimonials.map((t: any, i: number) => i === index ? { ...t, name: v } : t);
                      onUpdateProps?.({ testimonials: updated });
                    })}>{testimonial.name}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    <span {...ep(isEditing, (v) => {
                      const updated = testimonials.map((t: any, i: number) => i === index ? { ...t, role: v } : t);
                      onUpdateProps?.({ testimonials: updated });
                    })}>{testimonial.role}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center gap-2 mt-6">
          {testimonials.map((_: any, index: number) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${index === activeIndex ? 'bg-amber-500' : 'bg-slate-600 hover:bg-slate-500'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
