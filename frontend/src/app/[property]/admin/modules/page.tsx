'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modulesApi, api } from '@/lib/api';
import { Loader2, Plus, Edit, Trash2, Check, X, LayoutTemplate, ArrowLeft, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Module, ModuleSettings } from '@/lib/settings-context';
import { useRouter, useParams } from 'next/navigation';
import { SYSTEM_PAGE_SLUGS } from '@/config/admin-navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModuleFormData {
  name: string;
  slug: string;
  description: string;
  engine_type: string;
  is_active: boolean;
  show_in_main: boolean;
  settings: ModuleSettings;
}

interface ApiError {
  response?: { data?: { message?: string } };
}

interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  engine_type: string;
  template_type?: string; // Backward compatibility alias for engine_type
  category?: string;
  thumbnail_url?: string;
  layout: any[];
  default_settings?: any;
  seed_data?: any;
  is_official?: boolean;
  usage_count?: number;
  created_at?: string;
  // UI properties (computed from engine_type/category)
  icon?: string;
  color?: string;
  accent?: string;
}

// ─── Blank module defaults (no template required) ─────────────────────────────

const BLANK_TEMPLATE: TemplateEntry = {
  id: 'blank',
  name: '',
  description: '',
  engine_type: 'instant_transaction',
  template_type: 'instant_transaction',
  layout: [],
  icon: '⬜',
  color: '#6366f1',
  accent: '#a5b4fc',
};

// ─── Template Picker ──────────────────────────────────────────────────────────

function TemplatePicker({
  onSelect,
  onCancel,
}: {
  onSelect: (template: TemplateEntry) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  // Fetch backend templates
  const { data: backendTemplates, isLoading: templatesLoading } = useQuery({
    queryKey: ['module-templates'],
    queryFn: () => api.get('/admin/module-templates'),
    retry: false,
    staleTime: Infinity,
  });

  // Helper to compute UI properties from engine_type/category
  const getTemplateUI = (engineType: string, category?: string) => {
    const uiMap: Record<string, { icon: string; color: string; accent: string }> = {
      instant_transaction: { icon: '🍽️', color: '#f97316', accent: '#fbbf24' },
      time_exclusive_reservation: { icon: '🏡', color: '#15803d', accent: '#4ade80' },
      shared_capacity_access: { icon: '🏊', color: '#0ea5e9', accent: '#38bdf8' },
      ongoing_entitlement: { icon: '⭐', color: '#7c3aed', accent: '#a78bfa' },
    };
    return uiMap[engineType] || { icon: '📦', color: '#6366f1', accent: '#a5b4fc' };
  };

  // Official "Blank" is offered via the main page — hide duplicate from the grid
  const templates: TemplateEntry[] = (backendTemplates?.data?.data || [])
    .filter((tpl: any) => tpl.name?.toLowerCase() !== 'blank')
    .map((tpl: any) => ({
      ...tpl,
      template_type: tpl.engine_type, // Add for backward compatibility
      ...getTemplateUI(tpl.engine_type, tpl.category),
    }));

  const TYPE_LABEL: Record<string, string> = {
    instant_transaction:        'Instant Transaction',
    time_exclusive_reservation: 'Time-Exclusive Reservation',
    shared_capacity_access:     'Shared Capacity Access',
    ongoing_entitlement:        'Ongoing Entitlement',
    // legacy aliases shown correctly on old DB rows
    menu_service:               'Instant Transaction',
    multi_day_booking:          'Time-Exclusive Reservation',
    session_access:             'Shared Capacity Access',
    subscription:               'Ongoing Entitlement',
    membership_access:          'Ongoing Entitlement',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Choose a starting template</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pre-built layouts — you can customise everything in the visual builder
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templatesLoading ? (
          <div className="col-span-full flex items-center justify-center py-12 text-slate-500 dark:text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading templates…
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
            No pre-built templates available. Use &ldquo;Skip to blank&rdquo; below to start from scratch.
          </div>
        ) : null}
        {!templatesLoading && templates.map((tpl) => {
          const isSelected = selected === tpl.id;
          return (
            <button
              key={tpl.id}
              onClick={() => setSelected(tpl.id)}
              className={[
                'relative text-left p-4 rounded-xl border-2 transition-all',
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-md'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm',
              ].join(' ')}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Icon + colour swatch */}
              <div
                className="w-full h-20 rounded-lg mb-3 flex items-center justify-center text-3xl"
                style={{ backgroundColor: tpl.color + '22', border: `1.5px solid ${tpl.color}44` }}
              >
                {tpl.icon}
              </div>

              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900 dark:text-white text-sm">{tpl.name}</p>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                  style={{ backgroundColor: tpl.color + '22', color: tpl.color }}
                >
                  {TYPE_LABEL[tpl.engine_type] ?? tpl.engine_type}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{tpl.description}</p>

              {/* Block count pill */}
              {tpl.layout.length > 0 && (
                <p className="text-[10px] text-slate-400 mt-2">
                  {tpl.layout.length} pre-built block{tpl.layout.length !== 1 ? 's' : ''}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(BLANK_TEMPLATE)}
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Skip to blank
          </button>
        </div>
        <button
          disabled={!selected}
          onClick={() => {
            const tpl = templates.find(t => t.id === selected);
            if (tpl) onSelect(tpl);
          }}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Use this template
          <ArrowLeft className="w-4 h-4 rotate-180" />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ModulesPage() {
  const router = useRouter();
  const params = useParams();
  const propertySlug = (params?.property as string) || '';
  const t = useTranslations('admin');
  const queryClient = useQueryClient();

  // Creation flow state: null = closed, 'picking' = template picker, 'forming' = module form
  const [creationStep, setCreationStep] = useState<null | 'picking' | 'forming'>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateEntry | null>(null);
  const [editingModule, setEditingModule] = useState<Module | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-modules'],
    queryFn: () => modulesApi.getAll(false),
  });

  const modules = data?.data?.data || [];
  const businessModules = modules.filter((m: Module) => !SYSTEM_PAGE_SLUGS.includes(m.slug));
  const systemPages    = modules.filter((m: Module) =>  SYSTEM_PAGE_SLUGS.includes(m.slug));

  const createMutation = useMutation({
    mutationFn: (data: ModuleFormData) => modulesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      setCreationStep(null);
      setSelectedTemplate(null);
      toast.success('Module created successfully');
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.message || 'Failed to create module');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ModuleFormData }) => modulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      setEditingModule(null);
      toast.success('Module updated successfully');
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.message || 'Failed to update module');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => modulesApi.delete(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      toast.success('Module deleted successfully');
    },
    onError: (err: ApiError) => {
      toast.error(err.response?.data?.message || 'Failed to delete module');
    },
  });

  const handleTemplateSelected = (template: TemplateEntry) => {
    setSelectedTemplate(template);
    setCreationStep('forming');
  };

  const startBlankModule = () => {
    setSelectedTemplate(BLANK_TEMPLATE);
    setCreationStep('forming');
  };

  const startTemplatePicker = () => {
    setCreationStep('picking');
  };

  const handleCreateSubmit = (formData: ModuleFormData) => {
    // Inject the template's pre-built layout into settings so the builder
    // opens with blocks already placed.
    const enriched: ModuleFormData = {
      ...formData,
      settings: {
        ...formData.settings,
        layout: selectedTemplate?.layout ?? [],
      } as any,
    };
    createMutation.mutate(enriched);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Module Management</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={startBlankModule}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Blank Module
          </button>
          <button
            onClick={startTemplatePicker}
            className="flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <LayoutTemplate className="w-4 h-4 mr-2" />
            From Template
          </button>
        </div>
      </div>

      {/* ── Step 1: Template picker ─────────────────────────────────────────── */}
      {creationStep === 'picking' && (
        <TemplatePicker
          onSelect={handleTemplateSelected}
          onCancel={() => setCreationStep(null)}
        />
      )}

      {/* ── Step 2: Module form (pre-populated from template) ──────────────── */}
      {creationStep === 'forming' && selectedTemplate && (
        <div className="space-y-2">
          {/* Back to template picker */}
          <button
            onClick={() => setCreationStep('picking')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to templates
          </button>

          {/* Template badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 w-fit">
            <span className="text-lg">{selectedTemplate.icon}</span>
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              {selectedTemplate.id === 'blank' ? (
                <>Starting from: <strong>blank canvas</strong></>
              ) : (
                <>Starting from: <strong>{selectedTemplate.name}</strong></>
              )}
            </span>
            {selectedTemplate.layout.length > 0 && (
              <span className="text-xs text-indigo-500 dark:text-indigo-400">
                · {selectedTemplate.layout.length} blocks pre-loaded
              </span>
            )}
          </div>

          <ModuleForm
            templateDefaults={selectedTemplate}
            onSubmit={handleCreateSubmit}
            onCancel={() => { setCreationStep(null); setSelectedTemplate(null); }}
            isLoading={createMutation.isPending}
          />
        </div>
      )}

      {/* ── Edit existing module ────────────────────────────────────────────── */}
      {editingModule && (
        <ModuleForm
          initialData={editingModule}
          onSubmit={(data) => updateMutation.mutate({ id: editingModule.id, data })}
          onCancel={() => setEditingModule(null)}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* ── Business modules table ──────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                {['Name', 'Slug', 'Type', 'Status', ''].map(h => (
                  <th
                    key={h}
                    className={`px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider ${h ? 'text-left' : 'text-right'}`}
                  >
                    {h || 'Actions'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {businessModules.map((module: Module) => (
                <tr key={module.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{module.name}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{module.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{module.slug}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      {module.template_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      module.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {module.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => router.push(`/${propertySlug}/admin/modules/builder/${module.id}`)}
                        className="flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-medium"
                      >
                        <LayoutTemplate className="w-4 h-4 mr-1.5" />
                        Builder
                      </button>
                      <button
                        onClick={() => setEditingModule(module)}
                        className="p-1.5 text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded transition-colors"
                        title="Edit Module Settings"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const input = prompt('Type "Delete" to confirm hard deletion of this module. This action is irreversible.');
                          if (input === 'Delete') deleteMutation.mutate({ id: module.id, force: true });
                          else if (input !== null) toast.error('You must type "Delete" exactly to confirm.');
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Delete Module"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── System pages table ──────────────────────────────────────────────── */}
      {systemPages.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-8">Editable Site Pages</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                  <tr>
                    {['Page Name', 'Slug / URL path', ''].map(h => (
                      <th
                        key={h}
                        className={`px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider ${h ? 'text-left' : 'text-right'}`}
                      >
                        {h || 'Actions'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {systemPages.map((module: Module) => (
                    <tr key={module.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{module.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{module.description}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {module.slug === 'home-page' ? '/' : `/${module.slug.replace('-policy', '')}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => router.push(`/${propertySlug}/admin/modules/builder/${module.id}`)}
                          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-xs font-medium ml-auto"
                        >
                          <LayoutTemplate className="w-4 h-4 mr-1.5" />
                          Visual Builder
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Module form (step 2 or standalone edit) ──────────────────────────────────

interface ModuleFormProps {
  initialData?: Module | null;
  templateDefaults?: TemplateEntry | null;
  onSubmit: (data: ModuleFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function ModuleForm({ initialData, templateDefaults, onSubmit, onCancel, isLoading }: ModuleFormProps) {
  const normalizeSlug = (v: string) =>
    v.toLowerCase().trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const [formData, setFormData] = useState({
    name:          initialData?.name          ?? templateDefaults?.name        ?? '',
    slug:          initialData?.slug          ?? (templateDefaults?.name ? normalizeSlug(templateDefaults.name) : ''),
    description:   initialData?.description   ?? templateDefaults?.description ?? '',
    engine_type:   initialData?.engine_type ?? initialData?.template_type ?? templateDefaults?.engine_type ?? templateDefaults?.template_type ?? 'instant_transaction',
    is_active:     initialData?.is_active     ?? true,
    show_in_main:  initialData?.show_in_main  ?? true,
    settings:      initialData?.settings      ?? {
      header_color: templateDefaults?.color   ?? '#0ea5e9',
      accent_color: templateDefaults?.accent  ?? '#6366f1',
      show_in_nav:  true,
      icon:         'default',
    } as ModuleSettings,
  });

  const handleNameChange = (value: string) => {
    const updated = { ...formData, name: value };
    if (!formData.slug || formData.slug === normalizeSlug(formData.name)) {
      updated.slug = normalizeSlug(value);
    }
    setFormData(updated);
  };

  const updateSettings = (key: string, value: string | boolean) =>
    setFormData(prev => ({ ...prev, settings: { ...prev.settings, [key]: value } }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
        {initialData ? 'Edit Module' : 'Configure Module'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
            <input
              type="text" required
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Slug (URL Path)</label>
            <input
              type="text" required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: normalizeSlug(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-500 mt-1">Lowercase, hyphens only</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Engine Type</label>
            <select
              value={formData.engine_type}
              onChange={(e) => setFormData({ ...formData, engine_type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              disabled={!!initialData}
            >
              <option value="instant_transaction">Instant Transaction — Food, Retail &amp; Service</option>
              <option value="time_exclusive_reservation">Time-Exclusive Reservation — Hotel, Units &amp; Courts</option>
              <option value="shared_capacity_access">Shared Capacity Access — Pool / Gym / Spa</option>
              <option value="ongoing_entitlement">Ongoing Entitlement — Membership / Subscription</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 pt-6">
            <label className="flex items-center cursor-pointer gap-2">
              <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 text-primary-600 border-slate-300 rounded" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Active (Module enabled)</span>
            </label>
            <label className="flex items-center cursor-pointer gap-2">
              <input type="checkbox" checked={formData.show_in_main} onChange={(e) => setFormData({ ...formData, show_in_main: e.target.checked })} className="w-4 h-4 text-primary-600 border-slate-300 rounded" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Show on Homepage</span>
            </label>
          </div>
        </div>

        {/* Appearance */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Appearance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'header_color', label: 'Header Color', placeholder: '#0ea5e9' },
              { key: 'accent_color', label: 'Accent Color', placeholder: '#6366f1' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
                <div className="flex gap-2">
                  <input type="color" value={(formData.settings as any)[key] || placeholder} onChange={(e) => updateSettings(key, e.target.value)} className="w-12 h-10 rounded cursor-pointer border border-slate-300" />
                  <input type="text" value={(formData.settings as any)[key] || ''} onChange={(e) => updateSettings(key, e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" placeholder={placeholder} />
                </div>
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Icon Style</label>
              <select value={(formData.settings as any).icon || 'default'} onChange={(e) => updateSettings('icon', e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500">
                <option value="default">Default</option>
                <option value="utensils">Utensils (Menu Service)</option>
                <option value="home">Home (Accommodation)</option>
                <option value="waves">Waves (Pool / Beach)</option>
                <option value="dumbbell">Dumbbell (Gym)</option>
                <option value="spa">Spa</option>
                <option value="coffee">Coffee</option>
              </select>
            </div>
          </div>
          <label className="flex items-center cursor-pointer gap-2 mt-3">
            <input type="checkbox" checked={(formData.settings as any).show_in_nav ?? true} onChange={(e) => updateSettings('show_in_nav', e.target.checked)} className="w-4 h-4 text-primary-600 border-slate-300 rounded" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Show in main navigation</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={isLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {initialData ? 'Update Module' : 'Create Module'}
          </button>
        </div>
      </form>
    </div>
  );
}
