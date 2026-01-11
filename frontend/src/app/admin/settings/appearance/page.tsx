'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSiteSettings } from '@/lib/settings-context';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { resortThemes, ResortTheme } from '@/lib/theme-config';
import {
  Palette,
  Volume2,
  VolumeX,
  Monitor,
  Smartphone,
  Save,
  RotateCcw,
  Zap,
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  Check,
} from 'lucide-react';

// Toggle switch component
function ToggleSwitch({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

// Color picker component
function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg cursor-pointer border-2 border-slate-200 dark:border-slate-700"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-2 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
        />
      </div>
    </div>
  );
}

export default function AppearanceSettingsPage() {
  const { settings, refetch, loading } = useSiteSettings();
  
  // Theme state
  const [selectedTheme, setSelectedTheme] = useState<ResortTheme>(settings.theme || 'beach');
  const [useCustomColors, setUseCustomColors] = useState(!!settings.themeColors);
  const [customColors, setCustomColors] = useState({
    primary: settings.themeColors?.primary || '#0891b2',
    secondary: settings.themeColors?.secondary || '#06b6d4',
    accent: settings.themeColors?.accent || '#f59e0b',
    background: settings.themeColors?.background || '#f0fdfa',
    surface: settings.themeColors?.surface || '#ffffff',
    text: settings.themeColors?.text || '#164e63',
    textMuted: settings.themeColors?.textMuted || '#0e7490',
  });
  
  // Weather widget state
  const [showWeatherWidget, setShowWeatherWidget] = useState(settings.showWeatherWidget ?? true);
  const [weatherLocation, setWeatherLocation] = useState(settings.weatherLocation || 'Beirut, Lebanon');
  const [weatherEffect, setWeatherEffect] = useState<string>(settings.weatherEffect || 'auto');
  
  // Animation state
  const [animationsEnabled, setAnimationsEnabled] = useState(settings.animationsEnabled ?? true);
  const [reducedMotion, setReducedMotion] = useState(settings.reducedMotion ?? false);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled ?? true);
  
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Sync state when settings load from API (fixes settings not showing after page load)
  useEffect(() => {
    if (!loading && !initialized) {
      setSelectedTheme(settings.theme || 'beach');
      setUseCustomColors(!!settings.themeColors);
      if (settings.themeColors) {
        setCustomColors({
          primary: settings.themeColors.primary || '#0891b2',
          secondary: settings.themeColors.secondary || '#06b6d4',
          accent: settings.themeColors.accent || '#f59e0b',
          background: settings.themeColors.background || '#f0fdfa',
          surface: settings.themeColors.surface || '#ffffff',
          text: settings.themeColors.text || '#164e63',
          textMuted: settings.themeColors.textMuted || '#0e7490',
        });
      }
      setShowWeatherWidget(settings.showWeatherWidget ?? true);
      setWeatherLocation(settings.weatherLocation || 'Beirut, Lebanon');
      setWeatherEffect(settings.weatherEffect || 'auto');
      setAnimationsEnabled(settings.animationsEnabled ?? true);
      setReducedMotion(settings.reducedMotion ?? false);
      setSoundEnabled(settings.soundEnabled ?? true);
      setInitialized(true);
    }
  }, [loading, settings, initialized]);

  // Update custom colors when theme changes
  useEffect(() => {
    if (!useCustomColors && selectedTheme) {
      const themeColors = resortThemes[selectedTheme].colors;
      setCustomColors(themeColors);
    }
  }, [selectedTheme, useCustomColors]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const newSettings = {
        ...settings,
        theme: selectedTheme,
        themeColors: useCustomColors ? customColors : null,
        showWeatherWidget,
        weatherLocation,
        weatherEffect,
        animationsEnabled,
        reducedMotion,
        soundEnabled
      };
      await api.put('/admin/settings', newSettings);
      await refetch();
      setHasChanges(false);
      toast.success('Appearance settings saved! Theme applied across the site.');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedTheme('beach');
    setUseCustomColors(false);
    setCustomColors(resortThemes.beach.colors);
    setShowWeatherWidget(true);
    setWeatherLocation('Beirut, Lebanon');
    setWeatherEffect('auto');
    setAnimationsEnabled(true);
    setReducedMotion(false);
    setSoundEnabled(true);
    setHasChanges(true);
    toast.info('Settings reset to defaults');
  };

  const markChanged = () => setHasChanges(true);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-8"
    >
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Palette className="w-8 h-8 text-primary-600" />
            Appearance Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Customize the look and feel of V2 Resort for all visitors
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} isLoading={isSaving} disabled={!hasChanges}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </motion.div>

      {/* Theme Selection */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary-600" />
              Resort Theme
            </CardTitle>
            <CardDescription>
              Choose a preset theme or customize colors for your resort
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              {Object.values(resortThemes).map((theme) => (
                <motion.button
                  key={theme.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedTheme(theme.id);
                    markChanged();
                  }}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    selectedTheme === theme.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  {selectedTheme === theme.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className={`w-full h-12 rounded-lg mb-3 ${theme.gradient}`} />
                  <span className="text-2xl mb-1 block">{theme.icon}</span>
                  <p className="font-medium text-sm text-slate-900 dark:text-white">{theme.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{theme.description}</p>
                </motion.button>
              ))}
            </div>
            
            {/* Custom Colors Toggle */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <ToggleSwitch
                enabled={useCustomColors}
                onChange={(value) => {
                  setUseCustomColors(value);
                  markChanged();
                }}
                label="Use Custom Colors"
                description="Override theme colors with your own custom palette"
              />
              
              {useCustomColors && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                >
                  <ColorPicker
                    label="Primary Color"
                    value={customColors.primary}
                    onChange={(v) => { setCustomColors({...customColors, primary: v}); markChanged(); }}
                  />
                  <ColorPicker
                    label="Secondary Color"
                    value={customColors.secondary}
                    onChange={(v) => { setCustomColors({...customColors, secondary: v}); markChanged(); }}
                  />
                  <ColorPicker
                    label="Accent Color"
                    value={customColors.accent}
                    onChange={(v) => { setCustomColors({...customColors, accent: v}); markChanged(); }}
                  />
                  <ColorPicker
                    label="Background"
                    value={customColors.background}
                    onChange={(v) => { setCustomColors({...customColors, background: v}); markChanged(); }}
                  />
                  <ColorPicker
                    label="Surface Color"
                    value={customColors.surface}
                    onChange={(v) => { setCustomColors({...customColors, surface: v}); markChanged(); }}
                  />
                  <ColorPicker
                    label="Text Color"
                    value={customColors.text}
                    onChange={(v) => { setCustomColors({...customColors, text: v}); markChanged(); }}
                  />
                  <ColorPicker
                    label="Muted Text"
                    value={customColors.textMuted}
                    onChange={(v) => { setCustomColors({...customColors, textMuted: v}); markChanged(); }}
                  />
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Weather Widget Settings */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-primary-600" />
              Weather Widget
            </CardTitle>
            <CardDescription>
              Display real-time weather information for guests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleSwitch
              enabled={showWeatherWidget}
              onChange={(value) => {
                setShowWeatherWidget(value);
                markChanged();
              }}
              label="Show Weather Widget"
              description="Display current weather conditions on the homepage"
            />
            
            {showWeatherWidget && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Weather Location
                  </label>
                  <input
                    type="text"
                    value={weatherLocation}
                    onChange={(e) => { setWeatherLocation(e.target.value); markChanged(); }}
                    placeholder="e.g., Beirut, Lebanon"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Enter the city and country for weather data
                  </p>
                </div>
                
                {/* Weather Animation Effect Selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Weather Animation Effect
                  </label>
                  <select
                    value={weatherEffect}
                    onChange={(e) => { setWeatherEffect(e.target.value); markChanged(); }}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="auto">🎨 Auto (Based on theme)</option>
                    <option value="waves">🌊 Waves (Animated ocean waves)</option>
                    <option value="snow">❄️ Snow (Falling snowflakes)</option>
                    <option value="rain">🌧️ Rain (Rain drops)</option>
                    <option value="leaves">🍂 Leaves (Falling autumn leaves)</option>
                    <option value="stars">✨ Stars (Twinkling night sky)</option>
                    <option value="fireflies">🌟 Fireflies (Glowing particles)</option>
                    <option value="none">🚫 None (Disable animations)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Choose the ambient animation effect displayed on the site. "Auto" uses the theme's default effect.
                  </p>
                </div>
              </div>
            )}
            
            {/* Weather Preview */}
            <div className="mt-6 p-4 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">{weatherLocation}</p>
                  <p className="text-4xl font-bold">24°C</p>
                  <p className="text-sm opacity-80">Partly Cloudy</p>
                </div>
                <div className="text-6xl">
                  <Cloud className="w-16 h-16" />
                </div>
              </div>
              <p className="text-xs mt-2 opacity-60">Preview - Actual weather will be fetched from API</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Animation & Performance */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary-600" />
              Animations & Performance
            </CardTitle>
            <CardDescription>
              Control animation behavior and performance settings
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100">
            <ToggleSwitch
              enabled={animationsEnabled}
              onChange={(value) => {
                setAnimationsEnabled(value);
                setHasChanges(true);
              }}
              label="Enable Animations"
              description="Show smooth transitions and micro-interactions throughout the site"
            />
            <ToggleSwitch
              enabled={reducedMotion}
              onChange={(value) => {
                setReducedMotion(value);
                setHasChanges(true);
              }}
              label="Reduced Motion"
              description="Minimize animations for users who prefer less motion"
            />
            <ToggleSwitch
              enabled={soundEnabled}
              onChange={(value) => {
                setSoundEnabled(value);
                setHasChanges(true);
              }}
              label="Sound Effects"
              description="Play notification sounds for new orders and events"
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Device Preview (static, not theme-dependent) */}
      <motion.div variants={fadeInUp}>
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary-600" />
              Device Preview
            </CardTitle>
            <CardDescription>
              See how your site looks across different devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-8">
              {/* Desktop Preview */}
              <div className="text-center">
                <div className="w-64 h-40 rounded-lg bg-gradient-to-br from-green-400 via-blue-400 to-purple-500 border-4 border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-6 bg-slate-800 flex items-center px-2 gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                  <div className="absolute top-8 left-2 right-2 bottom-2 bg-white/80 rounded flex items-center justify-center">
                    <span className="text-4xl">🏝️</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-3 text-slate-600">
                  <Monitor className="w-4 h-4" />
                  <span className="text-sm">Desktop</span>
                </div>
              </div>

              {/* Mobile Preview */}
              <div className="text-center">
                <div className="w-24 h-44 rounded-2xl bg-gradient-to-br from-green-400 via-blue-400 to-purple-500 border-4 border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-800 rounded-full" />
                  <div className="absolute top-5 left-2 right-2 bottom-4 bg-white/80 rounded flex items-center justify-center">
                    <span className="text-2xl">🏝️</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-3 text-slate-600">
                  <Smartphone className="w-4 h-4" />
                  <span className="text-sm">Mobile</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
