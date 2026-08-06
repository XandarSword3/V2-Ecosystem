'use client';

import { useRouter, useParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { Moon, Sun, Monitor, ArrowRight, Palette } from 'lucide-react';

// ─── Dark / Light / System toggle ────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark',  label: 'Dark',  icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

type ThemeValue = typeof THEME_OPTIONS[number]['value'];

function ThemeModeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-3 gap-3">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const isSelected = theme === value;
        return (
          <motion.button
            key={value}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setTheme(value)}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all ${
              isSelected
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Icon className={`w-7 h-7 ${isSelected ? 'text-primary-500' : 'text-slate-400'}`} />
            <span className="text-sm font-medium">{label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AppearanceSettingsPage() {
  const params = useParams();
  const propertySlug = (params?.property as string) || 'default';

  const router = useRouter();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-8 max-w-2xl"
    >
      {/* Header */}
      <motion.div variants={fadeInUp}>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Monitor className="w-8 h-8 text-primary-600" />
          Appearance
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Interface display mode and colour scheme.
        </p>
      </motion.div>

      {/* Dark / light mode */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-primary-600" />
              Display Mode
            </CardTitle>
            <CardDescription>
              Choose how the admin interface is rendered. System follows your OS setting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeModeSelector />
          </CardContent>
        </Card>
      </motion.div>

      {/* Redirect callout → Brand settings */}
      <motion.div variants={fadeInUp}>
        <Card className="border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/40">
                  <Palette className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white mb-1">
                    Brand colours, fonts & themes
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Your property's colour palette, typography, logo, and preset theme selection
                    have moved to the Brand settings page. Changes there update the guest-facing
                    site in real time.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => router.push(`/${propertySlug}/admin/settings/brand`)}
                className="shrink-0 flex items-center gap-2"
              >
                Brand Settings
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
