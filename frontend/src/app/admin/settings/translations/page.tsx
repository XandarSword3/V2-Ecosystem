'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  Languages,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Wand2,
  Edit3,
  Save,
  X,
  FileText,
  Utensils,
  Home,
  Waves,
  Cookie,
  Package,
  Plus,
  Trash2,
  Globe,
  Code,
  FileJson,
  Settings,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface MissingTranslation {
  table: string;
  tableDisplayName: string;
  id: string;
  itemLabel: string;
  field: string;
  originalValue: string;
  missingLanguages: string[];
}

interface TranslationStats {
  overall: { total: number; translated: number; missing: number };
  byTable: Record<string, { total: number; translated: number; missing: number }>;
  percentage: number;
}

interface GroupedMissing {
  displayName: string;
  items: MissingTranslation[];
}

interface SupportedLanguage {
  id?: string;
  code: string;
  name: string;
  native_name: string;
  direction: 'ltr' | 'rtl';
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

interface FrontendComparison {
  totalKeys: number;
  allKeys: string[];
  languages: Record<string, {
    file: string;
    keyCount: number;
    missingKeys: string[];
    missingCount: number;
  }>;
}

const getTableIcon = (table: string) => {
  const icons: Record<string, typeof Package> = {
    modules: Package,
    menu_categories: Utensils,
    menu_items: Utensils,
    chalets: Home,
    snack_items: Cookie,
    chalet_add_ons: Home,
    pool_sessions: Waves,
  };
  return icons[table] || FileText;
};

export default function TranslationsPage() {
  // Translations available for future i18n
  const _t = useTranslations('admin'); void _t;
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'database' | 'frontend' | 'languages'>('database');
  
  // Database translations state
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [missing, setMissing] = useState<Record<string, GroupedMissing>>({});
  const [loading, setLoading] = useState(true);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ table: string; id: string; field: string; lang: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  
  // Language management state
  const [languages, setLanguages] = useState<SupportedLanguage[]>([]);
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [newLanguage, setNewLanguage] = useState<Partial<SupportedLanguage>>({
    code: '',
    name: '',
    native_name: '',
    direction: 'ltr',
    is_active: true,
  });
  
  // Frontend translations state
  const [frontendComparison, setFrontendComparison] = useState<FrontendComparison | null>(null);
  const [expandedLanguages, setExpandedLanguages] = useState<Set<string>>(new Set());
  const [editingFrontendKey, setEditingFrontendKey] = useState<{ lang: string; key: string } | null>(null);
  const [frontendEditValue, setFrontendEditValue] = useState('');
  const [autoTranslating, setAutoTranslating] = useState<string | null>(null);
  const [batchTranslating, setBatchTranslating] = useState<string | null>(null);

  // Fetch database translations
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, missingRes] = await Promise.all([
        api.get('/admin/translations/stats'),
        api.get('/admin/translations/missing'),
      ]);

      if (statsRes.data?.success) {
        setStats(statsRes.data.data);
      }
      if (missingRes.data?.success) {
        setMissing(missingRes.data.data.byTable || {});
      }
    } catch {
      toast.error('Failed to load translation data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch supported languages
  const fetchLanguages = useCallback(async () => {
    try {
      const res = await api.get('/admin/translations/languages');
      if (res.data?.success) {
        setLanguages(res.data.data || []);
      }
    } catch {
      toast.error('Failed to load languages');
    }
  }, []);

  // Fetch frontend translation comparison
  const fetchFrontendComparison = useCallback(async () => {
    try {
      const res = await api.get('/admin/translations/frontend/compare');
      if (res.data?.success) {
        setFrontendComparison(res.data.data);
      }
    } catch {
      toast.error('Failed to load frontend translations');
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchLanguages();
    fetchFrontendComparison();
  }, [fetchData, fetchLanguages, fetchFrontendComparison]);

  const toggleTable = (table: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(table)) {
        next.delete(table);
      } else {
        next.add(table);
      }
      return next;
    });
  };

  const startEdit = (table: string, id: string, field: string, lang: string) => {
    setEditingItem({ table, id, field, lang });
    setEditValue('');
  };

  const saveTranslation = async () => {
    if (!editingItem) return;

    try {
      await api.post('/admin/translations/update', {
        table: editingItem.table,
        id: editingItem.id,
        field: editingItem.field,
        language: editingItem.lang,
        value: editValue,
      });

      toast.success('Translation saved!');
      setEditingItem(null);
      setEditValue('');
      fetchData();
    } catch {
      toast.error('Failed to save translation');
    }
  };

  const autoTranslateItem = async (table: string, id: string) => {
    setAutoTranslating(`${table}-${id}`);
    try {
      const res = await api.post('/admin/translations/auto-translate', { table, id });
      if (res.data?.success) {
        toast.success('Auto-translated successfully!');
        fetchData();
      }
    } catch {
      toast.error('Auto-translation failed');
    } finally {
      setAutoTranslating(null);
    }
  };

  const batchAutoTranslate = async (table: string) => {
    setBatchTranslating(table);
    try {
      const res = await api.post('/admin/translations/batch-auto-translate', { table });
      if (res.data?.success) {
        const { translated, errors } = res.data;
        toast.success(`Translated ${translated} items${errors?.length ? ` (${errors.length} errors)` : ''}`);
        fetchData();
      }
    } catch {
      toast.error('Batch translation failed');
    } finally {
      setBatchTranslating(null);
    }
  };

  // Language management functions
  const addLanguage = async () => {
    if (!newLanguage.code || !newLanguage.name || !newLanguage.native_name) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const res = await api.post('/admin/translations/languages', newLanguage);
      if (res.data?.success) {
        toast.success('Language added successfully!');
        setShowAddLanguage(false);
        setNewLanguage({ code: '', name: '', native_name: '', direction: 'ltr', is_active: true });
        fetchLanguages();
      }
    } catch {
      toast.error('Failed to add language');
    }
  };

  const deleteLanguage = async (code: string) => {
    if (code === 'en') {
      toast.error('Cannot delete the default language (English)');
      return;
    }
    if (!confirm(`Are you sure you want to delete the ${code} language?`)) return;
    try {
      const res = await api.delete(`/admin/translations/languages/${code}`);
      if (res.data?.success) {
        toast.success('Language deleted!');
        fetchLanguages();
      }
    } catch {
      toast.error('Failed to delete language');
    }
  };

  const toggleLanguageActive = async (code: string, isActive: boolean) => {
    try {
      const res = await api.put(`/admin/translations/languages/${code}`, { is_active: !isActive });
      if (res.data?.success) {
        toast.success(`Language ${!isActive ? 'enabled' : 'disabled'}`);
        fetchLanguages();
      }
    } catch {
      toast.error('Failed to update language');
    }
  };

  // Frontend translation functions
  const toggleLanguageExpand = (lang: string) => {
    setExpandedLanguages(prev => {
      const next = new Set(prev);
      if (next.has(lang)) {
        next.delete(lang);
      } else {
        next.add(lang);
      }
      return next;
    });
  };

  const saveFrontendTranslation = async () => {
    if (!editingFrontendKey) return;
    try {
      const res = await api.post('/admin/translations/frontend/update', {
        language: editingFrontendKey.lang,
        key: editingFrontendKey.key,
        value: frontendEditValue,
      });
      if (res.data?.success) {
        toast.success('Translation saved!');
        setEditingFrontendKey(null);
        setFrontendEditValue('');
        fetchFrontendComparison();
      }
    } catch {
      toast.error('Failed to save translation');
    }
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Languages className="w-8 h-8 text-primary-500" />
            Translation Management
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage translations for all content across your resort
          </p>
        </div>
        <Button onClick={() => { fetchData(); fetchLanguages(); fetchFrontendComparison(); }} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('database')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'database'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Database Translations
        </button>
        <button
          onClick={() => setActiveTab('frontend')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'frontend'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileJson className="w-4 h-4 inline mr-2" />
          Frontend JSON Files
        </button>
        <button
          onClick={() => setActiveTab('languages')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'languages'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Globe className="w-4 h-4 inline mr-2" />
          Languages ({languages.length})
        </button>
      </div>

      {/* Languages Tab */}
      {activeTab === 'languages' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Supported Languages</h2>
                <Button onClick={() => setShowAddLanguage(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Language
                </Button>
              </div>

              {/* Add Language Form */}
              <AnimatePresence>
                {showAddLanguage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                  >
                    <h3 className="font-medium mb-4 text-slate-900 dark:text-white">Add New Language</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Code *
                        </label>
                        <Input
                          placeholder="e.g., de"
                          value={newLanguage.code}
                          onChange={(e) => setNewLanguage({ ...newLanguage, code: e.target.value.toLowerCase() })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Name *
                        </label>
                        <Input
                          placeholder="e.g., German"
                          value={newLanguage.name}
                          onChange={(e) => setNewLanguage({ ...newLanguage, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Native Name *
                        </label>
                        <Input
                          placeholder="e.g., Deutsch"
                          value={newLanguage.native_name}
                          onChange={(e) => setNewLanguage({ ...newLanguage, native_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Direction
                        </label>
                        <select
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          value={newLanguage.direction}
                          onChange={(e) => setNewLanguage({ ...newLanguage, direction: e.target.value as 'ltr' | 'rtl' })}
                        >
                          <option value="ltr">Left to Right</option>
                          <option value="rtl">Right to Left</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button onClick={addLanguage} size="sm">
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button onClick={() => setShowAddLanguage(false)} variant="outline" size="sm">
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Languages List */}
              <div className="space-y-2">
                {languages.map((lang) => (
                  <div
                    key={lang.code}
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 flex items-center justify-center bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-lg font-bold text-sm">
                        {lang.code.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {lang.name} 
                          <span className="ml-2 text-slate-500">({lang.native_name})</span>
                          {lang.is_default && (
                            <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-xs rounded">
                              Default
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-slate-500">
                          Direction: {lang.direction.toUpperCase()} | 
                          Status: {lang.is_active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={lang.is_active ? 'outline' : 'primary'}
                        onClick={() => toggleLanguageActive(lang.code, lang.is_active)}
                      >
                        {lang.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      {lang.code !== 'en' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => deleteLanguage(lang.code)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Frontend JSON Files Tab */}
      {activeTab === 'frontend' && (
        <div className="space-y-4">
          {frontendComparison && (
            <>
              {/* Frontend Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Translation Keys</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{frontendComparison.totalKeys}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Languages</p>
                    <p className="text-3xl font-bold text-primary-600">{Object.keys(frontendComparison.languages).length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Missing</p>
                    <p className="text-3xl font-bold text-red-600">
                      {Object.values(frontendComparison.languages).reduce((sum, l) => sum + l.missingCount, 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Per-Language Status */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
                    <FileJson className="w-5 h-5 inline mr-2" />
                    Frontend Translation Files
                  </h2>
                  <p className="text-sm text-slate-500 mb-4">
                    These are the JSON translation files in <code className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">frontend/messages/</code>
                  </p>

                  <div className="space-y-4">
                    {Object.entries(frontendComparison.languages).map(([lang, data]) => {
                      const isExpanded = expandedLanguages.has(lang);
                      const percentage = frontendComparison.totalKeys > 0 
                        ? Math.round(((frontendComparison.totalKeys - data.missingCount) / frontendComparison.totalKeys) * 100)
                        : 100;

                      return (
                        <div key={lang} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                          <div 
                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => toggleLanguageExpand(lang)}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                              <Code className="w-5 h-5 text-primary-500" />
                              <span className="font-medium text-slate-900 dark:text-white">{lang}.json</span>
                              <span className="text-sm text-slate-500">({data.keyCount} keys)</span>
                              {data.missingCount > 0 && (
                                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
                                  {data.missingCount} missing
                                </span>
                              )}
                              {data.missingCount === 0 && (
                                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
                                  <Check className="w-3 h-3 inline mr-1" />
                                  Complete
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${percentage === 100 ? 'bg-green-500' : percentage > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-600 dark:text-slate-400 w-12 text-right">{percentage}%</span>
                            </div>
                          </div>

                          {/* Missing Keys List */}
                          <AnimatePresence>
                            {isExpanded && data.missingCount > 0 && (
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                    Missing Keys ({data.missingCount})
                                  </p>
                                  <div className="max-h-64 overflow-y-auto space-y-2">
                                    {data.missingKeys.map((key) => (
                                      <div 
                                        key={key}
                                        className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded"
                                      >
                                        <code className="text-sm text-slate-700 dark:text-slate-300 font-mono">{key}</code>
                                        {editingFrontendKey?.lang === lang && editingFrontendKey?.key === key ? (
                                          <div className="flex gap-2 items-center">
                                            <Input
                                              value={frontendEditValue}
                                              onChange={(e) => setFrontendEditValue(e.target.value)}
                                              placeholder="Enter translation..."
                                              className="w-64"
                                              dir={lang === 'ar' ? 'rtl' : 'ltr'}
                                            />
                                            <Button size="sm" onClick={saveFrontendTranslation}>
                                              <Save className="w-4 h-4" />
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setEditingFrontendKey(null)}>
                                              <X className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setEditingFrontendKey({ lang, key });
                                              setFrontendEditValue('');
                                            }}
                                          >
                                            <Edit3 className="w-4 h-4 mr-1" />
                                            Add
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Database Tab - Original Content */}
      {activeTab === 'database' && (
        <>
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Completion</p>
                  <p className="text-3xl font-bold text-primary-600">{stats.percentage}%</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  stats.percentage === 100 ? 'bg-green-100 text-green-600' : 
                  stats.percentage > 50 ? 'bg-yellow-100 text-yellow-600' : 
                  'bg-red-100 text-red-600'
                }`}>
                  {stats.percentage === 100 ? <Check className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Fields</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.overall.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">Translated</p>
              <p className="text-3xl font-bold text-green-600">{stats.overall.translated}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">Missing</p>
              <p className="text-3xl font-bold text-red-600">{stats.overall.missing}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Missing Translations Alert */}
      {stats && stats.overall.missing > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {stats.overall.missing} translations missing
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Some content does not have Arabic or French translations. Add them below or use auto-translate.
            </p>
          </div>
        </div>
      )}

      {/* Per-Table Stats */}
      {stats && Object.keys(stats.byTable).length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Translation Status by Section</h2>
            <div className="space-y-3">
              {Object.entries(stats.byTable).map(([table, tableStats]) => {
                const Icon = getTableIcon(table);
                const percentage = tableStats.total > 0 ? Math.round((tableStats.translated / tableStats.total) * 100) : 100;
                
                return (
                  <div key={table} className="flex items-center gap-4">
                    <Icon className="w-5 h-5 text-slate-500" />
                    <span className="w-32 text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                      {table.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          percentage === 100 ? 'bg-green-500' : 
                          percentage > 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-12 text-sm text-right text-slate-600 dark:text-slate-400">
                      {percentage}%
                    </span>
                    <span className="w-24 text-xs text-slate-500">
                      {tableStats.translated}/{tableStats.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing Translations by Table */}
      {Object.keys(missing).length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Missing Translations</h2>
            <div className="space-y-4">
              {Object.entries(missing).map(([table, group]) => {
                const Icon = getTableIcon(table);
                const isExpanded = expandedTables.has(table);
                
                return (
                  <div key={table} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    {/* Table Header */}
                    <div 
                      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => toggleTable(table)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        <Icon className="w-5 h-5 text-primary-500" />
                        <span className="font-medium text-slate-900 dark:text-white">{group.displayName}</span>
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
                          {group.items.length} missing
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          batchAutoTranslate(table);
                        }}
                        disabled={batchTranslating === table}
                      >
                        {batchTranslating === table ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Wand2 className="w-4 h-4 mr-2" />
                        )}
                        Auto-translate All
                      </Button>
                    </div>

                    {/* Items List */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="divide-y divide-slate-200 dark:divide-slate-700">
                            {group.items.map((item, idx) => (
                              <div key={`${item.id}-${item.field}-${idx}`} className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-slate-900 dark:text-white truncate">
                                        {item.itemLabel}
                                      </span>
                                      <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                        {item.field}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                                      {item.originalValue}
                                    </p>
                                    <div className="flex gap-2 mt-2">
                                      {item.missingLanguages.map(lang => (
                                        <span 
                                          key={lang}
                                          className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded"
                                        >
                                          {lang.toUpperCase()} missing
                                        </span>
                                      ))}
                                    </div>
                                    
                                    {/* Edit Form */}
                                    {editingItem?.table === table && editingItem?.id === item.id && editingItem?.field === item.field && (
                                      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <p className="text-xs text-slate-500 mb-2">
                                          Editing: {editingItem.lang.toUpperCase()} translation for &quot;{item.field}&quot;
                                        </p>
                                        <div className="flex gap-2">
                                          <Input
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            placeholder={`Enter ${editingItem.lang.toUpperCase()} translation...`}
                                            className="flex-1"
                                            dir={editingItem.lang === 'ar' ? 'rtl' : 'ltr'}
                                          />
                                          <Button size="sm" onClick={saveTranslation} disabled={!editValue.trim()}>
                                            <Save className="w-4 h-4" />
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>
                                            <X className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {item.missingLanguages.map(lang => (
                                      <Button
                                        key={lang}
                                        size="sm"
                                        variant="outline"
                                        onClick={() => startEdit(table, item.id, item.field, lang)}
                                      >
                                        <Edit3 className="w-4 h-4 mr-1" />
                                        {lang.toUpperCase()}
                                      </Button>
                                    ))}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => autoTranslateItem(table, item.id)}
                                      disabled={autoTranslating === `${table}-${item.id}`}
                                      title="Auto-translate"
                                    >
                                      {autoTranslating === `${table}-${item.id}` ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Wand2 className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Good State */}
      {stats && stats.overall.missing === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              All translations complete!
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              All content has been translated into Arabic and French.
            </p>
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
}
