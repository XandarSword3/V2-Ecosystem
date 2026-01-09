'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Globe,
  Layout,
  Info,
  Layers,
  CheckCircle2,
  Type
} from 'lucide-react';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

interface FooterSocial {
  platform: string;
  url: string;
}

interface FooterConfig {
  logo: {
    text: string;
    showIcon: boolean;
  };
  description: string;
  columns: FooterColumn[];
  socials: FooterSocial[];
  contact: {
    showAddress: boolean;
    showPhone: boolean;
    showEmail: boolean;
  };
  copyright: string;
}

const DEFAULT_CONFIG: FooterConfig = {
  logo: { text: 'V2 Resort', showIcon: true },
  description: 'Premium resort experience in the heart of Lebanon.',
  columns: [
    {
      title: 'Quick Links',
      links: [
        { label: 'Restaurant', href: '/restaurant' },
        { label: 'Chalets', href: '/chalets' },
        { label: 'Pool', href: '/pool' }
      ]
    }
  ],
  socials: [
    { platform: 'facebook', url: '' },
    { platform: 'instagram', url: '' }
  ],
  contact: {
    showAddress: true,
    showPhone: true,
    showEmail: true
  },
  copyright: '© {year} V2 Resort. All rights reserved.'
};

export default function FooterSettingsPage() {
  const [config, setConfig] = useState<FooterConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/admin/settings');
      if (data?.data?.footer) {
        setConfig(data.data.footer);
      }
    } catch (error) {
      console.error('Failed to fetch footer settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/settings', { key: 'footer', value: config });
      toast.success('Footer configuration saved successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // --- Column Management ---
  const addColumn = () => {
    setConfig({
      ...config,
      columns: [...config.columns, { title: 'New Column', links: [] }]
    });
  };

  const removeColumn = (index: number) => {
    const newColumns = [...config.columns];
    newColumns.splice(index, 1);
    setConfig({ ...config, columns: newColumns });
  };

  const updateColumnTitle = (index: number, title: string) => {
    const newColumns = [...config.columns];
    newColumns[index].title = title;
    setConfig({ ...config, columns: newColumns });
  };

  const addLink = (columnIndex: number) => {
    const newColumns = [...config.columns];
    newColumns[columnIndex].links.push({ label: 'New Link', href: '#' });
    setConfig({ ...config, columns: newColumns });
  };

  const removeLink = (columnIndex: number, linkIndex: number) => {
    const newColumns = [...config.columns];
    newColumns[columnIndex].links.splice(linkIndex, 1);
    setConfig({ ...config, columns: newColumns });
  };

  const updateLink = (columnIndex: number, linkIndex: number, field: keyof FooterLink, value: string) => {
    const newColumns = [...config.columns];
    newColumns[columnIndex].links[linkIndex][field] = value;
    setConfig({ ...config, columns: newColumns });
  };

  // --- Socials Management ---
  const addSocial = () => {
    setConfig({
      ...config,
      socials: [...config.socials, { platform: 'facebook', url: '' }]
    });
  };

  const removeSocial = (index: number) => {
    const newSocials = [...config.socials];
    newSocials.splice(index, 1);
    setConfig({ ...config, socials: newSocials });
  };

  const updateSocial = (index: number, field: keyof FooterSocial, value: string) => {
    const newSocials = [...config.socials];
    newSocials[index][field] = value;
    setConfig({ ...config, socials: newSocials });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
    </div>
  );

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-8 pb-20"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Layout className="w-8 h-8 text-primary-600" />
            Footer CMS
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Customize your website''s footer layout, links, and information.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="shadow-lg shadow-primary-500/20">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - General & Brand */}
        <div className="lg:col-span-1 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                Branding & Info
              </CardTitle>
              <CardDescription>Resort name and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Resort Name (Logo Text)</label>
                <div className="flex gap-2">
                  <Input
                    value={config.logo.text}
                    onChange={(e) => setConfig({ ...config, logo: { ...config.logo, text: e.target.value } })}
                    placeholder="V2 Resort"
                  />
                  <Button
                    variant={config.logo.showIcon ? 'primary' : 'outline'}
                    size="icon"
                    onClick={() => setConfig({ ...config, logo: { ...config.logo, showIcon: !config.logo.showIcon } })}
                    title="Toggle Icon"
                  >
                    <CheckCircle2 className={`w-4 h-4 ${config.logo.showIcon ? 'text-white' : 'text-slate-400'}`} />
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Footer Description</label>
                <textarea
                  className="w-full min-h-[100px] p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  value={config.description}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  placeholder="A short description of your resort..."
                />
              </div>
              <div className="space-y-3 pt-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">Contact Display</p>
                {[
                  { key: 'showAddress', label: 'Show Address' },
                  { key: 'showPhone', label: 'Show Phone' },
                  { key: 'showEmail', label: 'Show Email' }
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 ${config.contact[item.key as keyof typeof config.contact] ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                      onClick={() => setConfig({
                        ...config,
                        contact: { ...config.contact, [item.key]: !config.contact[item.key as keyof typeof config.contact] }
                      })}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${config.contact[item.key as keyof typeof config.contact] ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 transition-colors">{item.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Facebook className="w-5 h-5 text-blue-600" />
                Social Media
              </CardTitle>
              <CardDescription>Links to your social profiles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <AnimatePresence>
                {config.socials.map((social, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex gap-2"
                  >
                    <select
                      className="w-1/3 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                      value={social.platform}
                      onChange={(e) => updateSocial(idx, 'platform', e.target.value)}
                    >
                      <option value="facebook">Facebook</option>
                      <option value="instagram">Instagram</option>
                      <option value="twitter">Twitter</option>
                      <option value="youtube">Youtube</option>
                      <option value="tiktok">TikTok</option>
                    </select>
                    <Input
                      className="flex-1"
                      placeholder="URL"
                      value={social.url}
                      onChange={(e) => updateSocial(idx, 'url', e.target.value)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeSocial(idx)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
              <Button variant="outline" className="w-full text-xs" onClick={addSocial}>
                <Plus className="w-3 h-3 mr-1" /> Add Social Profile
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="w-5 h-5 text-slate-600" />
                Copyright
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={config.copyright}
                onChange={(e) => setConfig({ ...config, copyright: e.target.value })}
                placeholder="© {year} V2 Resort. All rights reserved."
              />
              <p className="text-xs text-slate-500 mt-2">Use {'{year}'} to insert the current year.</p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Links Columns Builder */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="min-h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-500" />
                  Footer Navigation
                </CardTitle>
                <CardDescription>Manage your footer columns and links</CardDescription>
              </div>
              <Button onClick={addColumn} size="sm" variant="outline" className="text-primary-600 border-primary-100 bg-primary-50">
                <Plus className="w-4 h-4 mr-2" />
                Add Column
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {config.columns.map((column, colIdx) => (
                  <motion.div
                    key={colIdx}
                    variants={fadeInUp}
                    className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 relative group"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                      <Input
                        value={column.title}
                        onChange={(e) => updateColumnTitle(colIdx, e.target.value)}
                        className="font-bold border-none bg-transparent focus:ring-0 px-0 h-auto text-lg"
                        placeholder="Column Title"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeColumn(colIdx)}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <AnimatePresence>
                        {column.links.map((link, linkIdx) => (
                          <motion.div
                            key={linkIdx}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg shadow-sm"
                          >
                            <Input
                              value={link.label}
                              onChange={(e) => updateLink(colIdx, linkIdx, 'label', e.target.value)}
                              placeholder="Label"
                              className="text-xs h-8 flex-1"
                            />
                            <Input
                              value={link.href}
                              onChange={(e) => updateLink(colIdx, linkIdx, 'href', e.target.value)}
                              placeholder="URL"
                              className="text-xs h-8 flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500"
                              onClick={() => removeLink(colIdx, linkIdx)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <Button
                        variant="ghost"
                        className="w-full text-xs h-8 border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary-300 hover:text-primary-600"
                        onClick={() => addLink(colIdx)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Link
                      </Button>
                    </div>
                  </motion.div>
                ))}

                {config.columns.length === 0 && (
                  <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    <Layers className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">No columns added yet. Use the button above to start.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
