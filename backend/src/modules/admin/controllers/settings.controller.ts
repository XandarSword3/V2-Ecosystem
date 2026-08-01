/**
 * Settings Controller
 * Handles site settings and configuration with multi-property tenant isolation support
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection';
import { emitToAll } from '../../../socket/index';
import { logActivity } from '../../../utils/activityLogger';
import { logger } from '../../../utils/logger.js';

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    // Only use propertyId set by middleware (validated UUID). Never read the raw
    // x-property-id header directly — an invalid UUID would be truthy and silently
    // route all reads through the multi-property path, returning empty results.
    const propertyId = (req as any).propertyId as string | undefined;

    // Combine all settings into a flat object
    const combinedSettings: Record<string, unknown> = {};

    if (propertyId) {
      // Multi-property settings resolution (property -> group -> system defaults cascade)
      try {
        const { getEffectiveSettings, resolveSettings } = await import('../../multi-property/settings-resolution.service.js');
        const resolvedSettings = await getEffectiveSettings(propertyId);
        resolvedSettings.forEach(s => {
          combinedSettings[s.key] = s.value;
        });
        
        // Fetch and merge branding sections
        const brandingSections = ['identity', 'colors', 'fonts', 'style'] as const;
        const brandingKeys = brandingSections.map(s => `branding.${s}`);
        const resolvedBranding = await resolveSettings(propertyId, brandingKeys);
        
        // Map branding data to settings fields
        const identity = resolvedBranding['branding.identity']?.value || {};
        const colors = resolvedBranding['branding.colors']?.value || {};
        const fonts = resolvedBranding['branding.fonts']?.value || {};
        const style = resolvedBranding['branding.style']?.value || {};
        
        // Map to themeColors for ThemeInjector
        combinedSettings.themeColors = {
          primary: colors.primaryColor,
          secondary: colors.secondaryColor,
          accent: colors.accentColor,
          border: colors.borderColor,
          borderDark: colors.borderColor,
        };
        
        // Identity fields
        combinedSettings.logoUrl = identity.logoUrl;
        combinedSettings.logoDarkUrl = identity.logoDarkUrl;
        combinedSettings.faviconUrl = identity.faviconUrl;
        combinedSettings.logoMaxWidth = identity.logoMaxWidth;
        
        // Font fields
        combinedSettings.fontHeading = fonts.headingFont;
        combinedSettings.fontBody = fonts.bodyFont;
        combinedSettings.fontScale = fonts.fontScale;
        combinedSettings.headingTracking = fonts.headingTracking;
        
        // Style fields
        combinedSettings.borderRadius = style.borderRadius;
        combinedSettings.density = style.density;
        combinedSettings.glassmorphism = style.glassmorphism;
        
      } catch (err) {
        logger.error('Failed to fetch effective multi-property settings:', err);
      }
    } else {
      // Legacy global site settings
      const { data: settings, error } = await supabase
        .from('site_settings')
        .select('key, value');

      if (error) throw error;

      (settings || []).forEach((s: { key: string; value: unknown }) => {
        combinedSettings[s.key] = s.value;
      });
    }

    // Flatten nested settings keys into root to match default response structure
    const nestedKeys = ['appearance', 'general', 'contact', 'hours', 'legal'];
    nestedKeys.forEach(key => {
      if (combinedSettings[key] && typeof combinedSettings[key] === 'object') {
        Object.assign(combinedSettings, combinedSettings[key] as object);
      }
    });

    // Ensure core sections exist even on sparse/legacy seed data.
    const requiredSections = ['general', 'payments', 'appearance', 'contact', 'hours', 'legal'];
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
    const resolvedSiteName = (combinedSettings as Record<string, unknown>).siteName
      || general.siteName
      || general.businessName
      || 'V2 Ecosystem';

    combinedSettings.general = {
      businessName: resolvedSiteName,
      siteName: resolvedSiteName,
      currency: resolvedCurrency,
      ...general,
    };
    combinedSettings.payments = {
      currency: resolvedCurrency,
      ...payments,
    };
    combinedSettings.currency = resolvedCurrency;
    combinedSettings.siteName = resolvedSiteName;

    res.json({ success: true, data: combinedSettings });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const supabase = getSupabase();
    const settings = req.body;
    const userId = req.user?.userId;
    // Only use propertyId set by middleware (validated UUID). Never read the raw
    // x-property-id header directly — an invalid UUID would be truthy and silently
    // route all writes through the multi-property path, swallow the error in the
    // try/catch, and return 200 while leaving site_settings untouched.
    const propertyId = (req as any).propertyId as string | undefined;

    // Helper to check if an object has any non-undefined values
    const hasValidData = (obj: Record<string, unknown>) => 
      Object.values(obj).some(v => v !== undefined);

    // Helper to filter out undefined values from an object
    const filterUndefined = (obj: Record<string, unknown>) => 
      Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));

    const updates: { key: string; value: unknown }[] = [];
    const changedFields: Record<string, unknown> = {}; // only the fields actually sent, not the merged blob

    // Generic key/value payload shape used by admin clients and phase2 harness.
    if (typeof settings.key === 'string' && settings.value !== undefined) {
      updates.push({ key: settings.key, value: settings.value });
      if (typeof settings.value === 'object' && !Array.isArray(settings.value)) {
        Object.assign(changedFields, settings.value as object);
      } else {
        changedFields[settings.key] = settings.value;
      }
    }

    // Fetch resolution/override helpers if in property context
    let resolveSettingHelper: any;
    let setPropertySettingHelper: any;
    if (propertyId) {
      const resolutionService = await import('../../multi-property/settings-resolution.service.js');
      resolveSettingHelper = resolutionService.resolveSetting;
      setPropertySettingHelper = resolutionService.setPropertySetting;
    }

    // Appearance settings (theme, weather, animations, brand)
    const appearanceData = {
      theme: settings.theme,
      themeColors: settings.themeColors,
      animationsEnabled: settings.animationsEnabled,
      reducedMotion: settings.reducedMotion,
      soundEnabled: settings.soundEnabled,
      showWeatherWidget: settings.showWeatherWidget,
      weatherLocation: settings.weatherLocation,
      weatherEffect: settings.weatherEffect,
      // Brand & Identity fields
      logoUrl: settings.logoUrl,
      logoDarkUrl: settings.logoDarkUrl,
      faviconUrl: settings.faviconUrl,
      logoMaxWidth: settings.logoMaxWidth,
      fontHeading: settings.fontHeading,
      fontBody: settings.fontBody,
      fontScale: settings.fontScale,
      headingTracking: settings.headingTracking,
      borderRadius: settings.borderRadius,
      density: settings.density,
      glassmorphism: settings.glassmorphism,
    };
    if (hasValidData(appearanceData)) {
      let existingAppearanceValue = {};
      if (propertyId) {
        const resolved = await resolveSettingHelper(propertyId, 'appearance', {});
        existingAppearanceValue = resolved?.value || {};
      } else {
        const { data: existingAppearance } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'appearance')
          .single();
        existingAppearanceValue = existingAppearance?.value || {};
      }
      
      const mergedAppearance = {
        ...existingAppearanceValue,
        ...filterUndefined(appearanceData)
      };
      updates.push({ key: 'appearance', value: mergedAppearance });
      Object.assign(changedFields, filterUndefined(appearanceData));
    }

    // General settings
    const generalData = {
      siteName: settings.siteName,
      tagline: settings.tagline,
      description: settings.description,
    };
    if (hasValidData(generalData)) {
      let existingGeneralValue = {};
      if (propertyId) {
        const resolved = await resolveSettingHelper(propertyId, 'general', {});
        existingGeneralValue = resolved?.value || {};
      } else {
        const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'general').single();
        existingGeneralValue = existing?.value || {};
      }
      updates.push({ key: 'general', value: { ...existingGeneralValue, ...filterUndefined(generalData) } });
      Object.assign(changedFields, filterUndefined(generalData));
    }

    // Contact settings
    const contactData = {
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
    };
    if (hasValidData(contactData)) {
      let existingContactValue = {};
      if (propertyId) {
        const resolved = await resolveSettingHelper(propertyId, 'contact', {});
        existingContactValue = resolved?.value || {};
      } else {
        const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'contact').single();
        existingContactValue = existing?.value || {};
      }
      updates.push({ key: 'contact', value: { ...existingContactValue, ...filterUndefined(contactData) } });
      Object.assign(changedFields, filterUndefined(contactData));
    }

    // Hours settings
    const hoursData = {
      receptionHours: settings.receptionHours,
    };
    if (hasValidData(hoursData)) {
      let existingHoursValue = {};
      if (propertyId) {
        const resolved = await resolveSettingHelper(propertyId, 'hours', {});
        existingHoursValue = resolved?.value || {};
      } else {
        const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'hours').single();
        existingHoursValue = existing?.value || {};
      }
      updates.push({ key: 'hours', value: { ...existingHoursValue, ...filterUndefined(hoursData) } });
      Object.assign(changedFields, filterUndefined(hoursData));
    }

    // Legal settings
    const legalData = {
      privacyPolicy: settings.privacyPolicy,
      termsOfService: settings.termsOfService,
      refundPolicy: settings.refundPolicy,
    };
    if (hasValidData(legalData)) {
      let existingLegalValue = {};
      if (propertyId) {
        const resolved = await resolveSettingHelper(propertyId, 'legal', {});
        existingLegalValue = resolved?.value || {};
      } else {
        const { data: existing } = await supabase.from('site_settings').select('value').eq('key', 'legal').single();
        existingLegalValue = existing?.value || {};
      }
      updates.push({ key: 'legal', value: { ...existingLegalValue, ...filterUndefined(legalData) } });
      Object.assign(changedFields, filterUndefined(legalData));
    }

    // CMS settings - homepage, footer, navbar (these come as complete objects)
    if (settings.homepage) {
      updates.push({ key: 'homepage', value: settings.homepage });
      changedFields.homepage = settings.homepage;
    }
    if (settings.footer) {
      updates.push({ key: 'footer', value: settings.footer });
      changedFields.footer = settings.footer;
    }
    if (settings.navbar) {
      updates.push({ key: 'navbar', value: settings.navbar });
      changedFields.navbar = settings.navbar;
    }

    // Perform all updates
    for (const update of updates) {
      const timestamp = new Date().toISOString();
      let error;

      if (propertyId) {
        try {
          await setPropertySettingHelper(propertyId, update.key, update.value, 'general', userId);
        } catch (err: any) {
          error = err;
        }
      } else {
        const res = await supabase
          .from('site_settings')
          .upsert(
            {
              key: update.key,
              value: update.value,
              updated_at: timestamp,
            },
            { onConflict: 'key' }
          );
        error = res.error;
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
    emitToAll('settings.updated', changedFields);

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

// Dedicated homepage settings endpoints
export const getHomepageSettings = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  // Only use propertyId set by middleware (validated UUID). Never read the raw
  // x-property-id header directly — a non-UUID string like "null" would be truthy
  // and silently route all reads through multi-property, returning empty data.
  const propertyId = (req as any).propertyId as string | undefined;

  if (propertyId) {
    try {
      const { resolveSetting } = await import('../../multi-property/settings-resolution.service.js');
      const resolved = await resolveSetting(propertyId, 'homepage', {});
      return res.json({ success: true, data: resolved.value });
    } catch (err) {
      logger.error('Failed to resolve homepage settings for property:', err);
    }
  }

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
  // Only use propertyId set by middleware (validated UUID). Same reason as getHomepageSettings.
  const propertyId = (req as any).propertyId as string | undefined;

  if (propertyId) {
    try {
      const { setPropertySetting } = await import('../../multi-property/settings-resolution.service.js');
      await setPropertySetting(propertyId, 'homepage', homepageData, 'cms', (req.user as any)?.userId);
      
      emitToAll('settings.updated', { homepage: homepageData });

      await logActivity({
        user_id: (req.user as any)?.userId || 'system',
        action: 'UPDATE_SETTINGS',
        resource: 'settings:homepage',
        new_value: homepageData,
      });

      return res.json({ success: true, message: 'Homepage settings saved successfully' });
    } catch (err: any) {
      logger.error('Failed to update homepage settings for property:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to save homepage settings' });
    }
  }

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
  // Only use propertyId set by middleware (validated UUID). Same reason as getHomepageSettings.
  const propertyId = (req as any).propertyId as string | undefined;

  if (propertyId) {
    try {
      const { resolveSetting } = await import('../../multi-property/settings-resolution.service.js');
      const resolved = await resolveSetting(propertyId, 'tax_configuration', {});
      return res.json({ success: true, data: resolved.value || {} });
    } catch (err) {
      logger.error('Failed to resolve tax settings for property:', err);
    }
  }

  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'tax_configuration')
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Failed to fetch tax settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch tax settings' });
  }

  res.json({ success: true, data: data?.value || {} });
});

export const updateTaxSettings = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const taxData = req.body;
  // Only use propertyId set by middleware (validated UUID). Same reason as getHomepageSettings.
  const propertyId = (req as any).propertyId as string | undefined;

  if (propertyId) {
    try {
      const { setPropertySetting } = await import('../../multi-property/settings-resolution.service.js');
      await setPropertySetting(propertyId, 'tax_configuration', taxData, 'finance', (req.user as any)?.userId);

      // Invalidate tax service cache
      try {
        const { taxService } = await import('../../../services/tax.service.js');
        taxService.invalidateCache(propertyId);
      } catch (err) {
        logger.debug('Failed to invalidate tax cache:', err);
      }

      emitToAll('settings.updated', { tax: taxData });

      await logActivity({
        user_id: (req.user as any)?.userId || 'system',
        action: 'UPDATE_SETTINGS',
        resource: 'settings:tax',
        new_value: taxData,
      });

      return res.json({ success: true, message: 'Tax settings saved successfully' });
    } catch (err: any) {
      logger.error('Failed to update tax settings for property:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to save tax settings' });
    }
  }

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

  // Invalidate tax service cache (global config)
  try {
    const { taxService } = await import('../../../services/tax.service.js');
    taxService.invalidateCache();
  } catch (err) {
    logger.debug('Failed to invalidate tax cache:', err);
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

// Order configuration endpoints (service charge, delivery fee) were removed — fees are
// entirely CMS-driven via tax_configuration fee_type rates now. Manage them through
// getTaxSettings/updateTaxSettings above (Admin > Settings > Tax).