'use client';

import { useState, useEffect } from 'react';
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
      title: 'Welcome to V2 Resort',
      subtitle: "Lebanon's Premier Resort Experience",
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
  ctaTitle: 'Ready to Experience V2 Resort?',
  ctaSubtitle: 'Book your stay today and discover why we\'re the preferred destination in Lebanon.',
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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/admin/settings');
      if (response.data?.data?.homepage) {
        setSettings({ ...defaultSettings, ...response.data.data.homepage });
      }
    } catch (error) {
      console.error('Failed to load homepage settings:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/admin/settings', { homepage: settings });
      toast.success(t('homepage.saved'));
      setHasChanges(false);
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const addHeroSlide = () => {
    setSettings({
      ...settings,
      heroSlides: [
        ...settings.heroSlides,
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
      heroSlides: settings.heroSlides.filter((slide) => slide.id !== id),
    });
    setHasChanges(true);
  };

  const updateHeroSlide = (id: string, field: keyof HeroSlide, value: string | boolean) => {
    setSettings({
      ...settings,
      heroSlides: settings.heroSlides.map((slide) =>
        slide.id === id ? { ...slide, [field]: value } : slide
      ),
    });
    setHasChanges(true);
  };

  const toggleSection = (id: string) => {
    setSettings({
      ...settings,
      sections: settings.sections.map((section) =>
        section.id === id ? { ...section, enabled: !section.enabled } : section
      ),
    });
    setHasChanges(true);
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
    const idx = settings.sections.findIndex((s) => s.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === settings.sections.length - 1)) return;

    const newSections = [...settings.sections];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]];
    newSections.forEach((s, i) => (s.order = i + 1));

    setSettings({ ...settings, sections: newSections });
    setHasChanges(true);
  };

  const tabs = [
    { id: 'hero' as const, label: 'Hero Slides', icon: Sparkles },
    { id: 'sections' as const, label: 'Sections', icon: Layout },
    { id: 'cta' as const, label: 'Call to Action', icon: Type },
  ];

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
            <Layout className="w-8 h-8 text-primary-600" />
            {t('homepage.title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {t('homepage.subtitle')}
          </p>
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
                {settings.heroSlides.map((slide, index) => (
                  <div
                    key={slide.id}
                    className={`p-4 rounded-lg border-2 ${
                      slide.enabled ? 'border-primary-200 bg-primary-50/50 dark:border-primary-800 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                      <span className="text-sm font-medium text-slate-500">Slide {index + 1}</span>
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateHeroSlide(slide.id, 'enabled', !slide.enabled)}
                      >
                        {slide.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                      {settings.heroSlides.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeHeroSlide(slide.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Title</label>
                        <Input
                          value={slide.title}
                          onChange={(e) => updateHeroSlide(slide.id, 'title', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Subtitle</label>
                        <Input
                          value={slide.subtitle}
                          onChange={(e) => updateHeroSlide(slide.id, 'subtitle', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Button Text</label>
                        <Input
                          value={slide.buttonText}
                          onChange={(e) => updateHeroSlide(slide.id, 'buttonText', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Button Link</label>
                        <Input
                          value={slide.buttonLink}
                          onChange={(e) => updateHeroSlide(slide.id, 'buttonLink', e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Background Image URL</label>
                        <Input
                          value={slide.imageUrl}
                          onChange={(e) => updateHeroSlide(slide.id, 'imageUrl', e.target.value)}
                          placeholder="https://example.com/image.jpg"
                        />
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
              <CardDescription>Toggle and reorder sections on the homepage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {settings.sections
                  .sort((a, b) => a.order - b.order)
                  .map((section, index) => (
                    <div
                      key={section.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-colors ${
                        section.enabled
                          ? 'border-primary-200 bg-primary-50/50 dark:border-primary-800 dark:bg-primary-900/20'
                          : 'border-slate-200 dark:border-slate-700 opacity-60'
                      }`}
                    >
                      <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">{section.title}</p>
                        <p className="text-sm text-slate-500 capitalize">{section.type.replace('_', ' ')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveSection(section.id, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveSection(section.id, 'down')}
                          disabled={index === settings.sections.length - 1}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleSection(section.id)}>
                          {section.enabled ? (
                            <Eye className="w-4 h-4 text-primary-600" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-slate-400" />
                          )}
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
                    value={settings.ctaTitle}
                    onChange={(e) => {
                      setSettings({ ...settings, ctaTitle: e.target.value });
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Subtitle</label>
                  <Input
                    value={settings.ctaSubtitle}
                    onChange={(e) => {
                      setSettings({ ...settings, ctaSubtitle: e.target.value });
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Button Text</label>
                    <Input
                      value={settings.ctaButtonText}
                      onChange={(e) => {
                        setSettings({ ...settings, ctaButtonText: e.target.value });
                        setHasChanges(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Button Link</label>
                    <Input
                      value={settings.ctaButtonLink}
                      onChange={(e) => {
                        setSettings({ ...settings, ctaButtonLink: e.target.value });
                        setHasChanges(true);
                      }}
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
