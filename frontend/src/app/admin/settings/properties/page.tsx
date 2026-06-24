'use client';

import { useState, useEffect } from 'react';
import { useProperty } from '@/context/PropertyContext';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  Settings,
  Save,
  Building2,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Loader2,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

interface ResolvedSetting {
  key: string;
  value: any;
  source: 'property' | 'group' | 'system' | 'default';
  category?: string;
  description?: string;
}

// Friendly titles and descriptions for settings
const SETTING_METADATA: Record<string, { label: string; description: string; type: 'text' | 'number' | 'boolean' }> = {
  currency: {
    label: 'Default Currency',
    description: 'The primary currency used for pricing, bookings, and billing (e.g., USD, EUR).',
    type: 'text',
  },
  timezone: {
    label: 'Default Timezone',
    description: 'The operational timezone for booking calculations and check-in schedules (e.g., UTC, Europe/London).',
    type: 'text',
  },
  tax_rate: {
    label: 'Tax Rate (%)',
    description: 'The standard tax percentage applied to bookings and orders (e.g., 11 for 11%).',
    type: 'number',
  },
  cancellation_policy_hours: {
    label: 'Free Cancellation Period (Hours)',
    description: 'The duration before check-in during which guests can cancel for free.',
    type: 'number',
  },
  max_guests_per_booking: {
    label: 'Max Guests per Booking',
    description: 'The maximum allowable guest count per individual unit booking.',
    type: 'number',
  },
  auto_confirm_bookings: {
    label: 'Auto-Confirm Bookings',
    description: 'If enabled, new bookings are automatically confirmed without admin review.',
    type: 'boolean',
  },
  require_payment_upfront: {
    label: 'Require Upfront Payment',
    description: 'If enabled, guests must complete payment at booking or ordering time.',
    type: 'boolean',
  },
  loyalty_enabled: {
    label: 'Enable Loyalty Program',
    description: 'Toggle the loyalty points accumulation and reward system for this property.',
    type: 'boolean',
  },
  review_moderation: {
    label: 'Enable Review Moderation',
    description: 'If enabled, guest reviews require approval before becoming publicly visible.',
    type: 'boolean',
  },
};

const CATEGORY_METADATA: Record<string, { label: string; description: string }> = {
  general: {
    label: 'General Configuration',
    description: 'Core property metadata, localization, and operational parameters.',
  },
  finance: {
    label: 'Financials & Taxes',
    description: 'Tax rates, payment enforcement, and currency options.',
  },
  booking: {
    label: 'Booking & Reservations',
    description: 'Cancellation parameters, capacities, and verification rules.',
  },
  loyalty: {
    label: 'Loyalty & Rewards',
    description: 'Rewards program toggles and loyalty integrations.',
  },
  content: {
    label: 'Content & Moderation',
    description: 'Guest feedback, reviews, and approval pipelines.',
  },
};

export default function PropertySettingsPage() {
  const tCommon = useTranslations('common');
  const { activeProperty, activePropertyId, loading: propertyLoading } = useProperty();

  const [settings, setSettings] = useState<ResolvedSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  
  // Track overridden status locally for toggles before save
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [editableValues, setEditableValues] = useState<Record<string, any>>({});

  const fetchSettings = async () => {
    if (!activePropertyId) return;
    setLoading(true);
    try {
      const res = await api.get(`/multi-property/properties/${activePropertyId}/settings`);
      const fetchedSettings: ResolvedSetting[] = res.data.data || [];
      setSettings(fetchedSettings);

      // Initialize form values and overridden states
      const initialOverrides: Record<string, boolean> = {};
      const initialValues: Record<string, any> = {};

      fetchedSettings.forEach((setting) => {
        initialOverrides[setting.key] = setting.source === 'property';
        // Parse value to native type if it is a JSON string or keeps as is
        let val = setting.value;
        if (typeof val === 'string') {
          try {
            val = JSON.parse(val);
          } catch {
            // Keep as string
          }
        }
        initialValues[setting.key] = val;
      });

      setOverrides(initialOverrides);
      setEditableValues(initialValues);
    } catch (error) {
      console.error('Failed to load property settings:', error);
      toast.error('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [activePropertyId]);

  // Handle setting override checkbox toggle
  const handleToggleOverride = async (key: string, checked: boolean) => {
    setOverrides((prev) => ({ ...prev, [key]: checked }));

    // If turned off, immediately delete the override in DB and fallback
    if (!checked) {
      setSavingKey(key);
      try {
        await api.delete(`/multi-property/properties/${activePropertyId}/settings?key=${key}`);
        toast.success(`Removed custom override for ${SETTING_METADATA[key]?.label || key}.`);
        await fetchSettings();
      } catch (error) {
        console.error('Failed to delete setting override:', error);
        toast.error('Failed to remove custom override.');
        // Revert UI toggle
        setOverrides((prev) => ({ ...prev, [key]: true }));
      } finally {
        setSavingKey(null);
      }
    }
  };

  // Save an overridden setting value to DB
  const handleSaveSetting = async (key: string) => {
    setSavingKey(key);
    try {
      const rawValue = editableValues[key];
      const setting = settings.find((s) => s.key === key);
      const category = setting?.category || 'general';

      await api.put(`/multi-property/properties/${activePropertyId}/settings`, {
        key,
        value: rawValue,
        category,
      });

      toast.success(`Saved custom override for ${SETTING_METADATA[key]?.label || key}!`);
      await fetchSettings();
    } catch (error) {
      console.error('Failed to save setting override:', error);
      toast.error('Failed to save settings.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleInputChange = (key: string, val: any) => {
    setEditableValues((prev) => ({ ...prev, [key]: val }));
  };

  // Group settings by category
  const settingsByCategory = settings.reduce((acc, setting) => {
    const category = setting.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, ResolvedSetting[]>);

  const getSourceBadge = (source: ResolvedSetting['source']) => {
    switch (source) {
      case 'property':
        return <Badge variant="success">Property Override</Badge>;
      case 'group':
        return <Badge variant="info">Group Default</Badge>;
      case 'system':
        return <Badge variant="secondary">System Default</Badge>;
      default:
        return <Badge variant="warning">Fallback</Badge>;
    }
  };

  const isGlobalLoading = propertyLoading || (!activePropertyId && loading);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header section with modern backdrop blur and subtle animations */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 pb-6 border-b border-slate-200 dark:border-slate-800"
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-indigo-600 text-white rounded-2xl shadow-lg shadow-primary-500/20">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-white dark:via-indigo-100 dark:to-white bg-clip-text text-transparent">
                Property Settings
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Manage property-level settings overrides and cascading configurations.
              </p>
            </div>
          </div>
        </div>

        {activeProperty && (
          <div className="flex items-center gap-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 px-4 py-2.5 rounded-2xl">
            <Building2 className="w-5 h-5 text-indigo-500" />
            <div>
              <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">
                Configuring Property
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {activeProperty.name}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-4 h-8 px-2.5 border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/80 rounded-xl"
              onClick={fetchSettings}
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}
      </motion.div>

      {isGlobalLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      ) : !activePropertyId ? (
        <Card className="border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">
            No Active Property Selected
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Please select a property from the property switcher at the top of the page to customize its settings.
          </p>
        </Card>
      ) : (
        <div className="space-y-10">
          <AnimatePresence mode="popLayout">
            {Object.keys(CATEGORY_METADATA).map((categoryKey, catIdx) => {
              const category = CATEGORY_METADATA[categoryKey];
              const categorySettings = settingsByCategory[categoryKey] || [];

              if (categorySettings.length === 0) return null;

              return (
                <motion.div
                  key={categoryKey}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: catIdx * 0.05 }}
                  className="space-y-4"
                >
                  <div className="border-l-4 border-indigo-500 pl-4 py-1">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {category.label}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {category.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {categorySettings.map((setting) => {
                      const meta = SETTING_METADATA[setting.key] || {
                        label: setting.key,
                        description: setting.description || 'System setting.',
                        type: typeof setting.value === 'boolean' ? 'boolean' : typeof setting.value === 'number' ? 'number' : 'text',
                      };
                      const isOverridden = overrides[setting.key] || false;
                      const currentValue = editableValues[setting.key];
                      const isSaving = savingKey === setting.key;

                      return (
                        <Card
                          key={setting.key}
                          className={`transition-all duration-300 rounded-2xl border ${
                            isOverridden
                              ? 'border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/10 dark:bg-indigo-950/5 shadow-md shadow-indigo-500/5'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                              {/* Left column: Name, details and current status */}
                              <div className="space-y-3 flex-1">
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-100 text-base">
                                    {meta.label}
                                  </span>
                                  {getSourceBadge(setting.source)}
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                                  {meta.description}
                                </p>
                                
                                <div className="flex items-center gap-4 pt-1">
                                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                                    <span>Key:</span>
                                    <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-md font-mono text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700/30">
                                      {setting.key}
                                    </code>
                                  </div>
                                </div>
                              </div>

                              {/* Right column: Override triggers and Input controls */}
                              <div className="flex flex-col items-end justify-between min-w-[280px] self-stretch gap-4 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100 dark:border-slate-800/50">
                                <div className="flex items-center gap-3">
                                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer select-none">
                                    {isOverridden ? (
                                      <>
                                        <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                                        Custom Override
                                      </>
                                    ) : (
                                      <>
                                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                                        Locked to Inherited
                                      </>
                                    )}
                                  </label>
                                  <Switch
                                    checked={isOverridden}
                                    onCheckedChange={(checked) => handleToggleOverride(setting.key, checked)}
                                    disabled={isSaving}
                                  />
                                </div>

                                <div className="w-full flex items-center gap-2 mt-auto">
                                  <div className="flex-1">
                                    {meta.type === 'boolean' ? (
                                      <div className="flex items-center justify-end h-10 pr-2">
                                        <Switch
                                          checked={!!currentValue}
                                          onCheckedChange={(checked) => {
                                            handleInputChange(setting.key, checked);
                                            // Auto-save boolean switches for ease of use
                                            if (isOverridden) {
                                              setTimeout(() => {
                                                // Wrap in ref/timeout to fetch correct updated state
                                                setEditableValues((latest) => {
                                                  api.put(`/multi-property/properties/${activePropertyId}/settings`, {
                                                    key: setting.key,
                                                    value: checked,
                                                    category: setting.category || 'general',
                                                  }).then(() => {
                                                    toast.success(`Saved setting ${meta.label}!`);
                                                    fetchSettings();
                                                  }).catch(() => {
                                                    toast.error('Failed to save settings.');
                                                  });
                                                  return latest;
                                                });
                                              }, 100);
                                            }
                                          }}
                                          disabled={!isOverridden || isSaving}
                                        />
                                      </div>
                                    ) : meta.type === 'number' ? (
                                      <Input
                                        type="number"
                                        className="h-10 text-right font-medium text-slate-900 dark:text-white"
                                        value={currentValue !== undefined && currentValue !== null ? currentValue : ''}
                                        onChange={(e) => handleInputChange(setting.key, Number(e.target.value))}
                                        disabled={!isOverridden || isSaving}
                                      />
                                    ) : (
                                      <Input
                                        type="text"
                                        className="h-10 text-left font-medium text-slate-900 dark:text-white"
                                        value={currentValue !== undefined && currentValue !== null ? currentValue : ''}
                                        onChange={(e) => handleInputChange(setting.key, e.target.value)}
                                        disabled={!isOverridden || isSaving}
                                      />
                                    )}
                                  </div>

                                  {isOverridden && meta.type !== 'boolean' && (
                                    <Button
                                      size="sm"
                                      className="h-10 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all duration-300 shrink-0"
                                      onClick={() => handleSaveSetting(setting.key)}
                                      disabled={isSaving}
                                    >
                                      {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Save className="w-4 h-4" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
