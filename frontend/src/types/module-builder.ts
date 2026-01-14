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
  | 'form_container';

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
}

export interface UIBlock {
  id: string;
  type: UIComponentType;
  label?: string; // For the editor UI
  props: Record<string, any>;
  style?: UIBlockStyle;
  children?: UIBlock[]; // For nested components (containers)
}

export interface ModuleTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  defaultLayout: UIBlock[];
  baseModuleType: string; // 'menu_service' | 'booking_core' etc.
}

export interface ModuleBuilderState {
  activeModuleId: string | null;
  layout: UIBlock[];
  selectedBlockId: string | null;
  history: UIBlock[][]; // For undo/redo
  historyIndex: number;
}
