export type ModuleTemplateType = 'menu_service' | 'multi_day_booking' | 'session_access' | 'subscription' | 'membership_access';

export interface TemplatePermissionPreset {
  view: boolean;
  order: boolean;
  manage: boolean;
  admin: boolean;
}

export const TEMPLATE_PERMISSION_PRESETS: Record<ModuleTemplateType, TemplatePermissionPreset> = {
  menu_service: { view: true, order: true, manage: true, admin: true },
  multi_day_booking: { view: true, order: true, manage: true, admin: true },
  session_access: { view: true, order: true, manage: true, admin: true },
  subscription: { view: true, order: true, manage: true, admin: true },
  membership_access: { view: true, order: true, manage: true, admin: true },
};

export function buildModulePermissionRows(moduleSlug: string, templateType: string): string[] {
  const normalizedType = (templateType in TEMPLATE_PERMISSION_PRESETS
    ? templateType
    : 'session_access') as ModuleTemplateType;
  const preset = TEMPLATE_PERMISSION_PRESETS[normalizedType];
  const permissions: string[] = [];

  if (preset.view) permissions.push(`module:${moduleSlug}:view`);
  if (preset.order) permissions.push(`module:${moduleSlug}:order`);
  if (preset.manage) permissions.push(`module:${moduleSlug}:manage`);
  if (preset.admin) permissions.push(`module:${moduleSlug}:admin`);

  return permissions;
}
