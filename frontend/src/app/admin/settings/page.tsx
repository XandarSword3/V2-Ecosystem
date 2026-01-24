'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSiteSettings } from '@/lib/settings-context';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  Settings,
  Save,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  FileText,
  CreditCard,
  Globe,
  Package,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function AdminSettingsPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  const { settings, modules, refetch, loading } = useSiteSettings();
  const [formSettings, setFormSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'modules' | 'contact' | 'hours' | 'chalets' | 'pool' | 'legal'>('general');

  // Get active modules for the modules tab
  const activeModules = useMemo(() => {
    if (!modules || modules.length === 0) return [];
    return modules
      .filter(m => m.is_active)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [modules]);

  useEffect(() => {
    setFormSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/admin/settings', formSettings);
      toast.success('Settings saved successfully!');
      await refetch();
    } catch (error) {
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to update module-specific settings
  const updateModuleSetting = (moduleSlug: string, field: string, value: string) => {
    setFormSettings({
      ...formSettings,
      moduleSettings: {
        ...(formSettings.moduleSettings || {}),
        [moduleSlug]: {
          ...((formSettings.moduleSettings as Record<string, Record<string, string>> || {})[moduleSlug] || {}),
          [field]: value,
        },
      },
    });
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Building2 },
    ...(activeModules.length > 0 ? [{ id: 'modules' as const, label: 'Modules', icon: Package }] : []),
    { id: 'contact' as const, label: 'Contact', icon: Phone },
    { id: 'hours' as const, label: 'Business Hours', icon: Clock },
    { id: 'chalets' as const, label: 'Chalets', icon: Building2 },
    { id: 'pool' as const, label: 'Pool', icon: Globe },
    { id: 'legal' as const, label: 'Legal Pages', icon: FileText },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Resort Name
              </label>
              <Input
                value={formSettings.resortName || ''}
                onChange={(e) => setFormSettings({ ...formSettings, resortName: e.target.value })}
                placeholder="Enter your resort name"
              />
              {!formSettings.resortName && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Using default: V2 Resort
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tagline
              </label>
              <Input
                value={formSettings.tagline || ''}
                onChange={(e) => setFormSettings({ ...formSettings, tagline: e.target.value })}
                placeholder="Enter a catchy tagline for your resort"
              />
              {!formSettings.tagline && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Using default: Premier Resort Experience
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                rows={3}
                value={formSettings.description || ''}
                onChange={(e) => setFormSettings({ ...formSettings, description: e.target.value })}
                placeholder="Describe your resort in a few sentences"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        );

      case 'modules':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-2xl p-4 border border-primary-100 dark:border-primary-800 mb-6">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Configure display names and settings for each of your active modules.
                These names will appear throughout the site.
              </p>
            </div>
            
            {activeModules.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active modules found.</p>
                <p className="text-sm">Go to Module Builder to create and activate modules.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {activeModules.map((module) => {
                  const moduleSettings = (formSettings.moduleSettings as Record<string, Record<string, string>> || {})[module.slug] || {};
                  return (
                    <div key={module.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center">
                          <Package className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-900 dark:text-white">{module.name}</h4>
                          <p className="text-xs text-slate-500">Slug: {module.slug} • Type: {module.template_type}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Display Name
                          </label>
                          <Input
                            value={moduleSettings.displayName || ''}
                            onChange={(e) => updateModuleSetting(module.slug, 'displayName', e.target.value)}
                            placeholder={module.name}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Business Hours
                          </label>
                          <Input
                            value={moduleSettings.hours || ''}
                            onChange={(e) => updateModuleSetting(module.slug, 'hours', e.target.value)}
                            placeholder="e.g., 9:00 AM - 10:00 PM"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Phone Number
                </label>
                <input
                  type="text"
                  value={formSettings.phone || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {!formSettings.phone && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    No phone number set - visitors won't see a contact number
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </label>
                <input
                  type="email"
                  value={formSettings.email || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, email: e.target.value })}
                  placeholder="contact@yourresort.com"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {!formSettings.email && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Using default: support@v2resort.com
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                Address
              </label>
              <input
                type="text"
                value={formSettings.address || ''}
                onChange={(e) => setFormSettings({ ...formSettings, address: e.target.value })}
                placeholder="123 Resort Boulevard, Beach City, State 12345"
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {!formSettings.address && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  No address set - consider adding your location
                </p>
              )}
            </div>
          </div>
        );

      case 'hours':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800 mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Set your standard business hours. Individual module hours can be configured in the Modules tab.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Pool Hours
                </label>
                <input
                  type="text"
                  value={formSettings.poolHours || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, poolHours: e.target.value })}
                  placeholder="e.g., 8:00 AM - 8:00 PM"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Restaurant Hours
                </label>
                <input
                  type="text"
                  value={formSettings.restaurantHours || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, restaurantHours: e.target.value })}
                  placeholder="e.g., 7:00 AM - 11:00 PM"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Reception Hours
                </label>
                <input
                  type="text"
                  value={formSettings.receptionHours || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, receptionHours: e.target.value })}
                  placeholder="e.g., 24 Hours"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        );

      case 'chalets':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Check-in & Check-out</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Check-in Time
                  </label>
                  <input
                    type="text"
                    value={formSettings.checkIn || ''}
                    onChange={(e) => setFormSettings({ ...formSettings, checkIn: e.target.value })}
                    placeholder="e.g., 3:00 PM"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {!formSettings.checkIn && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Default: 3:00 PM
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Check-out Time
                  </label>
                  <input
                    type="text"
                    value={formSettings.checkOut || ''}
                    onChange={(e) => setFormSettings({ ...formSettings, checkOut: e.target.value })}
                    placeholder="e.g., 12:00 PM"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {!formSettings.checkOut && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Default: 12:00 PM
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Deposit Configuration
              </h3>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Deposit Percentage
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formSettings.depositPercent || 0}
                    onChange={(e) => setFormSettings({ ...formSettings, depositPercent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                    placeholder="30"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                </div>
                {!formSettings.depositPercent && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Default: 30% deposit required
                  </p>
                )}
              </div>
            </div>



            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Cancellation Policy</h3>
              <textarea
                rows={4}
                value={formSettings.cancellationPolicy || ''}
                onChange={(e) => setFormSettings({ ...formSettings, cancellationPolicy: e.target.value })}
                placeholder="Describe your cancellation policy. Example: Free cancellation up to 48 hours before check-in. 50% refund for cancellations within 48 hours. No refund for no-shows."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                This will be displayed to customers during the booking process.
              </p>
            </div>
          </div>
        );

      case 'pool':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800 mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Configure pricing and capacity for pool sessions.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Adult Price ($)
                </label>
                <input
                  type="number"
                  value={formSettings.adultPrice || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, adultPrice: parseFloat(e.target.value) || 0 })}
                  placeholder="25.00"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {!formSettings.adultPrice && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Price not set
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Child Price ($)
                </label>
                <input
                  type="number"
                  value={formSettings.childPrice || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, childPrice: parseFloat(e.target.value) || 0 })}
                  placeholder="15.00"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {!formSettings.childPrice && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Price not set
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Infant Price ($)
                </label>
                <input
                  type="number"
                  value={formSettings.infantPrice || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, infantPrice: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Max Capacity
                </label>
                <input
                  type="number"
                  value={formSettings.capacity || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, capacity: parseInt(e.target.value) || 0 })}
                  placeholder="100"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {!formSettings.capacity && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    No capacity limit set
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'legal':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-4 border border-purple-100 dark:border-purple-800 mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enter the legal content for your resort. These pages are accessible via the footer links.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Privacy Policy
              </label>
              <textarea
                rows={6}
                value={formSettings.privacyPolicy || ''}
                onChange={(e) => setFormSettings({ ...formSettings, privacyPolicy: e.target.value })}
                placeholder="Enter your privacy policy content. Explain how you collect, use, and protect guest data..."
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {!formSettings.privacyPolicy && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  No privacy policy set - recommended for legal compliance
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Terms of Service
              </label>
              <textarea
                rows={6}
                value={formSettings.termsOfService || ''}
                onChange={(e) => setFormSettings({ ...formSettings, termsOfService: e.target.value })}
                placeholder="Enter your terms of service. Include booking conditions, guest responsibilities, liability limitations..."
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {!formSettings.termsOfService && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  No terms of service set - recommended for legal compliance
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Refund Policy
              </label>
              <textarea
                rows={6}
                value={formSettings.refundPolicy || ''}
                onChange={(e) => setFormSettings({ ...formSettings, refundPolicy: e.target.value })}
                placeholder="Enter your refund policy. Explain refund conditions, timeframes, and procedures..."
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {!formSettings.refundPolicy && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  No refund policy set - recommended for booking services
                </p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!formSettings) return null;
  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Settings className="w-8 h-8 text-primary-600" />
              {t('settings')}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Manage your resort settings, contact information, pricing, and policies
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : tCommon('save')}
          </Button>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeTab === tab.id
                ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="border border-slate-200 dark:border-slate-700">
        <CardContent className="p-6">
          {renderTabContent()}
        </CardContent>
      </Card>
    </div>
  );
}
