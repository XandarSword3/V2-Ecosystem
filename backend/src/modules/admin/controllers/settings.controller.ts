/**
 * Settings Controller
 * Handles site settings and configuration
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection';
import { emitToAll } from '../../../socket/index';
import { logActivity } from '../../../utils/activityLogger';
import { logger } from '../../../utils/logger.js';

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();

    // Get all settings from database (existing schema uses 'key' and 'value' columns)
    const { data: settings, error } = await supabase
      .from('site_settings')
      .select('key, value');

    if (error) throw error;

    // Combine all settings into a flat object
    const combinedSettings: Record<string, unknown> = {};
    (settings || []).forEach((s: { key: string; value: unknown }) => {
      // Store keyed setting
      combinedSettings[s.key] = s.value;
    });

    // Flatten nested settings keys into root to match default response structure
    // This supports frontend expecting flat properties (e.g. resortName at root)
    const nestedKeys = ['appearance', 'general', 'contact', 'hours', 'chalets', 'pool', 'legal'];
    nestedKeys.forEach(key => {
      if (combinedSettings[key] && typeof combinedSettings[key] === 'object') {
        Object.assign(combinedSettings, combinedSettings[key] as object);
      }
    });

    // Map mismatched keys to preserve default schema (DB uses shorter names in some groups)
    const chalets = combinedSettings.chalets as Record<string, unknown> | undefined;
    if (chalets) {
      combinedSettings.chaletCheckIn = (combinedSettings as Record<string, unknown>).checkIn || chalets.checkIn;
      combinedSettings.chaletCheckOut = (combinedSettings as Record<string, unknown>).checkOut || chalets.checkOut;
      combinedSettings.chaletDeposit = (combinedSettings as Record<string, unknown>).depositPercent || chalets.depositPercent;
    }

    const pool = combinedSettings.pool as Record<string, unknown> | undefined;
    if (pool) {
      combinedSettings.poolAdultPrice = (combinedSettings as Record<string, unknown>).adultPrice || pool.adultPrice;
      combinedSettings.poolChildPrice = (combinedSettings as Record<string, unknown>).childPrice || pool.childPrice;
      combinedSettings.poolInfantPrice = (combinedSettings as Record<string, unknown>).infantPrice || pool.infantPrice;
      combinedSettings.poolCapacity = (combinedSettings as Record<string, unknown>).capacity || pool.capacity;
    }

    // Ensure core sections exist even on sparse/legacy seed data.
    const requiredSections = ['general', 'payments', 'appearance', 'contact', 'hours', 'chalets', 'pool', 'legal'];
    requiredSections.forEach((section) => {
      if (!combinedSettings[section] || typeof combinedSettings[section] !== 'object') {
        combinedSettings[section] = {};
      }
    });

    const general = combinedSettings.general as Record<string, unknown>;
    const payments = combinedSettings.payments as Record<string, unknown>;

    // Compatibility defaults used by admin tests and frontend settings consumers.
    const resolvedCurrency = (combinedSettings as Record<string, unknown>).currency
      || general.currency
      || payments.currency
      || 'USD';
    const resolvedResortName = (combinedSettings as Record<string, unknown>).resortName
      || general.resortName
      || general.businessName
      || 'V2 Resort';

    combinedSettings.general = {
      businessName: resolvedResortName,
      resortName: resolvedResortName,
      currency: resolvedCurrency,
      ...general,
    };
    combinedSettings.payments = {
      currency: resolvedCurrency,
      ...payments,
    };
    combinedSettings.currency = resolvedCurrency;
    combinedSettings.resortName = resolvedResortName;

    res.json({ success: true, data: combinedSettings });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const settings = req.body;
    const userId = req.user?.userId;

    // Helper to check if an object has any non-undefined values
    const hasValidData = (obj: Record<string, unknown>) => 
      Object.values(obj).some(v => v !== undefined);

    // Helper to filter out undefined values from an object
    const filterUndefined = (obj: Record<string, unknown>) => 
      Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));

    const updates: { key: string; value: unknown }[] = [];

    // Generic key/value payload shape used by admin clients and phase2 harness.
    if (typeof settings.key === 'string' && settings.value !== undefined) {
      updates.push({ key: settings.key, value: settings.value });
    }

    // Appearance settings (theme, weather, animations)
    const appearanceData = {
      theme: settings.theme,
      themeColors: settings.themeColors,
      animationsEnabled: settings.animationsEnabled,
      reducedMotion: settings.reducedMotion,
      soundEnabled: settings.soundEnabled,
      showWeatherWidget: settings.showWeatherWidget,
      weatherLocation: settings.weatherLocation,
      weatherEffect: settings.weatherEffect,
    };
    if (hasValidData(appearanceData)) {
      const { data: existingAppearance } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'appearance')
        .single();
      
      const mergedAppearance = {
        ...(existingAppearance?.value || {}),
        ...filterUndefined(appearanceData)
      };
      updates.push({ key: 'appearance', value: mergedAppearance });
    }

    // General settings
    const generalData = {
      resortName: settings.resortName,
      tagline: settings.tagline,
      description: settings.description,
    };
    if (hasValidData(generalData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'general').single();
      updates.push({ key: 'general', value: { ...(existing?.value || {}), ...filterUndefined(generalData) } });
    }

    // Contact settings
    const contactData = {
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
    };
    if (hasValidData(contactData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'contact').single();
      updates.push({ key: 'contact', value: { ...(existing?.value || {}), ...filterUndefined(contactData) } });
    }

    // Hours settings
    const hoursData = {
      poolHours: settings.poolHours,
      restaurantHours: settings.restaurantHours,
      receptionHours: settings.receptionHours,
    };
    if (hasValidData(hoursData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'hours').single();
      updates.push({ key: 'hours', value: { ...(existing?.value || {}), ...filterUndefined(hoursData) } });
    }

    // Chalet settings
    const chaletData = {
      checkIn: settings.chaletCheckIn,
      checkOut: settings.chaletCheckOut,
      depositPercent: settings.chaletDeposit,
      cancellationPolicy: settings.cancellationPolicy,
    };
    if (hasValidData(chaletData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'chalets').single();
      updates.push({ key: 'chalets', value: { ...(existing?.value || {}), ...filterUndefined(chaletData) } });
    }

    // Pool settings
    const poolData = {
      adultPrice: settings.poolAdultPrice,
      childPrice: settings.poolChildPrice,
      infantPrice: settings.poolInfantPrice,
      capacity: settings.poolCapacity,
    };
    if (hasValidData(poolData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'pool').single();
      updates.push({ key: 'pool', value: { ...(existing?.value || {}), ...filterUndefined(poolData) } });
    }

    // Legal settings
    const legalData = {
      privacyPolicy: settings.privacyPolicy,
      termsOfService: settings.termsOfService,
      refundPolicy: settings.refundPolicy,
    };
    if (hasValidData(legalData)) {
      const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'legal').single();
      updates.push({ key: 'legal', value: { ...(existing?.value || {}), ...filterUndefined(legalData) } });
    }

    // CMS settings - homepage, footer, navbar (these come as complete objects)
    if (settings.homepage) {
      updates.push({ key: 'homepage', value: settings.homepage });
    }
    if (settings.footer) {
      updates.push({ key: 'footer', value: settings.footer });
    }
    if (settings.navbar) {
      updates.push({ key: 'navbar', value: settings.navbar });
    }

    // Perform all updates
    for (const update of updates) {
      const timestamp = new Date().toISOString();
      let { error } = await supabase
        .from('site_settings')
        .upsert(
          {
            key: update.key,
            value: update.value,
            updated_at: timestamp,
            updated_by: userId,
          },
          { onConflict: 'key' }
        );

      // Compatibility fallback for legacy schemas that don't expose audit columns.
      if (error && /updated_by|schema cache|column/i.test(String(error.message || error.details || ''))) {
        ({ error } = await supabase
          .from('site_settings')
          .upsert(
            {
              key: update.key,
              value: update.value,
              updated_at: timestamp,
            },
            { onConflict: 'key' }
          ));
      }

      if (error && /updated_at|schema cache|column/i.test(String(error.message || error.details || ''))) {
        ({ error } = await supabase
          .from('site_settings')
          .upsert(
            {
              key: update.key,
              value: update.value,
            },
            { onConflict: 'key' }
          ));
      }

      if (error) {
        logger.error(`Failed to update ${update.key}:`, error);
        throw error;
      }
    }

    // Emit socket event for real-time updates
    const updatedCategories = updates.map(u => u.key);
    const flattenedSettings: Record<string, unknown> = {};
    for (const update of updates) {
      if (typeof update.value === 'object' && !Array.isArray(update.value)) {
        Object.assign(flattenedSettings, update.value as object);
      }
    }
    emitToAll('settings.updated', flattenedSettings);

    await logActivity({
      user_id: userId!,
      action: 'UPDATE_SETTINGS',
      resource: `settings:${updatedCategories.join(',')}`,
      new_value: settings
    });

    res.json({
      success: true,
      message: 'Settings saved successfully',
      data: flattenedSettings,
      updatedCategories,
    });
});
// FIX: Iteration 26 - Dedicated homepage settings endpoints (frontend calls /admin/settings/homepage)
export const getHomepageSettings = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'homepage')
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Failed to fetch homepage settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch homepage settings' });
  }

  res.json({ success: true, data: data?.value || {} });
});

export const updateHomepageSettings = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const homepageData = req.body;

  const { error } = await supabase
    .from('site_settings')
    .upsert({
      key: 'homepage',
      value: homepageData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (error) {
    logger.error('Failed to update homepage settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to save homepage settings' });
  }

  emitToAll('settings.updated', { homepage: homepageData });

  await logActivity({
    user_id: (req.user as any)?.userId || 'system',
    action: 'UPDATE_SETTINGS',
    resource: 'settings:homepage',
    new_value: homepageData,
  });

  res.json({ success: true, message: 'Homepage settings saved successfully' });
});

// Tax settings endpoints
export const getTaxSettings = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'tax_configuration')
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Failed to fetch tax settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch tax settings' });
  }

  res.json({ success: true, data: data?.value || null });
});

export const updateTaxSettings = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const taxData = req.body;

  const { error } = await supabase
    .from('site_settings')
    .upsert({
      key: 'tax_configuration',
      value: taxData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (error) {
    logger.error('Failed to update tax settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to save tax settings' });
  }

  emitToAll('settings.updated', { tax: taxData });

  await logActivity({
    user_id: (req.user as any)?.userId || 'system',
    action: 'UPDATE_SETTINGS',
    resource: 'settings:tax',
    new_value: taxData,
  });

  res.json({ success: true, message: 'Tax settings saved successfully' });
});