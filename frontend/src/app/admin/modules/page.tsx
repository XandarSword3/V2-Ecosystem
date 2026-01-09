'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modulesApi } from '@/lib/api';
import { Loader2, Plus, Edit, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Module } from '@/lib/settings-context';

export default function ModulesPage() {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-modules'],
    queryFn: () => modulesApi.getAll(false),
  });

  const modules = data?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: any) => modulesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      setIsCreating(false);
      toast.success('Module created successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create module');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => modulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      setEditingModule(null);
      toast.success('Module updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update module');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => modulesApi.delete(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modules'] });
      toast.success('Module deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete module');
    },
  });

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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Module Management
        </h1>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Module
        </button>
      </div>

      {isCreating && (
        <ModuleForm
          onSubmit={(data: any) => createMutation.mutate(data)}
          onCancel={() => setIsCreating(false)}
          isLoading={createMutation.isPending}
        />
      )}

      {editingModule && (
        <ModuleForm
          initialData={editingModule}
          onSubmit={(data: any) => updateMutation.mutate({ id: editingModule.id, data })}
          onCancel={() => setEditingModule(null)}
          isLoading={updateMutation.isPending}
        />
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Slug
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {modules.map((module: Module) => (
              <tr key={module.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {module.name}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {module.description}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                  {module.slug}
                </td>
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
                  <button
                    onClick={() => setEditingModule(module)}
                    className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400 mr-4"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const input = prompt('Type "Delete" to confirm hard deletion of this module. This action is irreversible.');
                      if (input === 'Delete') {
                        deleteMutation.mutate({ id: module.id, force: true });
                      } else if (input !== null) {
                        toast.error('You must type "Delete" exactly to confirm.');
                      }
                    }}
                    className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModuleForm({ initialData, onSubmit, onCancel, isLoading }: any) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    template_type: initialData?.template_type || 'menu_service',
    is_active: initialData?.is_active ?? true,
    settings: initialData?.settings || {
      header_color: '#0ea5e9',
      accent_color: '#6366f1',
      show_in_nav: true,
      icon: 'default',
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateSettings = (key: string, value: any) => {
    setFormData({
      ...formData,
      settings: { ...formData.settings, [key]: value },
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
      <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
        {initialData ? 'Edit Module' : 'Create New Module'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Slug (URL Path)
            </label>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Template Type
            </label>
            <select
              value={formData.template_type}
              onChange={(e) => setFormData({ ...formData, template_type: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              disabled={!!initialData} // Prevent changing type after creation for now
            >
              <option value="menu_service">Menu Service (Restaurant/Bar)</option>
              <option value="multi_day_booking">Multi-Day Booking (Chalets/Hotel)</option>
              <option value="session_access">Session Access (Pool/Gym/Spa)</option>
            </select>
          </div>
          <div className="flex items-center pt-6">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-slate-700 dark:text-slate-300">
                Active (Visible to users)
              </span>
            </label>
          </div>
        </div>

        {/* Module Appearance Settings */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Appearance Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Header Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.settings.header_color || '#0ea5e9'}
                  onChange={(e) => updateSettings('header_color', e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={formData.settings.header_color || '#0ea5e9'}
                  onChange={(e) => updateSettings('header_color', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  placeholder="#0ea5e9"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Accent Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formData.settings.accent_color || '#6366f1'}
                  onChange={(e) => updateSettings('accent_color', e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={formData.settings.accent_color || '#6366f1'}
                  onChange={(e) => updateSettings('accent_color', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  placeholder="#6366f1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Icon Style
              </label>
              <select
                value={formData.settings.icon || 'default'}
                onChange={(e) => updateSettings('icon', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                <option value="default">Default</option>
                <option value="utensils">Utensils (Restaurant)</option>
                <option value="home">Home (Accommodation)</option>
                <option value="waves">Waves (Pool/Beach)</option>
                <option value="dumbbell">Dumbbell (Gym)</option>
                <option value="spa">Spa</option>
                <option value="coffee">Coffee</option>
                <option value="shopping">Shopping</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.settings.show_in_nav ?? true}
                onChange={(e) => updateSettings('show_in_nav', e.target.checked)}
                className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-slate-700 dark:text-slate-300">
                Show in main navigation
              </span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {initialData ? 'Update Module' : 'Create Module'}
          </button>
        </div>
      </form>
    </div>
  );
}
