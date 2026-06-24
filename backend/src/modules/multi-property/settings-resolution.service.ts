/**
 * Settings Resolution Service
 * Implements three-tier settings inheritance: property → group → system
 */

import { getSupabase } from '../../database/connection';
import { logger } from '../../utils/logger';

// Lazy initialisation — avoids calling getSupabase() at import time,
// which breaks unit tests that mock the connection module.
let _supabase: ReturnType<typeof getSupabase> | null = null;
function supabase() {
  if (!_supabase) _supabase = getSupabase();
  return _supabase;
}

export interface ResolvedSetting {
  key: string;
  value: any;
  source: 'property' | 'group' | 'system' | 'default';
  category?: string;
  description?: string;
}

/**
 * Resolve a single setting using the cascade:
 * 1. Property-level override
 * 2. Group-level default
 * 3. System-level default
 * 4. Hardcoded fallback
 */
export async function resolveSetting(
  propertyId: string,
  key: string,
  fallback: any = null
): Promise<ResolvedSetting> {
  // Level 1: Property override
  const { data: propSetting } = await supabase()
    .from('property_settings')
    .select('setting_value')
    .eq('property_id', propertyId)
    .eq('setting_key', key)
    .single();

  if (propSetting) {
    return { key, value: propSetting.setting_value, source: 'property' };
  }

  // Level 2: Group default — find the group this property belongs to
  const { data: membership } = await supabase()
    .from('property_group_members')
    .select('group_id')
    .eq('property_id', propertyId)
    .limit(1)
    .single();

  if (membership?.group_id) {
    const { data: groupSetting } = await supabase()
      .from('group_settings')
      .select('setting_value')
      .eq('group_id', membership.group_id)
      .eq('setting_key', key)
      .single();

    if (groupSetting) {
      return { key, value: groupSetting.setting_value, source: 'group' };
    }
  }

  // Level 3: System default
  const { data: sysSetting } = await supabase()
    .from('system_defaults')
    .select('setting_value')
    .eq('setting_key', key)
    .single();

  if (sysSetting) {
    return { key, value: sysSetting.setting_value, source: 'system' };
  }

  // Level 4: Hardcoded fallback
  return { key, value: fallback, source: 'default' };
}

/**
 * Resolve multiple settings at once for a given property.
 * Returns a map of key → ResolvedSetting.
 */
export async function resolveSettings(
  propertyId: string,
  keys: string[]
): Promise<Record<string, ResolvedSetting>> {
  const results: Record<string, ResolvedSetting> = {};

  // Batch-fetch all three tiers
  const [propResult, memberResult] = await Promise.all([
    supabase()
      .from('property_settings')
      .select('setting_key, setting_value')
      .eq('property_id', propertyId)
      .in('setting_key', keys),
    supabase()
      .from('property_group_members')
      .select('group_id')
      .eq('property_id', propertyId)
      .limit(1)
      .single(),
  ]);

  const propMap = new Map<string, any>();
  (propResult.data || []).forEach(r => propMap.set(r.setting_key, r.setting_value));

  const groupId = memberResult.data?.group_id;

  let groupMap = new Map<string, any>();
  if (groupId) {
    const { data: groupSettings } = await supabase()
      .from('group_settings')
      .select('setting_key, setting_value')
      .eq('group_id', groupId)
      .in('setting_key', keys);
    (groupSettings || []).forEach(r => groupMap.set(r.setting_key, r.setting_value));
  }

  const { data: sysSettings } = await supabase()
    .from('system_defaults')
    .select('setting_key, setting_value')
    .in('setting_key', keys);
  const sysMap = new Map<string, any>();
  (sysSettings || []).forEach(r => sysMap.set(r.setting_key, r.setting_value));

  // Resolve each key through the cascade
  for (const key of keys) {
    if (propMap.has(key)) {
      results[key] = { key, value: propMap.get(key), source: 'property' };
    } else if (groupMap.has(key)) {
      results[key] = { key, value: groupMap.get(key), source: 'group' };
    } else if (sysMap.has(key)) {
      results[key] = { key, value: sysMap.get(key), source: 'system' };
    } else {
      results[key] = { key, value: null, source: 'default' };
    }
  }

  return results;
}

/**
 * Set a property-level setting override.
 */
export async function setPropertySetting(
  propertyId: string,
  key: string,
  value: any,
  category = 'general',
  userId?: string
): Promise<void> {
  const { error } = await supabase()
    .from('property_settings')
    .upsert({
      property_id: propertyId,
      setting_key: key,
      setting_value: value,
      category,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'property_id,setting_key'
    });

  if (error) {
    logger.error('Failed to set property setting', { propertyId, key, error });
    throw new Error(`Failed to set setting: ${error.message}`);
  }
}

/**
 * Set a group-level setting default.
 */
export async function setGroupSetting(
  groupId: string,
  key: string,
  value: any,
  category = 'general',
  userId?: string
): Promise<void> {
  const { error } = await supabase()
    .from('group_settings')
    .upsert({
      group_id: groupId,
      setting_key: key,
      setting_value: value,
      category,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'group_id,setting_key'
    });

  if (error) {
    logger.error('Failed to set group setting', { groupId, key, error });
    throw new Error(`Failed to set setting: ${error.message}`);
  }
}

/**
 * Delete a property-level override (falls back to group → system).
 */
export async function deletePropertySetting(
  propertyId: string,
  key: string
): Promise<void> {
  await supabase()
    .from('property_settings')
    .delete()
    .eq('property_id', propertyId)
    .eq('setting_key', key);
}

/**
 * Get all settings for a property showing the effective value and source.
 *
 * Key discovery uses the UNION of:
 *   1. system_defaults — keys with a global baseline (any tier)
 *   2. property_settings for this property — keys written directly at the
 *      property level that may have no system default (e.g. navbar, footer,
 *      homepage which are per-property CMS settings)
 *
 * This prevents property-level writes from becoming invisible on read just
 * because the key was never seeded into system_defaults.
 */
export async function getEffectiveSettings(
  propertyId: string,
  category?: string
): Promise<ResolvedSetting[]> {
  // Fetch system defaults and property-level keys in parallel
  let sysQuery = supabase()
    .from('system_defaults')
    .select('setting_key, setting_value, category, description');
  if (category) sysQuery = sysQuery.eq('category', category);

  let propQuery = supabase()
    .from('property_settings')
    .select('setting_key, category')
    .eq('property_id', propertyId);
  if (category) propQuery = propQuery.eq('category', category);

  const [{ data: sysDefaults }, { data: propKeys }] = await Promise.all([
    sysQuery,
    propQuery,
  ]);

  // Build unified key set — property keys fill any gaps not covered by system_defaults
  const sysKeySet = new Set((sysDefaults || []).map(s => s.setting_key));
  const allKeys = [...sysKeySet];
  for (const row of propKeys || []) {
    if (!sysKeySet.has(row.setting_key)) {
      allKeys.push(row.setting_key);
    }
  }

  if (allKeys.length === 0) return [];

  const resolved = await resolveSettings(propertyId, allKeys);

  // Attach category and description from sysDefaults where available
  const sysMetaMap = new Map(
    (sysDefaults || []).map(s => [s.setting_key, { category: s.category, description: s.description }])
  );
  for (const key of allKeys) {
    if (resolved[key]) {
      const meta = sysMetaMap.get(key);
      if (meta) {
        resolved[key].category = meta.category;
        resolved[key].description = meta.description;
      }
    }
  }

  return Object.values(resolved);
}
