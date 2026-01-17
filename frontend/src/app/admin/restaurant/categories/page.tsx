'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Plus,
  Edit2,
  Trash2,
  FolderOpen,
  RefreshCw,
  GripVertical,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  item_count?: number;
}

export default function AdminCategoriesPage() {
  const t = useTranslations('adminRestaurant');
  const tc = useTranslations('adminCommon');
  const { modules } = useSiteSettings();
  const restaurantModule = modules.find(m => m.slug === 'restaurant');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const fetchCategories = useCallback(async () => {
    if (!restaurantModule) return;
    try {
      const response = await api.get('/restaurant/categories', {
        params: { moduleId: restaurantModule.id }
      });
      setCategories(response.data.data || []);
    } catch (error) {
      toast.error(tc('errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [restaurantModule, tc]);

  useEffect(() => {
    if (restaurantModule) {
      fetchCategories();
    }
  }, [fetchCategories, restaurantModule]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error(tc('errors.required'));
      return;
    }

    if (!restaurantModule) return;

    try {
      const payload = { ...formData, moduleId: restaurantModule.id };
      if (editingCategory) {
        await api.put(`/restaurant/admin/categories/${editingCategory.id}`, payload);
        toast.success(tc('success.updated'));
      } else {
        await api.post('/restaurant/admin/categories', payload);
        toast.success(tc('success.created'));
      }
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
      fetchCategories();
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tc('confirmDelete'))) return;
    
    try {
      await api.delete(`/restaurant/admin/categories/${id}`);
      toast.success(tc('success.deleted'));
      fetchCategories();
    } catch (error) {
      toast.error(tc('errors.failedToDelete'));
    }
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, description: category.description || '' });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('categories.title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {tc('description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchCategories}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {tc('refresh')}
          </Button>
          <Button onClick={() => { setEditingCategory(null); setFormData({ name: '', description: '' }); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {t('categories.addCategory')}
          </Button>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {categories.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full text-center py-12"
            >
              <FolderOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">{tc('noData')}</p>
              <Button className="mt-4" onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('categories.addCategory')}
              </Button>
            </motion.div>
          ) : (
            categories.map((category, index) => (
              <motion.div
                key={category.id}
                variants={fadeInUp}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                layout
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg cursor-move">
                          <GripVertical className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {category.name}
                          </h3>
                          {category.description && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                              {category.description}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                            {category.item_count || 0} items
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(category)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(category.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                {editingCategory ? tc('edit') : t('categories.addCategory')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {tc('name')}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Category name..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {tc('description')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description..."
                    rows={3}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowModal(false)}>
                    {tc('cancel')}
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingCategory ? tc('update') : tc('create')}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
