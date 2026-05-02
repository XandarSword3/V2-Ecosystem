// ============================================
// LAYER 1: Section Background System
// ============================================
export type BackgroundType = 'color' | 'gradient' | 'image' | 'video';

export interface BackgroundOverlay {
  color: string; // e.g., '#000000' or 'rgba(0,0,0,0.5)'
  opacity: number; // 0-1
}

export interface SectionBackground {
  type: BackgroundType;
  // For color background
  color?: string;
  // For gradient background
  gradient?: {
    direction: string; // 'to right', '135deg', etc.
    stops: string[]; // ['#0ea5e9', '#6366f1', '#8b5cf6']
  };
  // For image background
  image?: {
    url: string;
    position?: string; // 'center', 'top left', etc.
    size?: 'cover' | 'contain' | string;
    repeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
    attachment?: 'scroll' | 'fixed' | 'local';
  };
  // For video background
  video?: {
    url: string;
    poster?: string;
    muted?: boolean;
    loop?: boolean;
    autoplay?: boolean;
  };
  // Overlay for text readability
  overlay?: BackgroundOverlay;
}

// ============================================
// LAYER 2: Section Layout Modes
// ============================================
export type SectionLayout = 'full-width' | 'contained' | 'split-50-50' | 'split-60-40' | 'split-40-60' | 'centered-narrow';

// ============================================
// LAYER 3: Element Positioning
// ============================================
export type PositionType = 'relative' | 'absolute' | 'fixed' | 'sticky';

export interface ElementPosition {
  type: PositionType;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: number;
}

export interface ElementLayer {
  id: string;
  type: 'text' | 'image' | 'button' | 'shape' | 'icon';
  position: ElementPosition;
  size?: {
    width?: string;
    height?: string;
  };
  style?: AdvancedStyle;
  content?: Record<string, any>;
}

// ============================================
// LAYER 4: Advanced Visual Controls
// ============================================
export interface AdvancedStyle extends Omit<UIBlockStyle, 'transform'> {
  // Opacity and visibility
  opacity?: number; // 0-1
  visibility?: 'visible' | 'hidden';

  // Blur and filters
  backdropFilter?: string; // e.g., 'blur(20px)'
  filter?: string; // e.g., 'brightness(1.2) contrast(0.9)'

  // Borders
  borderWidth?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderColor?: string;

  // Shadows
  boxShadow?: string; // e.g., '0 10px 30px rgba(0,0,0,0.15)'

  // Transforms (as object for editor, converted to string for CSS)
  transform?: {
    translateX?: string;
    translateY?: string;
    rotate?: string;
    scale?: number;
    skewX?: string;
    skewY?: string;
  };

  // Blend modes
  mixBlendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light' | 'color-dodge' | 'color-burn' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';
}

// ============================================
// LAYER 5: Section Height Control
// ============================================
export type HeightMode = 'auto' | 'fixed' | 'min-height' | 'full-screen' | 'viewport';

export interface SectionHeight {
  mode: HeightMode;
  value?: string; // e.g., '500px', '100vh', 'min-600px'
  minHeight?: string;
  maxHeight?: string;
}

// ============================================
// CORE TYPE DEFINITIONS (Extended)
// ============================================
export type UIComponentType =
  | 'container'
  | 'hero'
  | 'text_block'
  | 'image'
  | 'button'
  | 'grid'
  | 'menu_list'
  | 'session_list'
  | 'booking_calendar'
  | 'form_container'
  | 'testimonials'
  | 'pricing_table'
  // New glassmorphic components
  | 'hero_v2'
  | 'card_grid'
  | 'stats'
  | 'features'
  | 'cta'
  | 'divider'
  | 'spacer'
  // Gym/Session specific components
  | 'class_schedule'
  | 'calendar'
  | 'testimonials_carousel'
  // Section wrapper for backgrounds
  | 'section';

// Base UIBlockStyle (backward compatible)
export interface UIBlockStyle {
  backgroundColor?: string;
  backgroundImage?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  color?: string;
  height?: string;
  width?: string;
  display?: 'flex' | 'block' | 'grid';
  flexDirection?: 'row' | 'column';
  gap?: string;
  justifyContent?: string;
  alignItems?: string;
  // Extended properties (Layer 4)
  opacity?: number;
  backdropFilter?: string;
  filter?: string;
  borderWidth?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderColor?: string;
  boxShadow?: string;
  transform?: string;
  mixBlendMode?: string;
  // Text formatting (PowerPoint-style)
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  textDecoration?: 'none' | 'underline' | 'line-through' | 'overline';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: string;
  letterSpacing?: string;
}

// Freeform positioning for PowerPoint-style canvas
export interface BlockPosition {
  x?: number;          // left offset in px (or % with unit)
  y?: number;          // top offset in px (or % with unit)
  z?: number;          // z-index for stacking/overlap
  width?: string;      // explicit width (e.g. '300px', '50%')
  height?: string;     // explicit height (e.g. '200px', 'auto')
  rotation?: number;   // degrees of rotation
  scale?: number;      // scale factor (1 = 100%)
}

// Layout mode for the canvas
export type CanvasMode = 'stack' | 'freeform';

// Extended UIBlock with all 5 layers
export interface UIBlock {
  id: string;
  type: UIComponentType;
  label?: string;
  props: Record<string, any>;
  style?: UIBlockStyle;
  children?: UIBlock[];

  // LAYER 1: Section Background
  background?: SectionBackground;

  // LAYER 2: Section Layout
  sectionLayout?: SectionLayout;

  // LAYER 3: Element Layers (for positioned content)
  layers?: ElementLayer[];

  // LAYER 5: Section Height Control
  sectionHeight?: SectionHeight;

  // Freeform positioning (PowerPoint-style canvas)
  position?: BlockPosition;
}

export interface ModuleTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  defaultLayout: UIBlock[];
  baseModuleType: string;
}

export interface ModuleBuilderState {
  activeModuleId: string | null;
  layout: UIBlock[];
  selectedBlockId: string | null;
  selectedLayerId?: string | null; // For Layer 3
  history: UIBlock[][];
  historyIndex: number;
}
