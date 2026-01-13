'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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
    Home,
    UtensilsCrossed,
    Waves,
    Cookie,
    Layout,
    Info,
    Layers,
    Settings,
    Globe,
    Sun,
    Coins,
    ShoppingCart as CartIcon,
    MousePointer2,
    ExternalLink
} from 'lucide-react';
import { useSiteSettings } from '@/lib/settings-context';

interface NavLink {
    type: 'internal' | 'external' | 'module';
    label: string;
    href: string;
    moduleSlug?: string;
    icon: string;
}

interface NavbarConfig {
    links: NavLink[];
    config: {
        showLanguageSwitcher: boolean;
        showThemeToggle: boolean;
        showCurrencySwitcher: boolean;
        showUserPreferences: boolean;
        showCart: boolean;
        sticky: boolean;
    };
}

const ICONS: Record<string, React.ElementType> = {
    Home,
    UtensilsCrossed,
    Waves,
    Cookie,
    Link: LinkIcon,
    Layout,
    Info,
    Layers,
    Globe,
    ExternalLink
};

const DEFAULT_CONFIG: NavbarConfig = {
    links: [
        { type: 'internal', label: 'Home', href: '/', icon: 'Home' }
    ],
    config: {
        showLanguageSwitcher: true,
        showThemeToggle: true,
        showCurrencySwitcher: true,
        showUserPreferences: true,
        showCart: true,
        sticky: true
    }
};

export default function NavbarSettingsPage() {
    const t = useTranslations('adminSettings');
    const tc = useTranslations('adminCommon');
    const [navbar, setNavbar] = useState<NavbarConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { modules } = useSiteSettings();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data } = await api.get('/admin/settings');
            if (data?.data?.navbar) {
                setNavbar(data.data.navbar);
            }
        } catch (error) {
            console.error('Failed to fetch navbar settings:', error);
            toast.error(tc('errors.failedToLoad'));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/admin/settings', { key: 'navbar', value: navbar });
            toast.success(t('navbar.saved'));
        } catch (error: unknown) {
            const axiosError = error as { response?: { data?: { error?: string } } };
            toast.error(axiosError.response?.data?.error || tc('errors.failedToSave'));
        } finally {
            setSaving(false);
        }
    };

    const addLink = () => {
        setNavbar({
            ...navbar,
            links: [...navbar.links, { type: 'internal', label: 'New Link', href: '#', icon: 'Link' }]
        });
    };

    const removeLink = (index: number) => {
        const newLinks = [...navbar.links];
        newLinks.splice(index, 1);
        setNavbar({ ...navbar, links: newLinks });
    };

    const updateLink = (index: number, field: keyof NavLink, value: string | boolean) => {
        const newLinks = [...navbar.links];
        newLinks[index] = { ...newLinks[index], [field]: value };

        // If setting to module type, try to find the module and set label/href
        if (field === 'moduleSlug' && value) {
            const module = modules.find(m => m.slug === value);
            if (module) {
                newLinks[index].label = module.name;
                newLinks[index].href = `/${module.slug}`;
            }
        }

        setNavbar({ ...navbar, links: newLinks });
    };

    const toggleConfig = (field: keyof NavbarConfig['config']) => {
        setNavbar({
            ...navbar,
            config: {
                ...navbar.config,
                [field]: !navbar.config[field]
            }
        });
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
                        <MousePointer2 className="w-8 h-8 text-primary-600" />
                        {t('navbar.title')}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {t('navbar.subtitle')}
                    </p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="shadow-lg shadow-primary-500/20">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? tc('saving') : tc('saveChanges')}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Configuration Toggles */}
                <div className="lg:col-span-1 space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="w-5 h-5 text-blue-500" />
                                Bar Configuration
                            </CardTitle>
                            <CardDescription>Global navbar behavior and components</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {[
                                { key: 'sticky', label: 'Sticky Header', icon: Layout },
                                { key: 'showCart', label: 'Cart Button', icon: CartIcon },
                                { key: 'showLanguageSwitcher', label: 'Language Switcher', icon: Globe },
                                { key: 'showThemeToggle', label: 'Theme Toggle', icon: Sun },
                                { key: 'showCurrencySwitcher', label: 'Currency Switcher', icon: Coins },
                                { key: 'showUserPreferences', label: 'User Preferences', icon: Settings }
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                                            <item.icon className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                                    </div>
                                    <button
                                        onClick={() => toggleConfig(item.key as keyof NavbarConfig['config'])}
                                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${navbar.config[item.key as keyof NavbarConfig['config']] ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${navbar.config[item.key as keyof NavbarConfig['config']] ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Navigation Links Builder */}
                <div className="lg:col-span-2 space-y-8">
                    <Card className="min-h-full">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <LinkIcon className="w-5 h-5 text-purple-500" />
                                    Navigation Links
                                </CardTitle>
                                <CardDescription>Manage the links displayed in the main navigation</CardDescription>
                            </div>
                            <Button onClick={addLink} size="sm" variant="outline" className="text-primary-600 border-primary-100 bg-primary-50">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Link
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <AnimatePresence>
                                    {navbar.links.map((link, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 shadow-sm relative group"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Link Type</label>
                                                    <select
                                                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                                                        value={link.type}
                                                        onChange={(e) => updateLink(idx, 'type', e.target.value)}
                                                    >
                                                        <option value="internal">Internal Page</option>
                                                        <option value="external">External Link</option>
                                                        <option value="module">Site Module</option>
                                                    </select>
                                                </div>

                                                {link.type === 'module' ? (
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Module</label>
                                                        <select
                                                            className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                                                            value={link.moduleSlug}
                                                            onChange={(e) => updateLink(idx, 'moduleSlug', e.target.value)}
                                                        >
                                                            <option value="">Select Module</option>
                                                            {modules.map(m => (
                                                                <option key={m.id} value={m.slug}>{m.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Label</label>
                                                        <Input
                                                            value={link.label}
                                                            onChange={(e) => updateLink(idx, 'label', e.target.value)}
                                                            placeholder="e.g. Home"
                                                        />
                                                    </div>
                                                )}

                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">{link.type === 'module' ? 'Path (Auto)' : 'URL / Path'}</label>
                                                    <Input
                                                        value={link.href}
                                                        onChange={(e) => updateLink(idx, 'href', e.target.value)}
                                                        placeholder={link.type === 'external' ? 'https://...' : '/...'}
                                                        disabled={link.type === 'module'}
                                                    />
                                                </div>

                                                <div className="flex gap-2">
                                                    <div className="space-y-1 flex-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Icon</label>
                                                        <select
                                                            className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                                                            value={link.icon}
                                                            onChange={(e) => updateLink(idx, 'icon', e.target.value)}
                                                        >
                                                            {Object.keys(ICONS).map(iconName => (
                                                                <option key={iconName} value={iconName}>{iconName}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeLink(idx)}
                                                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {navbar.links.length === 0 && (
                                    <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                        <LinkIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                                        <p className="text-slate-500">No navigation links added yet.</p>
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
