'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSiteSettings } from '@/lib/settings-context';
import { useEffect, useRef } from 'react';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Palette,
  Volume2,
  VolumeX,
  Monitor,
  Smartphone,
  Save,
  RotateCcw,
  Zap,
} from 'lucide-react';

// Theme selection UI removed


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

export default function AppearanceSettingsPage() {
  const { settings, refetch } = useSiteSettings();
  const [animationsEnabled, setAnimationsEnabled] = useState(settings.animationsEnabled ?? true);
  const [reducedMotion, setReducedMotion] = useState(settings.reducedMotion ?? false);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled ?? true);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const newSettings = {
        ...settings,
        animationsEnabled,
        reducedMotion,
        soundEnabled
      };
      await api.put('/admin/settings', newSettings);
      await refetch();
      setHasChanges(false);
      toast.success('Appearance settings saved!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
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
