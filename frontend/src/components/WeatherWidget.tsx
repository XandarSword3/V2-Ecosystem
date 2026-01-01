'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Cloud, Sun, CloudRain, Wind, Droplets, Thermometer, Sunrise, Sunset } from 'lucide-react';
import { useState, useEffect } from 'react';

interface WeatherData {
  temperature: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'partlyCloudy';
  humidity: number;
  windSpeed: number;
  sunrise: string;
  sunset: string;
  forecast: {
    day: string;
    high: number;
    low: number;
    condition: 'sunny' | 'cloudy' | 'rainy' | 'partlyCloudy';
  }[];
}

// Mock weather data for Lebanon mountains
const mockWeatherData: WeatherData = {
  temperature: 24,
  condition: 'sunny',
  humidity: 45,
  windSpeed: 12,
  sunrise: '06:15',
  sunset: '19:45',
  forecast: [
    { day: 'Mon', high: 26, low: 18, condition: 'sunny' },
    { day: 'Tue', high: 25, low: 17, condition: 'partlyCloudy' },
    { day: 'Wed', high: 23, low: 16, condition: 'cloudy' },
    { day: 'Thu', high: 22, low: 15, condition: 'rainy' },
    { day: 'Fri', high: 24, low: 17, condition: 'sunny' },
  ],
};

const WeatherIcon = ({ condition, size = 'md' }: { condition: string; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-16 h-16',
  };
  
  const iconClass = sizeClasses[size];
  
  switch (condition) {
    case 'sunny':
      return <Sun className={`${iconClass} text-yellow-400`} />;
    case 'cloudy':
      return <Cloud className={`${iconClass} text-slate-400`} />;
    case 'rainy':
      return <CloudRain className={`${iconClass} text-blue-400`} />;
    case 'partlyCloudy':
      return (
        <div className="relative">
          <Sun className={`${iconClass} text-yellow-400`} />
          <Cloud className={`${sizeClasses.sm} text-slate-400 absolute -bottom-1 -right-1`} />
        </div>
      );
    default:
      return <Sun className={`${iconClass} text-yellow-400`} />;
  }
};

export default function WeatherWidget() {
  const t = useTranslations('weather');
  const [weather, setWeather] = useState<WeatherData>(mockWeatherData);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Simulate temperature fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setWeather(prev => ({
        ...prev,
        temperature: prev.temperature + (Math.random() > 0.5 ? 0.1 : -0.1),
      }));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return t('goodMorning');
    if (hour < 17) return t('goodAfternoon');
    return t('goodEvening');
  };

  return (
    <motion.div
      layout
      className="bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 rounded-2xl shadow-xl overflow-hidden text-white"
    >
      {/* Main Content */}
      <div className="p-6">
        {/* Location & Time */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-white/70 text-sm">{getGreeting()}</p>
            <h3 className="text-lg font-semibold">{t('location')}</h3>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-white/70 text-xs">
              {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Current Weather */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ 
                rotate: weather.condition === 'sunny' ? [0, 360] : 0,
                scale: [1, 1.1, 1],
              }}
              transition={{ 
                rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                scale: { duration: 2, repeat: Infinity },
              }}
            >
              <WeatherIcon condition={weather.condition} size="lg" />
            </motion.div>
            <div>
              <motion.div 
                className="text-5xl font-bold"
                key={Math.round(weather.temperature)}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {Math.round(weather.temperature)}°C
              </motion.div>
              <p className="text-white/80 capitalize">{t(weather.condition)}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
            <Droplets className="w-5 h-5 mx-auto mb-1 text-blue-200" />
            <p className="text-xs text-white/70">{t('humidity')}</p>
            <p className="font-semibold">{weather.humidity}%</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
            <Wind className="w-5 h-5 mx-auto mb-1 text-blue-200" />
            <p className="text-xs text-white/70">{t('wind')}</p>
            <p className="font-semibold">{weather.windSpeed} km/h</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
            <Sunrise className="w-5 h-5 mx-auto mb-1 text-orange-300" />
            <p className="text-xs text-white/70">{t('sunrise')}</p>
            <p className="font-semibold">{weather.sunrise}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
            <Sunset className="w-5 h-5 mx-auto mb-1 text-orange-400" />
            <p className="text-xs text-white/70">{t('sunset')}</p>
            <p className="font-semibold">{weather.sunset}</p>
          </div>
        </div>

        {/* Toggle Forecast */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-center text-sm text-white/70 hover:text-white transition-colors py-2"
        >
          {isExpanded ? t('hideForecast') : t('showForecast')}
        </button>
      </div>

      {/* 5-Day Forecast */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white/10 backdrop-blur-sm border-t border-white/10"
          >
            <div className="p-4">
              <h4 className="text-sm font-semibold mb-3">{t('fiveDayForecast')}</h4>
              <div className="grid grid-cols-5 gap-2">
                {weather.forecast.map((day, index) => (
                  <motion.div
                    key={day.day}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="text-center"
                  >
                    <p className="text-xs text-white/70 mb-2">{day.day}</p>
                    <WeatherIcon condition={day.condition} size="sm" />
                    <p className="text-sm font-semibold mt-2">{day.high}°</p>
                    <p className="text-xs text-white/60">{day.low}°</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Perfect for tag */}
      <div className="bg-white/10 px-4 py-3 text-center text-sm">
        <span className="text-white/70">{t('perfectFor')}: </span>
        <span className="font-semibold">{t('poolAndDining')}</span>
      </div>
    </motion.div>
  );
}
