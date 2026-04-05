'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  Eye,
  Loader2
} from 'lucide-react';
import { useSiteSettings } from '@/lib/settings-context';

interface WeatherData {
  temperature: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  visibility: number;
  condition: string;
  description: string;
  icon: string;
  location: string;
  isDemo?: boolean; // FIX Iter-12: flag for demo/fallback data
}

interface WeatherWidgetProps {
  variant?: 'compact' | 'full' | 'header';
  className?: string;
}

// Weather condition to icon mapping
function getWeatherIcon(condition: string, size = 'w-8 h-8') {
  const conditionLower = condition.toLowerCase();

  if (conditionLower.includes('thunder') || conditionLower.includes('storm')) {
    return <CloudLightning className={`${size} text-yellow-500`} />;
  }
  if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
    return <CloudRain className={`${size} text-blue-400`} />;
  }
  if (conditionLower.includes('snow') || conditionLower.includes('sleet')) {
    return <CloudSnow className={`${size} text-blue-200`} />;
  }
  if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
    return <Cloud className={`${size} text-gray-400`} />;
  }
  if (conditionLower.includes('clear') || conditionLower.includes('sunny')) {
    return <Sun className={`${size} text-yellow-400`} />;
  }
  return <Sun className={`${size} text-yellow-400`} />;
}

export default function WeatherWidget({ variant = 'compact', className = '' }: WeatherWidgetProps) {
  const { settings } = useSiteSettings();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if weather widget is enabled
    if (settings.showWeatherWidget === false) {
      setLoading(false);
      return;
    }

    // FIX Iter-18: AbortController to prevent state updates on unmounted component
    const controller = new AbortController();

    const fetchWeather = async () => {
      try {
        if (!controller.signal.aborted) setLoading(true);
        if (!controller.signal.aborted) setError(null);

        // Try to fetch from our backend which should have API key configured
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
        const apiUrl = baseUrl.replace(/\/api\/?$/, '');
        const location = encodeURIComponent(settings.weatherLocation || 'New York, USA');

        const response = await fetch(`${apiUrl}/api/weather?location=${location}`, { signal: controller.signal });

        if (!response.ok) {
          if (controller.signal.aborted) return;
          // FIX Iter-12: mark fallback data so UI can indicate it's demo data
          setWeather({
            temperature: 24,
            feels_like: 26,
            humidity: 65,
            wind_speed: 12,
            visibility: 10,
            condition: 'Partly Cloudy',
            description: 'Demo data — weather service unavailable',
            icon: 'cloud-sun',
            location: settings.weatherLocation || 'Resort Location',
            isDemo: true, // FIX Iter-12: flag for UI indicator
          });
          return;
        }

        if (controller.signal.aborted) return;
        const data = await response.json();
        if (data.success && data.data) {
          setWeather(data.data);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        console.error('Weather fetch error:', err);
        // FIX Iter-12: mark fallback data so UI can indicate it's demo data
        setWeather({
          temperature: 24,
          feels_like: 26,
          humidity: 65,
          wind_speed: 12,
          visibility: 10,
          condition: 'Partly Cloudy',
          description: 'Demo data — weather service unavailable',
          icon: 'cloud-sun',
          location: settings.weatherLocation || 'Resort Location',
          isDemo: true, // FIX Iter-12: flag for UI indicator
        });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchWeather();

    // Refresh weather every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [settings.showWeatherWidget, settings.weatherLocation]);

  // Don't render if weather widget is disabled
  if (settings.showWeatherWidget === false) {
    return null;
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !weather) {
    return null; // Silently fail - don't show error to users
  }

  // Compact variant - for header/navbar
  if (variant === 'header') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm ${className}`}
      >
        {getWeatherIcon(weather.condition, 'w-5 h-5')}
        <span className="text-sm font-medium">{Math.round(weather.temperature)}°C</span>
      </motion.div>
    );
  }

  // Compact variant - small card
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg border border-white/20 ${className}`}
      >
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            {getWeatherIcon(weather.condition, 'w-12 h-12')}
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">
              {Math.round(weather.temperature)}°C
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {weather.condition}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              {weather.location}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full variant - detailed weather card
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`bg-gradient-to-br from-primary-500/90 to-primary-600/90 backdrop-blur-lg rounded-3xl p-6 shadow-xl text-white ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold opacity-90">{weather.location}</h3>
          <p className="text-sm opacity-70">{weather.description}</p>
        </div>
        {getWeatherIcon(weather.condition, 'w-16 h-16')}
      </div>

      {/* Main temperature */}
      <div className="text-6xl font-bold mb-6">
        {Math.round(weather.temperature)}°C
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2 opacity-80">
          <Thermometer className="w-5 h-5" />
          <div>
            <div className="text-xs opacity-70">Feels like</div>
            <div className="font-medium">{Math.round(weather.feels_like)}°C</div>
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-80">
          <Droplets className="w-5 h-5" />
          <div>
            <div className="text-xs opacity-70">Humidity</div>
            <div className="font-medium">{weather.humidity}%</div>
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-80">
          <Wind className="w-5 h-5" />
          <div>
            <div className="text-xs opacity-70">Wind</div>
            <div className="font-medium">{Math.round(weather.wind_speed)} km/h</div>
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-80">
          <Eye className="w-5 h-5" />
          <div>
            <div className="text-xs opacity-70">Visibility</div>
            <div className="font-medium">{weather.visibility} km</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


