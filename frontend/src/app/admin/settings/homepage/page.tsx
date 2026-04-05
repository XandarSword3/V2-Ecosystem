'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Layout,
  Image as ImageIcon,
  Type,
  Sparkles,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Upload,
  X,
  Loader2,
} from 'lucide-react';

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string;
  enabled: boolean;
}

interface HomepageSection {
  id: string;
  type: 'services' | 'features' | 'stats' | 'testimonials' | 'map' | 'cta';
  title: string;
  enabled: boolean;
  order: number;
}

interface HomepageSettings {
  heroSlides: HeroSlide[];
  sections: HomepageSection[];
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButtonText: string;
  ctaButtonLink: string;
}

const defaultSettings: HomepageSettings = {
  heroSlides: [
    {
      id: '1',
      title: 'Welcome to Azure Bay Resort',
      subtitle: 'Where the Ocean Meets Paradise',
      buttonText: 'Explore Our Services',
      buttonLink: '#services',
      imageUrl: '',
      enabled: true,
    },
  ],
  sections: [
    { id: '1', type: 'services', title: 'Our Services', enabled: true, order: 1 },
    { id: '2', type: 'features', title: 'Why Choose Us', enabled: true, order: 2 },
    { id: '3', type: 'stats', title: 'Our Numbers', enabled: true, order: 3 },
    { id: '4', type: 'testimonials', title: 'What Our Guests Say', enabled: true, order: 4 },
    { id: '5', type: 'map', title: 'Find Us', enabled: true, order: 5 },
    { id: '6', type: 'cta', title: 'Call to Action', enabled: true, order: 6 },
  ],
  ctaTitle: 'Ready to Experience Azure Bay Resort?',
  ctaSubtitle: 'Book your stay today and discover why we are the preferred destination.',
  ctaButtonText: 'Book Now',
  ctaButtonLink: '/chalets',
};

export default function HomepageSettingsPage() {
  const t = useTranslations('adminSettings');
  const tc = useTranslations('adminCommon');
  const [settings, setSettings] = useState<HomepageSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'hero' | 'sections' | 'cta'>('hero');
  const [uploadingSlideId, setUploadingSlideId] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const normalizeSections = (raw: unknown): HomepageSection[] => {
    if (!Array.isArray(raw)) return defaultSettings.sections;
    if (raw.length === 0) return defaultSettings.sections;
    // If sections are strings like ["hero","features",...], convert to objects
    if (typeof raw[0] === 'string') {
      const sectionTitles: Record<string, string> = {
        hero: 'Hero', services: 'Our Services', features: 'Why Choose Us',
        programs: 'Programs', stats: 'Our Numbers', testimonials: 'What Our Guests Say',
        map: 'Find Us', cta: 'Call to Action',
      };
      return (raw as string[]).map((type, i) => ({
        id: String(i + 1),
        type: type as HomepageSection['type'],
        title: sectionTitles[type] || type,
        enabled: true,
        order: i + 1,
      }));
    }
    // Already objects — ensure all fields exist
    return raw.map((s: any, i: number) => ({
      id: s.id ?? String(i + 1),
      type: s.type ?? 'services',
      title: s.title ?? s.type ?? 'Section',
      enabled: s.enabled ?? true,
      order: s.order ?? i + 1,
    }));
  };

  const normalizeSlides = (raw: unknown): HeroSlide[] => {
    if (!Array.isArray(raw) || raw.length === 0) return defaultSettings.heroSlides;
    return raw.map((s: any, i: number) => ({
      id: s.id ?? String(i + 1),
      title: s.title ?? '',
      subtitle: s.subtitle ?? '',
      buttonText: s.buttonText ?? s.ctaText ?? '',
      buttonLink: s.buttonLink ?? s.ctaLink ?? '',
      imageUrl: s.imageUrl ?? '',
      enabled: s.enabled ?? true,
    }));
  };

  const applyData = (d: any) => {
    setSettings({
      ...defaultSettings,
      heroSlides: normalizeSlides(d.heroSlides),
      sections: normalizeSections(d.sections),
      ctaTitle: d.ctaTitle ?? defaultSettings.ctaTitle,
      ctaSubtitle: d.ctaSubtitle ?? defaultSettings.ctaSubtitle,
      ctaButtonText: d.ctaButtonText ?? defaultSettings.ctaButtonText,
      ctaButtonLink: d.ctaButtonLink ?? defaultSettings.ctaButtonLink,
    });
  };

  const loadSettings = async () => {
    try {
      const response = await api.get('/admin/settings/homepage');
      if (response.data?.success && response.data?.data) {
        applyData(response.data.data);
      }
    } catch {
      try {
        const fallbackResponse = await api.get('/admin/settings');
        if (fallbackResponse.data?.data?.homepage) {
          applyData(fallbackResponse.data.data.homepage);
        }
      } catch { /* fallback also failed, use defaults */ }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/admin/settings/homepage', settings);
      toast.success(t('homepage.saved'));
      setHasChanges(false);
    } catch {
      toast.error(tc('errors.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const addHeroSlide = () => {
    const slides = settings.heroSlides || [];
    setSettings({
      ...settings,
      heroSlides: [
        ...slides,
        {
          id: Date.now().toString(),
          title: 'New Slide',
          subtitle: 'Subtitle text',
          buttonText: 'Learn More',
          buttonLink: '#',
          imageUrl: '',
          enabled: true,
        },
      ],
    });
    setHasChanges(true);
  };

  const removeHeroSlide = (id: string) => {
    setSettings({
      ...settings,
      heroSlides: (settings.heroSlides || []).filter((slide) => slide.id !== id),
    });
    setHasChanges(true);
  };

  const updateHeroSlide = (id: string, field: keyof HeroSlide, value: string | boolean) => {
    setSettings({
      ...settings,
      heroSlides: (settings.heroSlides || []).map((slide) =>
        slide.id === id ? { ...slide, [field]: value } : slide
      ),
    });
    setHasChanges(true);
  };

  const toggleSection = (id: string) => {
    setSettings({
      ...settings,
      sections: (settings.sections || []).map((section) =>
        section.id === id ? { ...section, enabled: !section.enabled } : section
      ),
    });
    setHasChanges(true);
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const secs = settings.sections || [];
    const idx = secs.findIndex((s) => s.id === id);
    if (idx < 0) return;
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === secs.length - 1)) return;
    const newSections = [...secs];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
    newSections.forEach((s, i) => (s.order = i + 1));
    setSettings({ ...settings, sections: newSections });
    setHasChanges(true);
  };

  const handleImageUpload = async (slideId: string, file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be less than 10MB'); return; }
    setUploadingSlideId(slideId);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await api.post('/admin/uploads', { file: reader.result, type: 'image', filename: file.name });
        if (response.data?.success && response.data?.data?.url) {
          updateHeroSlide(slideId, 'imageUrl', response.data.data.url);
          toast.success('Image uploaded successfully');
        } else { toast.error('Failed to upload image'); }
      } catch { toast.error('Failed to upload image'); }
      finally { setUploadingSlideId(null); }
    };
    reader.onerror = () => { toast.error('Failed to read file'); setUploadingSlideId(null); };
    reader.readAsDataURL(file);
  };

  const heroSlides = settings.heroSlides || [];
  const sections = settings.sections || [];

  const tabs = [
    { id: 'hero' as const, label: 'Hero Slides', icon: Sparkles },
    { id: 'sections' as const, label: 'Sections', icon: Layout },
    { id: 'cta' as const, label: 'Call to Action', icon: Type },
  ];

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Layout className="w-8 h-8 text-primary-600" />
            {t('homepage.title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('homepage.subtitle')}</p>
        </div>
        <Button onClick={handleSave} isLoading={isSaving} disabled={!hasChanges}>
          <Save className="w-4 h-4 mr-2" />
          {tc('saveChanges')}
        </Button>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={fadeInUp}>
        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Hero Slides Tab */}
      {activeTab === 'hero' && (
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Hero Slides</CardTitle>
                  <CardDescription>Manage the rotating hero banner on the homepage</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addHeroSlide}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Slide
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {heroSlides.map((slide, index) => (
                  <div
                    key={slide.id}
                    className={`p-4 rounded-lg border-2 ${
                      slide.enabled
                        ? 'border-primary-200 bg-primary-50/50 dark:border-primary-800 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                      <span className="text-sm font-medium text-slate-500">Slide {index + 1}</span>
                      <div className="flex-1" />
                      <Button variant="ghost" size="sm" onClick={() => updateHeroSlide(slide.id, 'enabled', !slide.enabled)}>
                        {slide.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      {heroSlides.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeHeroSlide(slide.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Title</label>
                        <Input value={slide.title} onChange={(e) => updateHeroSlide(slide.id, 'title', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Subtitle</label>
                        <Input value={slide.subtitle} onChange={(e) => updateHeroSlide(slide.id, 'subtitle', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Button Text</label>
                        <Input value={slide.buttonText} onChange={(e) => updateHeroSlide(slide.id, 'buttonText', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Button Link</label>
                        <Input value={slide.buttonLink} onChange={(e) => updateHeroSlide(slide.id, 'buttonLink', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                          <ImageIcon className="w-4 h-4 inline mr-2" />
                          Background Image
                        </label>
                        <div className="space-y-3">
                          {slide.imageUrl && (
                            <div className="relative rounded-lg overflow-hidden h-40 bg-slate-100 dark:bg-slate-800">
                              <img src={slide.imageUrl} alt={`Slide ${index + 1} background`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => updateHeroSlide(slide.id, 'imageUrl', '')}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          <div className="flex gap-3">
                            <input
                              type="file"
                              accept="image/*"
                              ref={(el) => { fileInputRefs.current[slide.id] = el; }}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(slide.id, f); }}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRefs.current[slide.id]?.click()}
                              disabled={uploadingSlideId === slide.id}
                              className="flex-1"
                            >
                              {uploadingSlideId === slide.id
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                                : <><Upload className="w-4 h-4 mr-2" />{slide.imageUrl ? 'Change Image' : 'Upload Image'}</>
                              }
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">or enter URL:</span>
                            <Input
                              value={slide.imageUrl}
                              onChange={(e) => updateHeroSlide(slide.id, 'imageUrl', e.target.value)}
                              placeholder="https://example.com/image.jpg"
                              className="flex-1 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Sections Tab */}
      {activeTab === 'sections' && (
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle>Homepage Sections</CardTitle>
              <CardDescription>Toggle and reorder the sections that appear on the homepage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...sections].sort((a, b) => a.order - b.order).map((section, index, arr) => (
                  <div
                    key={section.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      section.enabled
                        ? 'border-primary-200 bg-primary-50/50 dark:border-primary-800 dark:bg-primary-900/20'
                        : 'border-slate-200 dark:border-slate-700 opacity-60'
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">{section.title}</span>
                      <span className="text-xs text-slate-400 ml-2">({section.type})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => moveSection(section.id, 'up')} disabled={index === 0}>
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => moveSection(section.id, 'down')} disabled={index === arr.length - 1}>
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleSection(section.id)}>
                        {section.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* CTA Tab */}
      {activeTab === 'cta' && (
        <motion.div variants={fadeInUp}>
          <Card>
            <CardHeader>
              <CardTitle>Call to Action Section</CardTitle>
              <CardDescription>Configure the CTA section at the bottom of the homepage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Title</label>
                  <Input
                    value={settings.ctaTitle ?? ''}
                    onChange={(e) => { setSettings({ ...settings, ctaTitle: e.target.value }); setHasChanges(true); }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Subtitle</label>
                  <Input
                    value={settings.ctaSubtitle ?? ''}
                    onChange={(e) => { setSettings({ ...settings, ctaSubtitle: e.target.value }); setHasChanges(true); }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Button Text</label>
                    <Input
                      value={settings.ctaButtonText ?? ''}
                      onChange={(e) => { setSettings({ ...settings, ctaButtonText: e.target.value }); setHasChanges(true); }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Button Link</label>
                    <Input
                      value={settings.ctaButtonLink ?? ''}
                      onChange={(e) => { setSettings({ ...settings, ctaButtonLink: e.target.value }); setHasChanges(true); }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
