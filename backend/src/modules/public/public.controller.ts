import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

/**
 * Get public site settings
 */
export async function getSettings(req: Request, res: Response) {
    try {
        const supabase = getSupabase();
        const { data: settings } = await supabase
            .from('site_settings')
            .select('key, value');

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
                    if (general.resortName) result.resortName = general.resortName;
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

        res.json(result);
    } catch (error) {
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
                location: (req.query.location as string) || 'Resort Location'
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
