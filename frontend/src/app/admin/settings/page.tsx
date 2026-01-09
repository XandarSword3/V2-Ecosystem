'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function AdminSettingsPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  const { settings, refetch, loading } = useSiteSettings();
  const [formSettings, setFormSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'contact' | 'hours' | 'chalets' | 'pool' | 'legal'>('general');

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

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Building2 },
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
                value={formSettings.resortName}
                onChange={(e) => setFormSettings({ ...formSettings, resortName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Restaurant Name
                </label>
                <Input
                  value={formSettings.restaurantName}
                  onChange={(e) => setFormSettings({ ...formSettings, restaurantName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Snack Bar Name
                </label>
                <Input
                  value={formSettings.snackBarName}
                  onChange={(e) => setFormSettings({ ...formSettings, snackBarName: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Pool Name
              </label>
              <Input
                value={formSettings.poolName}
                onChange={(e) => setFormSettings({ ...formSettings, poolName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tagline
              </label>
              <Input
                value={formSettings.tagline}
                onChange={(e) => setFormSettings({ ...formSettings, tagline: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                rows={3}
                value={formSettings.description}
                onChange={(e) => setFormSettings({ ...formSettings, description: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
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
                  value={formSettings.phone}
                  onChange={(e) => setFormSettings({ ...formSettings, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </label>
                <input
                  type="email"
                  value={formSettings.email}
                  onChange={(e) => setFormSettings({ ...formSettings, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                Address
              </label>
              <input
                type="text"
                value={formSettings.address}
                onChange={(e) => setFormSettings({ ...formSettings, address: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        );

      case 'hours':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Pool Hours
                </label>
                <input
                  type="text"
                  value={formSettings.poolHours}
                  onChange={(e) => setFormSettings({ ...formSettings, poolHours: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Restaurant Hours
                </label>
                <input
                  type="text"
                  value={formSettings.restaurantHours}
                  onChange={(e) => setFormSettings({ ...formSettings, restaurantHours: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Reception Hours
                </label>
                <input
                  type="text"
                  value={formSettings.receptionHours}
                  onChange={(e) => setFormSettings({ ...formSettings, receptionHours: e.target.value })}
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
                    value={formSettings.checkIn}
                    onChange={(e) => setFormSettings({ ...formSettings, checkIn: e.target.value })}
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
                    value={formSettings.checkOut}
                    onChange={(e) => setFormSettings({ ...formSettings, checkOut: e.target.value })}
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
                    value={formSettings.depositPercent}
                    onChange={(e) => setFormSettings({ ...formSettings, depositPercent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
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
                value={formSettings.cancellationPolicy}
                onChange={(e) => setFormSettings({ ...formSettings, cancellationPolicy: e.target.value })}
                placeholder="Describe your cancellation policy..."
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Adult Price ($)
                </label>
                <input
                  type="number"
                  value={formSettings.adultPrice}
                  onChange={(e) => setFormSettings({ ...formSettings, adultPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Child Price ($)
                </label>
                <input
                  type="number"
                  value={formSettings.childPrice}
                  onChange={(e) => setFormSettings({ ...formSettings, childPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Infant Price ($)
                </label>
                <input
                  type="number"
                  value={formSettings.infantPrice}
                  onChange={(e) => setFormSettings({ ...formSettings, infantPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Max Capacity
                </label>
                <input
                  type="number"
                  value={formSettings.capacity}
                  onChange={(e) => setFormSettings({ ...formSettings, capacity: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        );

      case 'legal':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Privacy Policy
              </label>
              <textarea
                rows={6}
                value={formSettings.privacyPolicy}
                onChange={(e) => setFormSettings({ ...formSettings, privacyPolicy: e.target.value })}
                placeholder="Enter your privacy policy content..."
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Terms of Service
              </label>
              <textarea
                rows={6}
                value={formSettings.termsOfService}
                onChange={(e) => setFormSettings({ ...formSettings, termsOfService: e.target.value })}
                placeholder="Enter your terms of service content..."
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Refund Policy
              </label>
              <textarea
                rows={6}
                value={formSettings.refundPolicy}
                onChange={(e) => setFormSettings({ ...formSettings, refundPolicy: e.target.value })}
                placeholder="Enter your refund policy content..."
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
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