'use client';

import { useState, useEffect } from 'react';
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
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface SiteSettings {
  // Resort Info
  resortName: string;
  restaurantName: string;
  snackBarName: string;
  poolName: string;
  tagline: string;
  description: string;

  // Contact Info
  phone: string;
  email: string;
  address: string;

  // Business Hours
  poolHours: string;
  restaurantHours: string;
  receptionHours: string;

  // Chalet Settings
  chaletCheckIn: string;
  chaletCheckOut: string;
  chaletDeposit: number;
  chaletDepositType: 'percentage' | 'fixed';
  chaletDepositFixed: number;
  chaletMinNights: number;
  chaletMaxNights: number;
  cancellationPolicy: string;

  // Pool Settings
  poolAdultPrice: number;
  poolChildPrice: number;
  poolInfantPrice: number;
  poolCapacity: number;

  // Legal
  privacyPolicy: string;
  termsOfService: string;
  refundPolicy: string;
}

const defaultSettings: SiteSettings = {
  resortName: 'V2 Resort',
  restaurantName: 'V2 Restaurant',
  snackBarName: 'V2 Snack Bar',
  poolName: 'V2 Pool',
  tagline: "Lebanon's Premier Resort Experience",
  description: 'Your premium destination for exceptional dining, comfortable chalets, and refreshing pool experiences in the heart of Lebanon.',
  phone: '+961 XX XXX XXX',
  email: 'info@v2resort.com',
  address: 'V2 Resort, Lebanon',
  poolHours: '9:00 AM - 7:00 PM',
  restaurantHours: '8:00 AM - 11:00 PM',
  receptionHours: '24/7',
  chaletCheckIn: '3:00 PM',
  chaletCheckOut: '12:00 PM',
  chaletDeposit: 30,
  chaletDepositType: 'percentage',
  chaletDepositFixed: 100,
  chaletMinNights: 1,
  chaletMaxNights: 30,
  cancellationPolicy: 'Free cancellation up to 48 hours before check-in. 50% charge for late cancellations.',
  poolAdultPrice: 15,
  poolChildPrice: 10,
  poolInfantPrice: 0,
  poolCapacity: 100,
  privacyPolicy: '',
  termsOfService: '',
  refundPolicy: '',
};

export default function AdminSettingsPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'contact' | 'hours' | 'chalets' | 'pool' | 'legal'>('general');

  useEffect(() => {
    // Load settings from API
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/admin/settings');
      if (response.data?.data) {
        setSettings({ ...defaultSettings, ...response.data.data });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await api.put('/admin/settings', settings);
      toast.success('Settings saved successfully!');
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
                value={settings.resortName}
                onChange={(e) => setSettings({ ...settings, resortName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Restaurant Name
                </label>
                <Input
                  value={settings.restaurantName}
                  onChange={(e) => setSettings({ ...settings, restaurantName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Snack Bar Name
                </label>
                <Input
                  value={settings.snackBarName}
                  onChange={(e) => setSettings({ ...settings, snackBarName: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tagline
              </label>
              <Input
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                rows={3}
                value={settings.description}
                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
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
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
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
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
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
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
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
                  value={settings.poolHours}
                  onChange={(e) => setSettings({ ...settings, poolHours: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Restaurant Hours
                </label>
                <input
                  type="text"
                  value={settings.restaurantHours}
                  onChange={(e) => setSettings({ ...settings, restaurantHours: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Reception Hours
                </label>
                <input
                  type="text"
                  value={settings.receptionHours}
                  onChange={(e) => setSettings({ ...settings, receptionHours: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        );

      case 'chalets':
        return (
          <div className="space-y-8">
            {/* Check-in/Check-out Times */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Check-in & Check-out</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Check-in Time
                  </label>
                  <input
                    type="text"
                    value={settings.chaletCheckIn}
                    onChange={(e) => setSettings({ ...settings, chaletCheckIn: e.target.value })}
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
                    value={settings.chaletCheckOut}
                    onChange={(e) => setSettings({ ...settings, chaletCheckOut: e.target.value })}
                    placeholder="e.g., 12:00 PM"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Deposit Configuration */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Deposit Configuration
              </h3>

              {/* Deposit Type Toggle */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Deposit Type
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, chaletDepositType: 'percentage' })}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${settings.chaletDepositType === 'percentage'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                  >
                    <div className="font-medium">Percentage</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">e.g., 30% of booking total</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, chaletDepositType: 'fixed' })}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${settings.chaletDepositType === 'fixed'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                  >
                    <div className="font-medium">Fixed Amount</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">e.g., $100 flat deposit</div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {settings.chaletDepositType === 'percentage' ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Deposit Percentage
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={settings.chaletDeposit}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                          setSettings({ ...settings, chaletDeposit: val });
                        }}
                        className="w-full px-4 py-2 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">%</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter a value between 0-100%</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Fixed Deposit Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                      <input
                        type="number"
                        min="0"
                        value={settings.chaletDepositFixed}
                        onChange={(e) => setSettings({ ...settings, chaletDepositFixed: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-full px-4 py-2 pl-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Fixed amount charged at booking</p>
                  </div>
                )}

                {/* Deposit Preview Calculator */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">📊 Deposit Preview</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Example: $500 booking total
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Deposit required:</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      ${settings.chaletDepositType === 'percentage'
                        ? ((500 * settings.chaletDeposit) / 100).toFixed(2)
                        : settings.chaletDepositFixed.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Constraints */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Booking Constraints</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Minimum Nights
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.chaletMinNights}
                    onChange={(e) => setSettings({ ...settings, chaletMinNights: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Maximum Nights
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.chaletMaxNights}
                    onChange={(e) => setSettings({ ...settings, chaletMaxNights: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Cancellation Policy */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Cancellation Policy</h3>
              <textarea
                rows={4}
                value={settings.cancellationPolicy}
                onChange={(e) => setSettings({ ...settings, cancellationPolicy: e.target.value })}
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
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Pool Name
              </label>
              <input
                type="text"
                value={settings.poolName}
                onChange={(e) => setSettings({ ...settings, poolName: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Adult Price ($)
                </label>
                <input
                  type="number"
                  value={settings.poolAdultPrice}
                  onChange={(e) => setSettings({ ...settings, poolAdultPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Child Price ($)
                </label>
                <input
                  type="number"
                  value={settings.poolChildPrice}
                  onChange={(e) => setSettings({ ...settings, poolChildPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Infant Price ($)
                </label>
                <input
                  type="number"
                  value={settings.poolInfantPrice}
                  onChange={(e) => setSettings({ ...settings, poolInfantPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Max Capacity
                </label>
                <input
                  type="number"
                  value={settings.poolCapacity}
                  onChange={(e) => setSettings({ ...settings, poolCapacity: parseInt(e.target.value) || 0 })}
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
                value={settings.privacyPolicy}
                onChange={(e) => setSettings({ ...settings, privacyPolicy: e.target.value })}
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
                value={settings.termsOfService}
                onChange={(e) => setSettings({ ...settings, termsOfService: e.target.value })}
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
                value={settings.refundPolicy}
                onChange={(e) => setSettings({ ...settings, refundPolicy: e.target.value })}
                placeholder="Enter your refund policy content..."
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        );
    }
  };

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

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${activeTab === tab.id
              ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Card className="border border-slate-200 dark:border-slate-700">
        <CardContent className="p-6">
          {renderTabContent()}
        </CardContent>
      </Card>
    </div>
  );
}
