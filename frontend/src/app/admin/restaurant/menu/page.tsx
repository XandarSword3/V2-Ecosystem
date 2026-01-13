'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Tag,
  DollarSign,
  X,
  Save,
  ChevronDown,
  RefreshCw,
  Eye,
  EyeOff,
  Flame,
  Leaf,
  AlertCircle,
} from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  price: number;
  category_id: string;
  image_url?: string;
  is_available: boolean;
  is_featured: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  is_spicy: boolean;
  preparation_time?: number;
  discount_price?: number;
  allergens?: string[];
  module_id?: string;
}

interface Category {
  id: string;
  name: string;
  name_ar?: string;
  display_order: number;
}

export default function MenuManagementPage() {
  const t = useTranslations('adminRestaurant');
  const tc = useTranslations('adminCommon');
  const { modules } = useSiteSettings();
  const restaurantModule = modules.find(m => m.slug === 'restaurant');

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState<Partial<MenuItem>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (restaurantModule) {
      fetchData();
    }
  }, [restaurantModule]);

  const fetchData = async () => {
    if (!restaurantModule) return;
    try {
      setLoading(true);
      const [menuRes, catRes] = await Promise.all([
        api.get('/restaurant/items', { params: { moduleId: restaurantModule.id } }),
        api.get('/restaurant/categories', { params: { moduleId: restaurantModule.id } }),
      ]);
      setItems(menuRes.data.data || []);
      setCategories(catRes.data.data || []);
    } catch (error) {
      toast.error(tc('errors.failedToLoad'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      name_ar: '',
      description: '',
      description_ar: '',
      price: 0,
      category_id: categories[0]?.id || '',
      is_available: true,
      is_featured: false,
      is_vegetarian: false,
      is_spicy: false,
      preparation_time: 15,
    });
    setShowModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.category_id) {
      toast.error(tc('errors.required'));
      return;
    }

    if (!restaurantModule) {
      toast.error(tc('errors.generic'));
      return;
    }

    try {
      setSaving(true);
      const payload = { ...formData, module_id: restaurantModule.id };

      if (editingItem) {
        await api.put(`/restaurant/admin/items/${editingItem.id}`, payload);
        toast.success(tc('success.updated'));
      } else {
        await api.post('/restaurant/admin/items', payload);
        toast.success(tc('success.created'));
      }
      fetchData();
      setShowModal(false);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || tc('errors.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(tc('confirmDelete'))) return;

    try {
      await api.delete(`/restaurant/admin/items/${id}`);
      toast.success(tc('success.deleted'));
      fetchData();
    } catch (error) {
      toast.error(tc('errors.failedToDelete'));
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await api.put(`/restaurant/admin/items/${item.id}`, {
        is_available: !item.is_available,
      });
      fetchData();
      toast.success(tc('success.updated'));
    } catch (error) {
      toast.error(tc('errors.failedToUpdate'));
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <motion.div variants={fadeInUp}>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            {t('menu.title')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            {tc('description')}
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex gap-2">
          <Button variant="outline" onClick={fetchData} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            {tc('refresh')}
          </Button>
          <Button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white"
          >
            <Plus className="w-4 h-4" />
            {t('menu.addItem')}
          </Button>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder={tc('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="all">{tc('all')} {t('categories.title')}</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Items</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{items.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Available</p>
          <p className="text-2xl font-bold text-emerald-600">
            {items.filter(i => i.is_available).length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Featured</p>
          <p className="text-2xl font-bold text-amber-600">
            {items.filter(i => i.is_featured).length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Categories</p>
          <p className="text-2xl font-bold text-blue-600">{categories.length}</p>
        </div>
      </motion.div>

      {/* Menu Items Grid */}
      <motion.div variants={fadeInUp}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-500 dark:text-slate-400">{tc('noResults')}</p>
              <Button onClick={openCreateModal} className="mt-4">
                {t('menu.addItem')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={`overflow-hidden ${!item.is_available ? 'opacity-60' : ''}`}>
                    {/* Image */}
                    <div className="relative h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="w-12 h-12 text-slate-400" />
                        </div>
                      )}
                      {/* Badges */}
                      <div className="absolute top-2 right-2 flex gap-1">
                        {item.is_featured && (
                          <span className="px-2 py-1 bg-amber-500 text-white text-xs rounded-full">
                            {t('menu.featured')}
                          </span>
                        )}
                        {!item.is_available && (
                          <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                            {t('menu.unavailable')}
                          </span>
                        )}
                      </div>
                      {/* Icons */}
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        {item.is_vegetarian && (
                          <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center" title="Vegetarian">
                            <Leaf className="w-3 h-3 text-white" />
                          </span>
                        )}
                        {item.is_vegan && (
                          <span className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center" title="Vegan">
                            <Leaf className="w-3 h-3 text-white" />
                          </span>
                        )}
                        {item.is_gluten_free && (
                          <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center" title="Gluten Free">
                            <strong className="text-[8px] text-white">GF</strong>
                          </span>
                        )}
                        {item.is_spicy && (
                          <span className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center" title="Spicy">
                            <Flame className="w-3 h-3 text-white" />
                          </span>
                        )}
                      </div>
                    </div>

                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {item.name}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {getCategoryName(item.category_id)}
                          </p>
                        </div>
                        <div className="text-right">
                          {item.discount_price ? (
                            <>
                              <p className="text-lg font-bold text-emerald-600">
                                {formatCurrency(item.discount_price)}
                              </p>
                              <p className="text-xs text-slate-400 line-through">
                                {formatCurrency(item.price)}
                              </p>
                            </>
                          ) : (
                            <p className="text-lg font-bold text-orange-600">
                              {formatCurrency(item.price)}
                            </p>
                          )}
                        </div>
                      </div>

                      {item.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                          {item.description}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleAvailability(item)}
                          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm transition-colors ${item.is_available
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                            : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30'
                            }`}
                        >
                          {item.is_available ? (
                            <>
                              <EyeOff className="w-4 h-4" />
                              {t('menu.unavailable')}
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" />
                              {t('menu.available')}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(item)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          {tc('edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Create/Edit Modal */}
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
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editingItem ? t('menu.editItem') : t('menu.addItem')}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Name (English) *
                    </label>
                    <Input
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Grilled Chicken"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Name (Arabic)
                    </label>
                    <Input
                      value={formData.name_ar || ''}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                      placeholder="الاسم بالعربية"
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Description (English)
                    </label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe the dish..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-orange-500"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Description (Arabic)
                    </label>
                    <textarea
                      value={formData.description_ar || ''}
                      onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                      placeholder="الوصف بالعربية..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-orange-500"
                      rows={3}
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Price (USD) *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price || ''}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Discount Price (Promotional)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.discount_price || ''}
                        onChange={(e) => setFormData({ ...formData, discount_price: parseFloat(e.target.value) || undefined })}
                        className="pl-10"
                        placeholder="Leave empty for no discount"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Category *
                    </label>
                    <select
                      value={formData.category_id || ''}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-orange-500"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Prep Time (min)
                    </label>
                    <Input
                      type="number"
                      value={formData.preparation_time || ''}
                      onChange={(e) => setFormData({ ...formData, preparation_time: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Image URL
                  </label>
                  <Input
                    value={formData.image_url || ''}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_available ?? true}
                      onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Available</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_featured ?? false}
                      onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Featured</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_vegetarian ?? false}
                      onChange={(e) => setFormData({ ...formData, is_vegetarian: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Leaf className="w-4 h-4 text-green-500" />
                      Vegetarian
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_vegan ?? false}
                      onChange={(e) => setFormData({ ...formData, is_vegan: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Leaf className="w-4 h-4 text-emerald-600" />
                      Vegan
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_gluten_free ?? false}
                      onChange={(e) => setFormData({ ...formData, is_gluten_free: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <strong className="text-xs text-blue-500">GF</strong>
                      Gluten Free
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_spicy ?? false}
                      onChange={(e) => setFormData({ ...formData, is_spicy: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Flame className="w-4 h-4 text-red-500" />
                      Spicy
                    </span>
                  </label>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-6 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  {tc('cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingItem ? tc('update') : tc('create')}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
