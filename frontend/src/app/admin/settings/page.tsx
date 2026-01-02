'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import api from '@/lib/api';
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

interface SiteSettings {
  // Resort Info
  resortName: string;
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
  chaletDeposit: 50,
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
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
      // Use default settings if API fails
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      await api.put('/admin/settings', settings);
      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
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
              <input
                type="text"
                value={settings.resortName}
                onChange={(e) => setSettings({ ...settings, resortName: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tagline
              </label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Check-in Time
                </label>
                <input
                  type="text"
                  value={settings.chaletCheckIn}
                  onChange={(e) => setSettings({ ...settings, chaletCheckIn: e.target.value })}
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
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Deposit (%)
                </label>
                <input
                  type="number"
                  value={settings.chaletDeposit}
                  onChange={(e) => setSettings({ ...settings, chaletDeposit: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Cancellation Policy
              </label>
              <textarea
                rows={3}
                value={settings.cancellationPolicy}
                onChange={(e) => setSettings({ ...settings, cancellationPolicy: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
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
        
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-4 rounded-xl flex items-center gap-2 ${
              saveMessage.type === 'success' 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}
          >
            {saveMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {saveMessage.text}
          </motion.div>
        )}
      </motion.div>

      {/* Tabs */}
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

      {/* Tab Content */}
      <Card className="border border-slate-200 dark:border-slate-700">
        <CardContent className="p-6">
          {renderTabContent()}
        </CardContent>
      </Card>
    </div>
  );
}
