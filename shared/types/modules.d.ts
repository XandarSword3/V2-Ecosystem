import type { UUID, BaseEntity } from './index';
export type ModuleTemplateType = 'menu_service' | 'booking_core' | 'pool_tickets' | 'custom';
export interface Module extends BaseEntity {
    templateType: ModuleTemplateType;
    name: string;
    nameAr?: string;
    nameFr?: string;
    slug: string;
    description?: string;
    icon: string;
    imageUrl?: string;
    isActive: boolean;
    sortOrder: number;
    settings: Record<string, unknown>;
}
export type UIComponentType = 'container' | 'hero' | 'text_block' | 'image' | 'button' | 'grid' | 'menu_list' | 'session_list' | 'booking_calendar' | 'form_container' | 'testimonials' | 'pricing_table';
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
export interface ModuleBlock {
    id: string;
    type: UIComponentType;
    label?: string;
    props: Record<string, unknown>;
    style?: UIBlockStyle;
    children?: ModuleBlock[];
}
export interface ModuleTemplate {
    id: UUID;
    name: string;
    description: string;
    thumbnail?: string;
    defaultLayout: ModuleBlock[];
    baseModuleType: ModuleTemplateType;
}
export interface ModuleSettings extends BaseEntity {
    moduleId?: UUID;
    settingKey: string;
    settingValue: unknown;
    description?: string;
}
//# sourceMappingURL=modules.d.ts.map