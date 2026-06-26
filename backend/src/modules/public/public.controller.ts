import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index';

/**
 * Get public site settings
 */
export async function getSettings(req: Request, res: Response) {
    try {
        const supabase = getSupabase();

        // Property context comes ONLY from req.property, attached by
        // resolveProperty (mounted in app.ts ahead of this router). That
        // middleware derives property from the request itself —
        // X-Property-Slug (set by frontend middleware from the Host header)
        // or the single-property/single-tenant fallback — never from a
        // client-sent x-property-id header. See CONTEXT.md, "Public/Admin
        // Property Context Contamination" (session 7-9) for why a
        // client-trusted header here was a real bug: it let an admin's
        // localStorage-cached activePropertyId leak into what the public
        // storefront rendered.
        let resolvedPropertyId = req.property?.id;

        // When no property was resolved by middleware (e.g. localhost with
        // multiple properties and no tenant/slug to disambiguate), fall back
        // to the default property so branding still works in development and
        // single-deployment scenarios.
        if (!resolvedPropertyId) {
            const { data: defaultProp } = await supabase
                .from('properties')
                .select('id')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
            if (defaultProp) {
                resolvedPropertyId = defaultProp.id;
                logger.info('Public controller - no property resolved, using default property', { propertyId: resolvedPropertyId });
            }
        }

        let settings: Array<{ key: string; value: unknown }> = [];

        if (resolvedPropertyId) {
            try {
                const { getEffectiveSettings } = await import('../multi-property/settings-resolution.service.js');
                const resolved = await getEffectiveSettings(resolvedPropertyId);
                settings = resolved.map(s => ({ key: s.key, value: s.value }));
            } catch (err) {
                logger.error('Public controller - failed to resolve property settings, falling back to global:', err);
                const { data } = await supabase.from('site_settings').select('key, value');
                settings = data || [];
            }
        } else {
            const { data } = await supabase.from('site_settings').select('key, value');
            settings = data || [];
        }

        // Build response from database settings
        const result: Record<string, unknown> = {
            theme: 'default',
            contact: { email: null }
        };

        if (settings) {
            for (const setting of settings) {
                if (setting.key === 'appearance' && setting.value && typeof setting.value === 'object') {
                    const appearance = setting.value as Record<string, unknown>;
                    if (appearance.theme) result.theme = appearance.theme;
                    if (appearance.themeColors) result.themeColors = appearance.themeColors;
                    if (appearance.weatherEffect) result.weatherEffect = appearance.weatherEffect;
                    if (appearance.showWeatherWidget !== undefined) result.showWeatherWidget = appearance.showWeatherWidget;
                    if (appearance.weatherLocation) result.weatherLocation = appearance.weatherLocation;
                    if (appearance.animationsEnabled !== undefined) result.animationsEnabled = appearance.animationsEnabled;
                    if (appearance.reducedMotion !== undefined) result.reducedMotion = appearance.reducedMotion;
                    if (appearance.soundEnabled !== undefined) result.soundEnabled = appearance.soundEnabled;
                    // Brand & Identity fields
                    if (appearance.logoUrl) result.logoUrl = appearance.logoUrl;
                    if (appearance.logoDarkUrl) result.logoDarkUrl = appearance.logoDarkUrl;
                    if (appearance.faviconUrl) result.faviconUrl = appearance.faviconUrl;
                    if (appearance.logoMaxWidth) result.logoMaxWidth = appearance.logoMaxWidth;
                    if (appearance.fontHeading) result.fontHeading = appearance.fontHeading;
                    if (appearance.fontBody) result.fontBody = appearance.fontBody;
                    if (appearance.fontScale) result.fontScale = appearance.fontScale;
                    if (appearance.headingTracking) result.headingTracking = appearance.headingTracking;
                    if (appearance.borderRadius) result.borderRadius = appearance.borderRadius;
                    if (appearance.density) result.density = appearance.density;
                    if (appearance.glassmorphism) result.glassmorphism = appearance.glassmorphism;
                }
                if (setting.key === 'branding.colors' && setting.value && typeof setting.value === 'object') {
                    const colors = setting.value as Record<string, string>;
                    result.themeColors = {
                        ...(result.themeColors as any || {}),
                        primary: colors.primaryColor,
                        secondary: colors.secondaryColor,
                        accent: colors.accentColor,
                        border: colors.borderColor,
                    };
                }
                if (setting.key === 'branding.fonts' && setting.value && typeof setting.value === 'object') {
                    const fonts = setting.value as Record<string, string>;
                    if (fonts.headingFont) result.fontHeading = fonts.headingFont;
                    if (fonts.bodyFont) result.fontBody = fonts.bodyFont;
                    if (fonts.fontScale) result.fontScale = fonts.fontScale;
                    if (fonts.headingTracking) result.headingTracking = fonts.headingTracking;
                }
                if (setting.key === 'branding.identity' && setting.value && typeof setting.value === 'object') {
                    const identity = setting.value as Record<string, unknown>;
                    if (identity.logoUrl) result.logoUrl = identity.logoUrl;
                    if (identity.logoDarkUrl) result.logoDarkUrl = identity.logoDarkUrl;
                    if (identity.faviconUrl) result.faviconUrl = identity.faviconUrl;
                    if (identity.logoMaxWidth) result.logoMaxWidth = identity.logoMaxWidth;
                }
                if (setting.key === 'branding.style' && setting.value && typeof setting.value === 'object') {
                    const style = setting.value as Record<string, unknown>;
                    if (style.borderRadius) result.borderRadius = style.borderRadius;
                    if (style.density) result.density = style.density;
                    if (style.glassmorphism) result.glassmorphism = style.glassmorphism;
                }
                if (setting.key === 'contact' && setting.value && typeof setting.value === 'object') {
                    const contact = setting.value as Record<string, unknown>;
                    result.contact = setting.value;
                    if (contact.phone) result.phone = contact.phone;
                    if (contact.email) result.email = contact.email;
                    if (contact.address) result.address = contact.address;
                }
                if (setting.key === 'general' && setting.value && typeof setting.value === 'object') {
                    const general = setting.value as Record<string, unknown>;
                    const name = general.siteName || general.businessName || general.resortName;
                    if (name) {
                        result.siteName = name;
                        result.resortName = name;
                    }
                    if (general.tagline) result.tagline = general.tagline;
                    if (general.description) result.description = general.description;
                }
                if (setting.key === 'homepage' && setting.value) result.homepage = setting.value;
                if (setting.key === 'footer' && setting.value) result.footer = setting.value;
                if (setting.key === 'navbar' && setting.value) result.navbar = setting.value;
                if (setting.key === 'hours' && setting.value && typeof setting.value === 'object') {
                    const hours = setting.value as Record<string, unknown>;
                    result.hours = setting.value;
                    if (hours.poolHours) result.poolHours = hours.poolHours;
                    if (hours.restaurantHours) result.restaurantHours = hours.restaurantHours;
                    if (hours.receptionHours) result.receptionHours = hours.receptionHours;
                }
                if (setting.key === 'tax_configuration' && setting.value && typeof setting.value === 'object') {
                    const taxConfig = setting.value as Record<string, unknown>;
                    if (taxConfig.global_rate !== undefined) {
                        result.taxRate = Number(taxConfig.global_rate);
                    } else if (taxConfig.default_rate !== undefined) {
                        result.taxRate = Number(taxConfig.default_rate) / 100;
                    }
                }
                if (setting.key === 'order_configuration' && setting.value && typeof setting.value === 'object') {
                    const orderConfig = setting.value as Record<string, unknown>;
                    if (orderConfig.serviceChargeRate !== undefined) result.serviceChargeRate = Number(orderConfig.serviceChargeRate);
                    if (orderConfig.deliveryFee !== undefined) result.deliveryFee = Number(orderConfig.deliveryFee);
                }
            }
        }

        // Settings can change at any time via the admin CMS. Without an explicit
        // Cache-Control header, Express's default ETag behaviour causes browsers
        // to serve stale 304s indefinitely — the ETag is computed from the last
        // response body, not the live DB state, so a DB change is invisible until
        // the browser decides to fully re-request on its own. no-cache forces a
        // revalidation on every request while still allowing the browser to use
        // its cache if the server confirms nothing changed (i.e. a true 304).
        // In practice this means the storefront always sees fresh settings.
        res.set('Cache-Control', 'no-cache');
        res.json(result);
    } catch (error) {
        logger.error('Public controller - error:', error);
        res.json({
            theme: 'default',
            contact: { email: null }
        });
    }
}

/**
 * Get live weather data
 */
export async function getWeather(req: Request, res: Response) {
    try {
        const location = req.query.location as string || 'New York';
        const apiKey = process.env.OPENWEATHER_API_KEY || process.env.WEATHER_API_KEY;

        // Use demo data if no key
        if (!apiKey) {
            return res.json({
                success: true,
                data: {
                    temperature: 24, feels_like: 26, humidity: 65, wind_speed: 12, visibility: 10,
                    condition: 'Partly Cloudy', description: 'Demo weather data', icon: 'cloud-sun', location
                }
            });
        }

        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
        const weatherRes = await fetch(weatherUrl);

        if (!weatherRes.ok) throw new Error('Weather API request failed');

        const data = await weatherRes.json() as any;
        res.json({
            success: true,
            data: {
                temperature: data.main?.temp || 20,
                feels_like: data.main?.feels_like || 20,
                humidity: data.main?.humidity || 50,
                wind_speed: data.wind?.speed ? data.wind.speed * 3.6 : 0,
                visibility: data.visibility ? data.visibility / 1000 : 10,
                condition: data.weather?.[0]?.main || 'Unknown',
                description: data.weather?.[0]?.description || '',
                icon: data.weather?.[0]?.icon || '',
                location: data.name || location
            }
        });
    } catch (error) {
        res.json({
            success: true,
            data: {
                temperature: 24, feels_like: 26, humidity: 65, wind_speed: 12, visibility: 10,
                condition: 'Partly Cloudy', description: 'Weather data unavailable', icon: 'cloud-sun',
                location: (req.query.location as string) || 'Business Location'
            }
        });
    }
}

/**
 * Get tax settings
 */
export async function getTaxSettings(req: Request, res: Response) {
    try {
        const supabase = getSupabase();
        const { data } = await supabase.from('site_settings').select('value').eq('key', 'tax_configuration').single();

        if (data?.value) {
            const stored = data.value;
            if (stored.global_rate !== undefined && stored.default_rate === undefined) {
                stored.default_rate = Math.round(stored.global_rate * 100);
            }
            res.json({ success: true, data: stored });
        } else {
            res.json({
                success: true,
                data: { default_rate: 11, global_rate: 0.11, taxIncluded: false, taxName: 'VAT', taxCategories: [] }
            });
        }
    } catch {
        res.json({
            success: true,
            data: { default_rate: 11, global_rate: 0.11, taxIncluded: false, taxName: 'VAT', taxCategories: [] }
        });
    }
}

/**
 * Update tax settings
 */
export async function updateTaxSettings(req: Request, res: Response) {
    try {
        const supabase = getSupabase();
        const body = req.body;
        if (body.default_rate !== undefined && body.global_rate === undefined) {
            body.global_rate = Number(body.default_rate) / 100;
        }
        body.updated_at = new Date().toISOString();
        await supabase.from('site_settings').upsert({ key: 'tax_configuration', value: body }, { onConflict: 'key' });
        res.json({ success: true, message: 'Tax settings updated' });
    } catch (error) {
        logger.error('Failed to update tax settings:', error);
        res.status(500).json({ success: false, error: 'Failed to update tax settings' });
    }
}
