'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Link as LinkIcon,
  Plus,
  Trash2,
  Save,
  GripVertical,
  ExternalLink,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
} from 'lucide-react';

interface FooterLink {
  id: string;
  label: string;
  href: string;
  isExternal: boolean;
}

interface SocialLink {
  platform: 'facebook' | 'instagram' | 'twitter' | 'youtube';
  url: string;
  enabled: boolean;
}

interface FooterSettings {
  quickLinks: FooterLink[];
  legalLinks: FooterLink[];
  socialLinks: SocialLink[];
  copyrightText: string;
  showNewsletter: boolean;
}

const defaultSettings: FooterSettings = {
  quickLinks: [
    { id: '1', label: 'Restaurant', href: '/restaurant', isExternal: false },
    { id: '2', label: 'Chalets', href: '/chalets', isExternal: false },
    { id: '3', label: 'Pool', href: '/pool', isExternal: false },
    { id: '4', label: 'Snack Bar', href: '/snack', isExternal: false },
  ],
  legalLinks: [
    { id: '1', label: 'Privacy Policy', href: '/privacy', isExternal: false },
    { id: '2', label: 'Terms of Service', href: '/terms', isExternal: false },
    { id: '3', label: 'Cancellation Policy', href: '/cancellation', isExternal: false },
  ],
  socialLinks: [
    { platform: 'facebook', url: '', enabled: false },
    { platform: 'instagram', url: '', enabled: false },
    { platform: 'twitter', url: '', enabled: false },
    { platform: 'youtube', url: '', enabled: false },
  ],
  copyrightText: '© {year} V2 Resort. All rights reserved.',
  showNewsletter: false,
};

const socialIcons: Record<string, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
};

export default function FooterSettingsPage() {
  const [settings, setSettings] = useState<FooterSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/admin/settings');
      if (response.data?.data?.footer) {
        setSettings({ ...defaultSettings, ...response.data.data.footer });
      }
    } catch (error) {
      console.error('Failed to load footer settings:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/admin/settings', { footer: settings });
      toast.success('Footer settings saved!');
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save footer settings');
    } finally {
      setIsSaving(false);
    }
  };

  const addQuickLink = () => {
    setSettings({
      ...settings,
      quickLinks: [...settings.quickLinks, { id: Date.now().toString(), label: 'New Link', href: '/', isExternal: false }],
    });
    setHasChanges(true);
  };

  const removeQuickLink = (id: string) => {
    setSettings({
      ...settings,
      quickLinks: settings.quickLinks.filter((link) => link.id !== id),
    });
    setHasChanges(true);
  };

  const updateQuickLink = (id: string, field: keyof FooterLink, value: string | boolean) => {
    setSettings({
      ...settings,
      quickLinks: settings.quickLinks.map((link) =>
        link.id === id ? { ...link, [field]: value } : link
      ),
    });
    setHasChanges(true);
  };

  const addLegalLink = () => {
    setSettings({
      ...settings,
      legalLinks: [...settings.legalLinks, { id: Date.now().toString(), label: 'New Link', href: '/', isExternal: false }],
    });
    setHasChanges(true);
  };

  const removeLegalLink = (id: string) => {
    setSettings({
      ...settings,
      legalLinks: settings.legalLinks.filter((link) => link.id !== id),
    });
    setHasChanges(true);
  };

  const updateLegalLink = (id: string, field: keyof FooterLink, value: string | boolean) => {
    setSettings({
      ...settings,
      legalLinks: settings.legalLinks.map((link) =>
        link.id === id ? { ...link, [field]: value } : link
      ),
    });
    setHasChanges(true);
  };

  const updateSocialLink = (platform: string, field: 'url' | 'enabled', value: string | boolean) => {
    setSettings({
      ...settings,
      socialLinks: settings.socialLinks.map((link) =>
        link.platform === platform ? { ...link, [field]: value } : link
      ),
    });
    setHasChanges(true);
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <LinkIcon className="w-8 h-8 text-primary-600" />
            Footer Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage footer links and social media connections
          </p>
        </div>
        <Button onClick={handleSave} isLoading={isSaving} disabled={!hasChanges}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </motion.div>

      {/* Quick Links */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Quick Links</CardTitle>
                <CardDescription>Navigation links shown in the footer</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addQuickLink}>
                <Plus className="w-4 h-4 mr-2" />
                Add Link
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {settings.quickLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                >
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                  <Input
                    placeholder="Label"
                    value={link.label}
                    onChange={(e) => updateQuickLink(link.id, 'label', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="URL"
                    value={link.href}
                    onChange={(e) => updateQuickLink(link.id, 'href', e.target.value)}
                    className="flex-1"
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={link.isExternal}
                      onChange={(e) => updateQuickLink(link.id, 'isExternal', e.target.checked)}
                      className="rounded"
                    />
                    <ExternalLink className="w-4 h-4" />
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => removeQuickLink(link.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Legal Links */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Legal Links</CardTitle>
                <CardDescription>Legal and policy pages</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={addLegalLink}>
                <Plus className="w-4 h-4 mr-2" />
                Add Link
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {settings.legalLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                >
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                  <Input
                    placeholder="Label"
                    value={link.label}
                    onChange={(e) => updateLegalLink(link.id, 'label', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="URL"
                    value={link.href}
                    onChange={(e) => updateLegalLink(link.id, 'href', e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeLegalLink(link.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Social Links */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle>Social Media</CardTitle>
            <CardDescription>Connect your social media profiles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settings.socialLinks.map((social) => {
                const Icon = socialIcons[social.platform];
                return (
                  <div
                    key={social.platform}
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-colors ${
                      social.enabled
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${social.enabled ? 'text-primary-600' : 'text-slate-400'}`} />
                    <div className="flex-1">
                      <p className="font-medium capitalize text-slate-900 dark:text-white">{social.platform}</p>
                      <Input
                        placeholder={`https://${social.platform}.com/...`}
                        value={social.url}
                        onChange={(e) => updateSocialLink(social.platform, 'url', e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={social.enabled}
                        onChange={(e) => updateSocialLink(social.platform, 'enabled', e.target.checked)}
                        className="w-5 h-5 rounded"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Copyright */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle>Copyright Text</CardTitle>
            <CardDescription>Use {'{year}'} to insert the current year automatically</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              value={settings.copyrightText}
              onChange={(e) => {
                setSettings({ ...settings, copyrightText: e.target.value });
                setHasChanges(true);
              }}
              placeholder="© {year} Your Company. All rights reserved."
            />
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
