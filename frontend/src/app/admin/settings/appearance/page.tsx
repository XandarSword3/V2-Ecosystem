'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { resortThemes, type ResortTheme, type WeatherEffect } from '@/lib/theme-config';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { toast } from 'sonner';
import {
  Palette,
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  CloudSun,
  Sparkles,
  Volume2,
  VolumeX,
  Monitor,
  Smartphone,
  Save,
  RotateCcw,
  Eye,
  Zap,
} from 'lucide-react';

// Theme preview card
function ThemePreview({
  themeKey,
  theme,
  isSelected,
  onSelect,
}: {
  themeKey: ResortTheme;
  theme: typeof resortThemes.beach;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`relative overflow-hidden rounded-2xl p-1 transition-all ${
        isSelected 
          ? 'ring-4 ring-primary-500 ring-offset-2' 
          : 'hover:ring-2 hover:ring-slate-300'
      }`}
    >
      <div className={`relative h-32 rounded-xl overflow-hidden ${theme.gradient}`}>
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: `url("${theme.pattern}")`, backgroundSize: '40px 40px' }} />
        </div>
        
        {/* Theme info */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/50 to-transparent">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{theme.icon}</span>
            <span className="font-semibold text-white">{theme.name}</span>
          </div>
        </div>
        
        {/* Color swatches */}
        <div className="absolute top-3 right-3 flex gap-1">
          <div className={`w-4 h-4 rounded-full ${theme.primary.replace('600', '500')} shadow-lg`} />
          <div className={`w-4 h-4 rounded-full ${theme.accent.replace('500', '400')} shadow-lg`} />
        </div>
        
        {/* Selected indicator */}
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-3 left-3 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}

// Weather effect selector
function WeatherOption({
  effect,
  icon: Icon,
  label,
  isSelected,
  onSelect,
}: {
  effect: WeatherEffect;
  icon: React.ElementType;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onSelect}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-primary-500 bg-primary-50 text-primary-700'
          : 'border-slate-200 hover:border-slate-300 text-slate-600'
      }`}
    >
      <Icon className={`w-8 h-8 ${isSelected ? 'text-primary-500' : 'text-slate-400'}`} />
      <span className="text-sm font-medium">{label}</span>
    </motion.button>
  );
}

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
        <p className="font-medium text-slate-900">{label}</p>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-primary-600' : 'bg-slate-200'
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

export default function AppearanceSettingsPage() {
  const {
    resortTheme,
    weatherEffect,
    animationsEnabled,
    reducedMotion,
    soundEnabled,
    setResortTheme,
    setWeatherEffect,
    setAnimationsEnabled,
    setReducedMotion,
    setSoundEnabled,
  } = useSettingsStore();

  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleThemeChange = (theme: ResortTheme) => {
    setResortTheme(theme);
    setHasChanges(true);
  };

  const handleWeatherChange = (effect: WeatherEffect) => {
    setWeatherEffect(effect);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    setHasChanges(false);
    toast.success('Appearance settings saved!');
  };

  const handleReset = () => {
    setResortTheme('beach');
    setWeatherEffect('sunny');
    setAnimationsEnabled(true);
    setReducedMotion(false);
    setSoundEnabled(true);
    setHasChanges(true);
    toast.info('Settings reset to defaults');
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Palette className="w-8 h-8 text-primary-600" />
            Appearance Settings
          </h1>
          <p className="text-slate-500 mt-1">
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
              <Sparkles className="w-5 h-5 text-primary-600" />
              Resort Theme
            </CardTitle>
            <CardDescription>
              Choose a theme that reflects the current season or ambiance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {(Object.keys(resortThemes) as ResortTheme[]).map((key) => (
                <ThemePreview
                  key={key}
                  themeKey={key}
                  theme={resortThemes[key]}
                  isSelected={resortTheme === key}
                  onSelect={() => handleThemeChange(key)}
                />
              ))}
            </div>

            {/* Current theme details */}
            <motion.div
              layout
              className="mt-6 p-4 bg-slate-50 rounded-xl"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{resortThemes[resortTheme].icon}</span>
                <div>
                  <h3 className="font-semibold text-slate-900">{resortThemes[resortTheme].name}</h3>
                  <p className="text-sm text-slate-500">{resortThemes[resortTheme].description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Color palette:</span>
                <div className={`w-6 h-6 rounded-full bg-primary-600 shadow`} title="Primary" />
                <div className={`w-6 h-6 rounded-full ${resortThemes[resortTheme].accent} shadow`} title="Accent" />
                <div className={`w-6 h-6 rounded-full ${resortThemes[resortTheme].background} shadow border border-slate-200`} title="Background" />
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Weather Effects */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-primary-600" />
              Weather Effects
            </CardTitle>
            <CardDescription>
              Add ambient weather effects for an immersive experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <WeatherOption
                effect="sunny"
                icon={Sun}
                label="Sunny"
                isSelected={weatherEffect === 'sunny'}
                onSelect={() => handleWeatherChange('sunny')}
              />
              <WeatherOption
                effect="clouds"
                icon={CloudSun}
                label="Cloudy"
                isSelected={weatherEffect === 'clouds'}
                onSelect={() => handleWeatherChange('clouds')}
              />
              <WeatherOption
                effect="rain"
                icon={CloudRain}
                label="Rainy"
                isSelected={weatherEffect === 'rain'}
                onSelect={() => handleWeatherChange('rain')}
              />
              <WeatherOption
                effect="snow"
                icon={Snowflake}
                label="Snowy"
                isSelected={weatherEffect === 'snow'}
                onSelect={() => handleWeatherChange('snow')}
              />
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <Eye className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Preview Active</p>
                <p className="text-xs text-amber-600">Weather effects are visible on this page. Check the customer pages to see the full effect.</p>
              </div>
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

      {/* Device Preview */}
      <motion.div variants={fadeInUp}>
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary-600" />
              Device Preview
            </CardTitle>
            <CardDescription>
              See how your theme looks across different devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-8">
              {/* Desktop Preview */}
              <div className="text-center">
                <div className={`w-64 h-40 rounded-lg ${resortThemes[resortTheme].gradient} border-4 border-slate-800 shadow-xl relative overflow-hidden`}>
                  <div className="absolute top-0 left-0 right-0 h-6 bg-slate-800 flex items-center px-2 gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  </div>
                  <div className="absolute top-8 left-2 right-2 bottom-2 bg-white/80 rounded flex items-center justify-center">
                    <span className="text-4xl">{resortThemes[resortTheme].icon}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-3 text-slate-600">
                  <Monitor className="w-4 h-4" />
                  <span className="text-sm">Desktop</span>
                </div>
              </div>

              {/* Mobile Preview */}
              <div className="text-center">
                <div className={`w-24 h-44 rounded-2xl ${resortThemes[resortTheme].gradient} border-4 border-slate-800 shadow-xl relative overflow-hidden`}>
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-slate-800 rounded-full" />
                  <div className="absolute top-5 left-2 right-2 bottom-4 bg-white/80 rounded flex items-center justify-center">
                    <span className="text-2xl">{resortThemes[resortTheme].icon}</span>
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
