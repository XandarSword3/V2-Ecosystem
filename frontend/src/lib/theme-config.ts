// Resort Theme Configuration System
// Supports multiple resort themes configurable by admins

export type ResortTheme = 'beach' | 'mountain' | 'sunset' | 'forest' | 'midnight';
export type WeatherEffect = 'none' | 'sunny' | 'rain' | 'snow' | 'clouds';

export interface ThemeConfig {
  id: ResortTheme;
  name: string;
  description: string;
  icon: string;
  // Tailwind class shortcuts for quick styling
  primary: string;
  accent: string;
  background: string;
  gradient: string;
  pattern: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
  };
  gradients: {
    hero: string;
    card: string;
    button: string;
  };
  patterns: {
    backgroundImage?: string;
    overlayOpacity: number;
  };
}

export const resortThemes: Record<ResortTheme, ThemeConfig> = {
  beach: {
    id: 'beach',
    name: 'Beach Paradise',
    description: 'Tropical vibes with ocean waves and sandy tones',
    icon: '🏖️',
    primary: 'bg-cyan-600',
    accent: 'bg-amber-500',
    background: 'bg-teal-50',
    gradient: 'bg-gradient-to-br from-cyan-400 via-cyan-500 to-teal-600',
    pattern: "data:image/svg+xml,%3Csvg width='52' height='26' viewBox='0 0 52 26' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2306b6d4' fill-opacity='0.15'%3E%3Cpath d='M10 10c0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6h2c0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4v2c-3.314 0-6-2.686-6-6 0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6zm25.464-1.95l8.486 8.486-1.414 1.414-8.486-8.486 1.414-1.414z' /%3E%3C/g%3E%3C/g%3E%3C/svg%3E",
    colors: {
      primary: '#0891b2',
      secondary: '#06b6d4',
      accent: '#f59e0b',
      background: '#f0fdfa',
      surface: '#ffffff',
      text: '#164e63',
      textMuted: '#0e7490',
    },
    gradients: {
      hero: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)',
      card: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(240,253,250,0.95) 100%)',
      button: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
    },
    patterns: {
      backgroundImage: 'url("/patterns/waves.svg")',
      overlayOpacity: 0.05,
    },
  },
  mountain: {
    id: 'mountain',
    name: 'Mountain Retreat',
    description: 'Earthy tones inspired by Lebanese mountains',
    icon: '🏔️',
    primary: 'bg-stone-600',
    accent: 'bg-green-600',
    background: 'bg-stone-50',
    gradient: 'bg-gradient-to-br from-stone-400 via-stone-500 to-stone-700',
    pattern: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%2378716c' fill-opacity='0.1'%3E%3Cpath fill-rule='evenodd' d='M0 0h40v40H0V0zm40 40h40v40H40V40zm0-40h2l-2 2V0zm0 4l4-4h2l-6 6V4zm0 4l8-8h2L40 10V8zm0 4L52 0h2L40 14v-2zm0 4L56 0h2L40 18v-2zm0 4L60 0h2L40 22v-2zm0 4L64 0h2L40 26v-2zm0 4L68 0h2L40 30v-2zm0 4L72 0h2L40 34v-2zm0 4L76 0h2L40 38v-2zm0 4L80 0v2L42 40h-2zm4 0L80 4v2L46 40h-2zm4 0L80 8v2L50 40h-2z'/%3E%3C/g%3E%3C/svg%3E",
    colors: {
      primary: '#78716c',
      secondary: '#57534e',
      accent: '#16a34a',
      background: '#fafaf9',
      surface: '#ffffff',
      text: '#1c1917',
      textMuted: '#57534e',
    },
    gradients: {
      hero: 'linear-gradient(135deg, #57534e 0%, #78716c 50%, #a8a29e 100%)',
      card: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(245,245,244,0.98) 100%)',
      button: 'linear-gradient(135deg, #57534e 0%, #44403c 100%)',
    },
    patterns: {
      backgroundImage: 'url("/patterns/mountains.svg")',
      overlayOpacity: 0.03,
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Golden Sunset',
    description: 'Warm oranges and pinks for a romantic atmosphere',
    icon: '🌅',
    primary: 'bg-orange-600',
    accent: 'bg-pink-600',
    background: 'bg-orange-50',
    gradient: 'bg-gradient-to-br from-orange-400 via-rose-400 to-pink-500',
    pattern: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cg fill='%23f97316' fill-opacity='0.1'%3E%3Cpath d='M0 0h20L0 20z'/%3E%3C/g%3E%3C/svg%3E",
    colors: {
      primary: '#ea580c',
      secondary: '#f97316',
      accent: '#db2777',
      background: '#fff7ed',
      surface: '#ffffff',
      text: '#7c2d12',
      textMuted: '#c2410c',
    },
    gradients: {
      hero: 'linear-gradient(135deg, #ea580c 0%, #f97316 30%, #fb923c 60%, #fbbf24 100%)',
      card: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,247,237,0.96) 100%)',
      button: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
    },
    patterns: {
      backgroundImage: 'url("/patterns/sunset-rays.svg")',
      overlayOpacity: 0.04,
    },
  },
  forest: {
    id: 'forest',
    name: 'Cedar Forest',
    description: 'Deep greens celebrating Lebanese cedar heritage',
    icon: '🌲',
    primary: 'bg-green-700',
    accent: 'bg-yellow-600',
    background: 'bg-green-50',
    gradient: 'bg-gradient-to-br from-green-500 via-emerald-600 to-green-800',
    pattern: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%2316a34a' fill-opacity='0.12'%3E%3Cpath d='M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 1.4l2.83 2.83 1.41-1.41L1.41 0H0v1.41zM38.59 40l-2.83-2.83 1.41-1.41L40 38.59V40h-1.41zM40 1.41l-2.83 2.83-1.41-1.41L38.59 0H40v1.41zM20 18.6l2.83-2.83 1.41 1.41L21.41 20l2.83 2.83-1.41 1.41L20 21.41l-2.83 2.83-1.41-1.41L18.59 20l-2.83-2.83 1.41-1.41L20 18.59z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E",
    colors: {
      primary: '#15803d',
      secondary: '#16a34a',
      accent: '#ca8a04',
      background: '#f0fdf4',
      surface: '#ffffff',
      text: '#14532d',
      textMuted: '#166534',
    },
    gradients: {
      hero: 'linear-gradient(135deg, #14532d 0%, #15803d 50%, #22c55e 100%)',
      card: 'linear-gradient(180deg, rgba(255,255,255,0.93) 0%, rgba(240,253,244,0.97) 100%)',
      button: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
    },
    patterns: {
      backgroundImage: 'url("/patterns/leaves.svg")',
      overlayOpacity: 0.04,
    },
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Sky',
    description: 'Elegant purple and blue for evening ambiance',
    icon: '🌙',
    primary: 'bg-violet-600',
    accent: 'bg-cyan-500',
    background: 'bg-violet-50',
    gradient: 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700',
    pattern: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cg fill='%238b5cf6' fill-opacity='0.1'%3E%3Ccircle cx='3' cy='3' r='1'/%3E%3Ccircle cx='13' cy='13' r='1'/%3E%3C/g%3E%3C/svg%3E",
    colors: {
      primary: '#7c3aed',
      secondary: '#8b5cf6',
      accent: '#06b6d4',
      background: '#faf5ff',
      surface: '#ffffff',
      text: '#4c1d95',
      textMuted: '#6d28d9',
    },
    gradients: {
      hero: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a78bfa 100%)',
      card: 'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(250,245,255,0.97) 100%)',
      button: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    },
    patterns: {
      backgroundImage: 'url("/patterns/stars.svg")',
      overlayOpacity: 0.03,
    },
  },
};

export const weatherEffects: Record<WeatherEffect, { name: string; icon: string }> = {
  none: { name: 'No Effect', icon: '🌤️' },
  sunny: { name: 'Sunny Day', icon: '☀️' },
  rain: { name: 'Gentle Rain', icon: '🌧️' },
  snow: { name: 'Snowfall', icon: '❄️' },
  clouds: { name: 'Floating Clouds', icon: '☁️' },
};

export const defaultTheme: ResortTheme = 'beach';
export const defaultWeather: WeatherEffect = 'none';
