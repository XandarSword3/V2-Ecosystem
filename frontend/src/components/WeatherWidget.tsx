'use client';

/**
 * Premium Weather Widget
 * 
 * Animated glassmorphic weather display with hover-to-expand,
 * dynamic icon animations, and white-label CSS variable theming.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Thermometer, Wind, Droplets, Eye } from 'lucide-react';
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
  isDemo?: boolean;
}

interface WeatherWidgetProps {
  variant?: 'compact' | 'full' | 'header';
  className?: string;
}

// Animated Sun with pulsing rays
function AnimatedSun({ size = 48 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Sun rays */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 rounded-full"
          style={{
            height: size * 0.15,
            background: 'var(--color-weather-sun, #fbbf24)',
            left: '50%',
            top: '50%',
            transformOrigin: 'center center',
            transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-${size * 0.35}px)`,
          }}
          animate={{
            scaleY: [1, 1.3, 1],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
      {/* Sun core */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--color-weather-sun, #fbbf24) 0%, var(--color-weather-sun-dark, #f59e0b) 100%)',
        }}
        animate={{
          scale: [1, 1.05, 1],
          boxShadow: [
            '0 0 20px var(--color-weather-sun, #fbbf24)',
            '0 0 40px var(--color-weather-sun, #fbbf24)',
            '0 0 20px var(--color-weather-sun, #fbbf24)',
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

// Animated Cloud with drifting effect
function AnimatedCloud({ size = 48, rain = false }: { size?: number; rain?: boolean }) {
  return (
    <div className="relative" style={{ width: size * 1.5, height: size }}>
      {/* Rain drops */}
      {rain && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="w-0.5 rounded-full"
              style={{
                height: size * 0.2,
                background: 'var(--color-weather-rain, #60a5fa)',
              }}
              animate={{
                y: [0, size * 0.4],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'linear',
              }}
            />
          ))}
        </div>
      )}
      {/* Cloud body */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.8,
          height: size * 0.5,
          background: 'var(--color-weather-cloud, #e5e7eb)',
          top: size * 0.2,
          left: size * 0.1,
        }}
        animate={{ x: [-2, 2, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.5,
          height: size * 0.4,
          background: 'var(--color-weather-cloud, #e5e7eb)',
          top: 0,
          left: 0,
        }}
        animate={{ x: [-1, 1, -1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 0.5,
          height: size * 0.4,
          background: 'var(--color-weather-cloud, #e5e7eb)',
          top: 0,
          right: size * 0.1,
        }}
        animate={{ x: [1, -1, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
    </div>
  );
}

// Animated Lightning
function AnimatedLightning({ size = 48 }: { size?: number }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <AnimatedCloud size={size} />
      <motion.svg
        width={size * 0.4}
        height={size * 0.6}
        viewBox="0 0 24 40"
        className="absolute bottom-0"
        style={{ left: '50%', transform: 'translateX(-50%)' }}
      >
        <motion.path
          d="M13 0L4 16h6l-3 24 12-20h-6l6-20z"
          fill="var(--color-weather-lightning, #fbbf24)"
          animate={{
            opacity: [0, 1, 0, 1, 0],
            scale: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            repeatDelay: 2,
            ease: 'easeOut',
          }}
        />
      </motion.svg>
    </div>
  );
}

// Animated Snow
function AnimatedSnow({ size = 48 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size * 1.5, height: size }}>
      {/* Snowflakes */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-white"
          style={{
            left: `${20 + i * 20}%`,
            top: size * 0.5,
          }}
          animate={{
            y: [0, size * 0.4],
            x: [-2, 2, -2],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.3,
            ease: 'linear',
          }}
        />
      ))}
      <AnimatedCloud size={size} />
    </div>
  );
}

// Animated Wind
function AnimatedWind({ size = 48 }: { size?: number }) {
  return (
    <div className="relative flex items-center" style={{ width: size, height: size }}>
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 rounded-full"
          style={{
            width: size * (0.4 + i * 0.2),
            background: "var(--color-weather-wind, #9ca3af)",
            top: size * (0.3 + i * 0.2),
            left: 0,
          }}
          animate={{
            x: [-10, 10, -10],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 2 + i * 0.3,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Dynamic animated icon based on condition
function getAnimatedIcon(condition: string, size = 48) {
  const conditionLower = condition.toLowerCase();

  if (conditionLower.includes('thunder') || conditionLower.includes('storm')) {
    return <AnimatedLightning size={size} />;
  }
  if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
    return <AnimatedCloud size={size} rain />;
  }
  if (conditionLower.includes('snow') || conditionLower.includes('sleet')) {
    return <AnimatedSnow size={size} />;
  }
  if (conditionLower.includes('wind') || conditionLower.includes('breez')) {
    return <AnimatedWind size={size} />;
  }
  if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
    return <AnimatedCloud size={size} />;
  }
  return <AnimatedSun size={size} />;
}

export default function WeatherWidget({ variant = 'compact', className = '' }: WeatherWidgetProps) {
  const { settings } = useSiteSettings();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

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
            location: settings.weatherLocation || 'Business Location',
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
          location: settings.weatherLocation || 'Business Location',
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
    return null;
  }

  // Glassmorphism gradient based on weather condition
  const getWeatherGradient = () => {
    const condition = weather.condition.toLowerCase();
    if (condition.includes('sun') || condition.includes('clear')) {
      return 'from-amber-500/20 via-orange-500/10 to-yellow-500/20';
    }
    if (condition.includes('rain') || condition.includes('drizzle')) {
      return 'from-blue-500/20 via-cyan-500/10 to-teal-500/20';
    }
    if (condition.includes('cloud')) {
      return 'from-slate-400/20 via-gray-400/10 to-zinc-500/20';
    }
    if (condition.includes('snow')) {
      return 'from-blue-100/30 via-white/20 to-cyan-100/30';
    }
    if (condition.includes('thunder') || condition.includes('storm')) {
      return 'from-purple-500/20 via-violet-500/10 to-indigo-500/20';
    }
    return 'from-primary-500/20 via-primary-400/10 to-primary-600/20';
  };

  // Header variant - minimal
  if (variant === 'header') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.05 }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 ${className}`}
        style={{ backgroundColor: 'var(--color-glass-bg, rgba(255,255,255,0.1))' }}
      >
        <div className="scale-75 origin-center">{getAnimatedIcon(weather.condition, 28)}</div>
        <span className="text-sm font-medium" style={{ color: 'var(--color-text, white)' }}>
          {Math.round(weather.temperature)}°C
        </span>
      </motion.div>
    );
  }

  // Compact variant - glassmorphic with hover expand
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        onHoverStart={() => setIsExpanded(true)}
        onHoverEnd={() => setIsExpanded(false)}
        className={`relative overflow-hidden backdrop-blur-xl rounded-3xl p-5 shadow-2xl border border-white/30 cursor-pointer ${className}`}
        style={{
          background: 'var(--color-weather-card-bg, linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%))',
        }}
      >
        {/* Animated gradient background */}
        <motion.div
          className={`absolute inset-0 bg-gradient-to-br ${getWeatherGradient()} opacity-60`}
          animate={{ opacity: isExpanded ? 0.8 : 0.6 }}
        />
        
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <motion.div 
              className="flex-shrink-0"
              animate={{ scale: isExpanded ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {getAnimatedIcon(weather.condition, 52)}
            </motion.div>
            <div className="flex-1">
              <motion.div 
                className="text-3xl font-bold"
                style={{ color: 'var(--color-text-primary, #1e293b)' }}
                animate={{ fontSize: isExpanded ? '2rem' : '1.875rem' }}
              >
                {Math.round(weather.temperature)}°C
              </motion.div>
              <div 
                className="text-sm font-medium"
                style={{ color: 'var(--color-text-secondary, #64748b)' }}
              >
                {weather.condition}
              </div>
              <div 
                className="text-xs mt-0.5"
                style={{ color: 'var(--color-text-muted, #94a3b8)' }}
              >
                {weather.location}
                {weather.isDemo && (
                  <span className="ml-1 text-amber-500 text-[10px]">(Demo)</span>
                )}
              </div>
            </div>
          </div>

          {/* Expanded details on hover */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4" style={{ color: 'var(--color-primary, #3b82f6)' }} />
                    <div>
                      <div className="text-[10px]" style={{ color: 'var(--color-text-muted, #94a3b8)' }}>Humidity</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary, #64748b)' }}>{weather.humidity}%</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4" style={{ color: 'var(--color-primary, #3b82f6)' }} />
                    <div>
                      <div className="text-[10px]" style={{ color: 'var(--color-text-muted, #94a3b8)' }}>Wind</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary, #64748b)' }}>{Math.round(weather.wind_speed)} km/h</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  // Full variant - detailed weather card with animations
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.01 }}
      className={`relative overflow-hidden backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/30 ${className}`}
      style={{
        background: 'var(--color-weather-card-bg, linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 100%))',
      }}
    >
      {/* Animated gradient background */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-br ${getWeatherGradient()} opacity-60`}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 
              className="text-lg font-semibold"
              style={{ color: 'var(--color-text-primary, #1e293b)' }}
            >
              {weather.location}
            </h3>
            <p 
              className="text-sm"
              style={{ color: 'var(--color-text-muted, #94a3b8)' }}
            >
              {weather.description}
              {weather.isDemo && <span className="ml-2 text-amber-500">(Demo Data)</span>}
            </p>
          </div>
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            {getAnimatedIcon(weather.condition, 64)}
          </motion.div>
        </div>

        {/* Main temperature */}
        <motion.div 
          className="text-6xl font-bold mb-6"
          style={{ color: 'var(--color-text-primary, #1e293b)' }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        >
          {Math.round(weather.temperature)}°C
        </motion.div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-4">
          {[ 
            { icon: Thermometer, label: 'Feels like', value: `${Math.round(weather.feels_like)}°C` },
            { icon: Droplets, label: 'Humidity', value: `${weather.humidity}%` },
            { icon: Wind, label: 'Wind', value: `${Math.round(weather.wind_speed)} km/h` },
            { icon: Eye, label: 'Visibility', value: `${weather.visibility} km` },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-2"
              style={{ color: 'var(--color-text-secondary, #64748b)' }}
            >
              <item.icon className="w-5 h-5" style={{ color: 'var(--color-primary, #3b82f6)' }} />
              <div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted, #94a3b8)' }}>{item.label}</div>
                <div className="font-medium">{item.value}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}


