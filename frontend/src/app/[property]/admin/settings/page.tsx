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
  ShieldCheck,
  ExternalLink,
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
  const [activeTab, setActiveTab] = useState<string>('general');

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

  // Dynamically generate module-specific tabs based on active modules
  const moduleSpecificTabs = useMemo(() => {
    const tabs: { id: string; label: string; icon: typeof Building2; moduleSlug: string; templateType: string }[] = [];
    
    activeModules.forEach(module => {
      // Add settings tab for modules that have configurable settings
      if (module.template_type === 'time_exclusive_reservation') {
        tabs.push({
          id: `module-${module.slug}` as const,
          label: module.name,
          icon: Building2,
          moduleSlug: module.slug,
          templateType: module.template_type
        });
      } else if (module.template_type === 'shared_capacity_access') {
        tabs.push({
          id: `module-${module.slug}` as const,
          label: module.name,
          icon: Globe,
          moduleSlug: module.slug,
          templateType: module.template_type
        });
      }
    });
    
    return tabs;
  }, [activeModules]);

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Building2 },
    ...(activeModules.length > 0 ? [{ id: 'modules' as const, label: 'Modules', icon: Package }] : []),
    { id: 'contact' as const, label: 'Contact', icon: Phone },
    { id: 'hours' as const, label: 'Business Hours', icon: Clock },
    ...moduleSpecificTabs,
    { id: 'legal' as const, label: 'Legal Pages', icon: FileText },
    { id: 'compliance' as const, label: 'GDPR & Compliance', icon: ShieldCheck },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Business Name
              </label>
              <Input
                value={formSettings.siteName || ''}
                onChange={(e) => setFormSettings({ ...formSettings, siteName: e.target.value })}
                placeholder="Enter your business name"
              />
              {!formSettings.siteName && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Using default: Your Business
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
                placeholder="Enter a catchy tagline for your business"
              />
              {!formSettings.tagline && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Using default: Premier Experience
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
                placeholder="Describe your business in a few sentences"
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
                  placeholder="contact@yourbusiness.com"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {!formSettings.email && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Using default: support@yourbusiness.com
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
                placeholder="123 Main Street, Beach City, State 12345"
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
            
            <div className="grid grid-cols-1 gap-6">
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

      case 'legal':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-4 border border-purple-100 dark:border-purple-800 mb-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enter the legal content for your business. These pages are accessible via the footer links.
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
                placeholder="Enter your privacy policy content. Explain how you collect, use, and protect customer data..."
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
                placeholder="Enter your terms of service. Include booking conditions, responsibilities, liability limitations..."
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

      case 'compliance':
        const dpaData = formSettings.dpaAgreements || {};
        const updateDPA = (service: string, field: string, value: any) => {
          setFormSettings({
            ...formSettings,
            dpaAgreements: {
              ...dpaData,
              [service]: {
                ...(dpaData[service] || { status: false, dateCompleted: '', reference: '' }),
                [field]: value
              }
            }
          });
        };

        const renderDPAItem = (id: string, name: string, url: string, description: string) => {
          const data = dpaData[id] || { status: false, dateCompleted: '', reference: '' };
          return (
            <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mb-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-lg font-semibold flex items-center gap-2">
                    {name}
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 flex items-center text-sm font-normal">
                      <ExternalLink className="w-3 h-3 ml-1 mr-1" /> View Dashboard
                    </a>
                  </h4>
                  <p className="text-sm text-slate-500">{description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Agreement Accepted?</label>
                  <input 
                    type="checkbox" 
                    checked={data.status || false}
                    onChange={(e) => updateDPA(id, 'status', e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
              </div>

              {data.status && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Date Completed
                    </label>
                    <input
                      type="date"
                      value={data.dateCompleted || ''}
                      onChange={(e) => updateDPA(id, 'dateCompleted', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Reference Number / Confirmation
                    </label>
                    <input
                      type="text"
                      value={data.reference || ''}
                      onChange={(e) => updateDPA(id, 'reference', e.target.value)}
                      placeholder="e.g. Agreement ID or Signer Email"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <ShieldCheck className="w-6 h-6 text-green-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Data Processing Agreements (DPAs)</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                To maintain GDPR compliance, you must legally accept Data Processing Agreements with all third-party sub-processors used by the platform. This tab serves as an internal audit trail to track when these agreements were accepted.
              </p>
            </div>

            <div className="space-y-2">
              {renderDPAItem(
                'stripe',
                'Stripe (Payments)',
                'https://dashboard.stripe.com/settings/compliance',
                'Processes customer payment information and billing data.'
              )}
              {renderDPAItem(
                'twilio',
                'Twilio (SMS & Comms)',
                'https://console.twilio.com/us1/account/trust-hub/compliance',
                'Processes customer phone numbers for SMS notifications.'
              )}
              {renderDPAItem(
                'sentry',
                'Sentry (Error Tracking)',
                'https://sentry.io/settings/account/legal/dpa/',
                'Processes application errors which may temporarily contain PII.'
              )}
            </div>
          </div>
        );

      default:
        // Handle dynamic module tabs
        if (activeTab.startsWith('module-')) {
          const moduleSlug = activeTab.replace('module-', '');
          const module = activeModules.find(m => m.slug === moduleSlug);
          
          if (!module) return null;
          
          const moduleSettings = (formSettings.moduleSettings as Record<string, Record<string, string | number>> || {})[moduleSlug] || {};
          
          if (module.template_type === 'time_exclusive_reservation') {
            // Multi-day booking settings (like units/rooms)
            return (
              <div className="space-y-8">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800 mb-4">
                  <h3 className="font-medium text-slate-900 dark:text-white mb-2">{module.name} Settings</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Configure check-in/out times, deposit requirements, and policies for {module.name.toLowerCase()}.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Check-in & Check-out</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Check-in Time
                      </label>
                      <input
                        type="text"
                        value={moduleSettings.checkIn as string || ''}
                        onChange={(e) => updateModuleSetting(moduleSlug, 'checkIn', e.target.value)}
                        placeholder="e.g., 3:00 PM"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Check-out Time
                      </label>
                      <input
                        type="text"
                        value={moduleSettings.checkOut as string || ''}
                        onChange={(e) => updateModuleSetting(moduleSlug, 'checkOut', e.target.value)}
                        placeholder="e.g., 12:00 PM"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
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
                        value={moduleSettings.depositPercent as number || 0}
                        onChange={(e) => updateModuleSetting(moduleSlug, 'depositPercent', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)).toString())}
                        placeholder="30"
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Cancellation Policy</h3>
                  <textarea
                    rows={4}
                    value={moduleSettings.cancellationPolicy as string || ''}
                    onChange={(e) => updateModuleSetting(moduleSlug, 'cancellationPolicy', e.target.value)}
                    placeholder="Describe your cancellation policy..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            );
          } else if (module.template_type === 'shared_capacity_access') {
            return (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800 mb-4">
                  <h3 className="font-medium text-slate-900 dark:text-white mb-2">{module.name} Settings</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Configure pricing and capacity for {module.name.toLowerCase()} sessions.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Adult Price ($)
                    </label>
                    <input
                      type="number"
                      value={moduleSettings.adultPrice as number || ''}
                      onChange={(e) => updateModuleSetting(moduleSlug, 'adultPrice', e.target.value)}
                      placeholder="25.00"
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Child Price ($)
                    </label>
                    <input
                      type="number"
                      value={moduleSettings.childPrice as number || ''}
                      onChange={(e) => updateModuleSetting(moduleSlug, 'childPrice', e.target.value)}
                      placeholder="15.00"
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Infant Price ($)
                    </label>
                    <input
                      type="number"
                      value={moduleSettings.infantPrice as number || ''}
                      onChange={(e) => updateModuleSetting(moduleSlug, 'infantPrice', e.target.value)}
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
                      value={moduleSettings.capacity as number || ''}
                      onChange={(e) => updateModuleSetting(moduleSlug, 'capacity', e.target.value)}
                      placeholder="100"
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            );
          }
        }
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
              Manage your business settings, contact information, pricing, and policies
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
