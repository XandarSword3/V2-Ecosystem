// ============================================
// LAYER 1: Section Background System
// ============================================
export type BackgroundType = 'color' | 'gradient' | 'image' | 'video';

export interface BackgroundOverlay {
  color: string;
  opacity: number; // 0-1
}

export interface SectionBackground {
  type: BackgroundType;
  color?: string;
  gradient?: {
    direction: string;
    stops: string[];
  };
  image?: {
    url: string;
    position?: string;
    size?: 'cover' | 'contain' | string;
    repeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
    attachment?: 'scroll' | 'fixed' | 'local';
  };
  video?: {
    url: string;
    poster?: string;
    muted?: boolean;
    loop?: boolean;
    autoplay?: boolean;
  };
  overlay?: BackgroundOverlay;
}

// ============================================
// LAYER 2: Section Layout Modes
// ============================================
export type SectionLayout =
  | 'full-width'
  | 'contained'
  | 'split-50-50'
  | 'split-60-40'
  | 'split-40-60'
  | 'centered-narrow';

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
  opacity?: number;
  visibility?: 'visible' | 'hidden';
  backdropFilter?: string;
  filter?: string;
  borderWidth?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderColor?: string;
  boxShadow?: string;
  transform?: {
    translateX?: string;
    translateY?: string;
    rotate?: string;
    scale?: number;
    skewX?: string;
    skewY?: string;
  };
  mixBlendMode?:
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'soft-light'
    | 'hard-light'
    | 'color-dodge'
    | 'color-burn'
    | 'difference'
    | 'exclusion'
    | 'hue'
    | 'saturation'
    | 'color'
    | 'luminosity';
}

// ============================================
// LAYER 5: Section Height Control
// ============================================
export type HeightMode = 'auto' | 'fixed' | 'min-height' | 'full-screen' | 'viewport';

export interface SectionHeight {
  mode: HeightMode;
  value?: string;
  minHeight?: string;
  maxHeight?: string;
}

// ============================================
// CORE TYPE DEFINITIONS
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
  | 'hero_v2'
  | 'card_grid'
  | 'stats'
  | 'features'
  | 'cta'
  | 'divider'
  | 'spacer'
  | 'class_schedule'
  | 'calendar'
  | 'testimonials_carousel'
  | 'section';

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
  opacity?: number;
  backdropFilter?: string;
  filter?: string;
  borderWidth?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  borderColor?: string;
  boxShadow?: string;
  transform?: string;
  mixBlendMode?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  textDecoration?: 'none' | 'underline' | 'line-through' | 'overline';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: string;
  letterSpacing?: string;
  // Visibility (used by LayersPanel eye toggle)
  visibility?: 'visible' | 'hidden';
}

export interface BlockPosition {
  x?: number;
  y?: number;
  z?: number;
  width?: string;
  height?: string;
  rotation?: number;
  scale?: number;
}

export type CanvasMode = 'stack' | 'freeform';

// ============================================
// ALIGNMENT TYPES (Phase 1 multi-select)
// ============================================
export type AlignmentDirection =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom';

// ============================================
// EXTENDED UIBLOCK — 5 layers + Phase 1 fields
// ============================================
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

  // LAYER 3: Element Layers
  layers?: ElementLayer[];

  // LAYER 5: Section Height Control
  sectionHeight?: SectionHeight;

  // Freeform canvas positioning
  position?: BlockPosition;

  // Phase 1: LayersPanel controls
  locked?: boolean;            // prevents canvas selection/drag when true
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
  selectedLayerId?: string | null;
  history: UIBlock[][];
  historyIndex: number;
}
