'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Star,
  RefreshCw,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  Image as ImageIcon,
} from 'lucide-react';

interface Addon {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: 'equipment' | 'service' | 'food' | 'activity' | 'other';
  is_per_day: boolean;
  is_active: boolean;
  image_url?: string;
  created_at: string;
}

const categoryConfig: Record<string, { color: string; label: string }> = {
  equipment: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', label: 'Equipment' },
  service: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', label: 'Service' },
  food: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', label: 'Food' },
  activity: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Activity' },
  other: { color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', label: 'Other' },
};

export default function AdminChaletAddonsPage() {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Addon | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'equipment',
    is_per_day: true,
    is_active: true,
    image_url: '',
  });

  const fetchAddons = useCallback(async () => {
    try {
      const response = await api.get('/chalets/add-ons');
      setAddons(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch addons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddons();
  }, [fetchAddons]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/chalets/admin/add-ons/${editing.id}`, formData);
        toast.success('Addon updated');
      } else {
        await api.post('/chalets/admin/add-ons', formData);
        toast.success('Addon created');
      }
      setShowModal(false);
      setEditing(null);
      fetchAddons();
    } catch (error) {
      toast.error('Failed to save addon');
    }
  };

  const handleEdit = (addon: Addon) => {
    setEditing(addon);
    setFormData({
      name: addon.name,
      description: addon.description || '',
      price: addon.price,
      category: addon.category,
      is_per_day: addon.is_per_day,
      is_active: addon.is_active,
      image_url: addon.image_url || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this addon?')) return;
    try {
      await api.delete(`/chalets/admin/add-ons/${id}`);
      setAddons((prev) => prev.filter((a) => a.id !== id));
      toast.success('Addon deleted');
    } catch (error) {
      toast.error('Failed to delete addon');
    }
  };

  const toggleActive = async (addon: Addon) => {
    try {
      await api.put(`/chalets/admin/add-ons/${addon.id}`, { is_active: !addon.is_active });
      setAddons((prev) =>
        prev.map((a) => (a.id === addon.id ? { ...a, is_active: !a.is_active } : a))
      );
      toast.success(`Addon ${addon.is_active ? 'deactivated' : 'activated'}`);
    } catch (error) {
      toast.error('Failed to update addon');
    }
  };

  const openNewModal = () => {
    setEditing(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      category: 'equipment',
      is_per_day: true,
      is_active: true,
      image_url: '',
    });
    setShowModal(true);
  };

  const filteredAddons = addons.filter(
    (a) => categoryFilter === 'all' || a.category === categoryFilter
  );

  const stats = {
    total: addons.length,
    active: addons.filter((a) => a.is_active).length,
    categories: new Set(addons.map((a) => a.category)).size,
    avgPrice: addons.length
      ? addons.reduce((sum, a) => sum + a.price, 0) / addons.length
      : 0,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chalet Addons</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage extra services and equipment</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAddons}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openNewModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Addon
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Total Addons</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Active</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.active}</p>
                </div>
                <Star className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Categories</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.categories}</p>
                </div>
                <Package className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Avg Price</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.avgPrice)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              All
            </button>
            {Object.entries(categoryConfig).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setCategoryFilter(key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  categoryFilter === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Addons Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredAddons.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No addons found</p>
              <Button className="mt-4" onClick={openNewModal}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Addon
              </Button>
            </div>
          ) : (
            filteredAddons.map((addon, index) => {
              const catConfig = categoryConfig[addon.category] || categoryConfig.other;

              return (
                <motion.div
                  key={addon.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <Card className={!addon.is_active ? 'opacity-60' : ''}>
                    <CardContent className="p-0">
                      {addon.image_url ? (
                        <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-t-xl overflow-hidden">
                          <img
                            src={addon.image_url}
                            alt={addon.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-t-xl flex items-center justify-center">
                          <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 dark:text-white">{addon.name}</h3>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${catConfig.color}`}>
                              {catConfig.label}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                              {formatCurrency(addon.price)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {addon.is_per_day ? 'per day' : 'one-time'}
                            </p>
                          </div>
                        </div>

                        {addon.description && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
                            {addon.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                          <button
                            onClick={() => toggleActive(addon)}
                            className="flex items-center gap-2 text-sm"
                          >
                            {addon.is_active ? (
                              <>
                                <ToggleRight className="w-5 h-5 text-green-500" />
                                <span className="text-green-600 dark:text-green-400">Active</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-5 h-5 text-slate-400" />
                                <span className="text-slate-500">Inactive</span>
                              </>
                            )}
                          </button>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(addon)}
                              className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(addon.id)}
                              className="w-8 h-8 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 flex items-center justify-center"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editing ? 'Edit Addon' : 'Add Addon'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="e.g., BBQ Set"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      rows={3}
                      placeholder="Brief description..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Price
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Category
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value="equipment">Equipment</option>
                        <option value="service">Service</option>
                        <option value="food">Food</option>
                        <option value="activity">Activity</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Image URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_per_day}
                        onChange={(e) => setFormData({ ...formData, is_per_day: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Charge per day</span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Active</span>
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      {editing ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
