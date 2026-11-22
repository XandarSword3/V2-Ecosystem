// Real engine types — the canonical union, defined once in engines/types.ts.
// NOTE ON NAMING: despite the historical name, `ModuleTemplateType` values are
// the canonical engine_type strings; legacy aliases (menu_service,
// session_access, multi_day_booking, etc.) must never appear here — they are
// resolved at the router layer (see engines/types.ts LEGACY aliases and
// LEGACY_ALIASES below).
import type { EngineType } from '../engines/types.js';

export type ModuleTemplateType = EngineType;

export interface TemplatePermissionPreset {
  view: boolean;
  order: boolean;
  manage: boolean;
  admin: boolean;
}

export const TEMPLATE_PERMISSION_PRESETS: Record<ModuleTemplateType, TemplatePermissionPreset> = {
  instant_transaction:       { view: true, order: true, manage: true, admin: true },
  shared_capacity_access:    { view: true, order: true, manage: true, admin: true },
  time_exclusive_reservation:{ view: true, order: true, manage: true, admin: true },
  ongoing_entitlement:       { view: true, order: true, manage: true, admin: true },
  platform_entitlement:      { view: true, order: false, manage: true, admin: true },
};

// Legacy alias → canonical engine type resolution (mirrors dynamic-module.router.ts)
const LEGACY_ALIASES: Record<string, ModuleTemplateType> = {
  menu_service:         'instant_transaction',
  multi_day_booking:    'time_exclusive_reservation',
  session_access:       'shared_capacity_access',
  subscription:         'ongoing_entitlement',
  membership_access:    'ongoing_entitlement',
  class_scheduling:     'shared_capacity_access',
  appointment_booking:  'time_exclusive_reservation',
  saas_subscription:    'platform_entitlement',
};

export function buildModulePermissionRows(moduleSlug: string, engineType: string): string[] {
  // Resolve legacy alias if needed
  const canonical = LEGACY_ALIASES[engineType]
    ?? (engineType in TEMPLATE_PERMISSION_PRESETS ? (engineType as ModuleTemplateType) : null);

  if (!canonical) {
    throw new Error(`Unrecognized module engine type: ${engineType}`);
  }

  const preset = TEMPLATE_PERMISSION_PRESETS[canonical];
  const permissions: string[] = [];

  if (preset.view)   permissions.push(`module:${moduleSlug}:view`);
  if (preset.order)  permissions.push(`module:${moduleSlug}:order`);
  if (preset.manage) permissions.push(`module:${moduleSlug}:manage`);
  if (preset.admin)  permissions.push(`module:${moduleSlug}:admin`);

  return permissions;
}
