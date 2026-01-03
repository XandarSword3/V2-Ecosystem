'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Cookie,
  Search,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  DollarSign,
  X,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Coffee,
  IceCream,
  Sandwich,
  Pizza,
  ChevronDown,
} from 'lucide-react';

interface SnackItem {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  price: number;
  category: string;
  image_url?: string;
  is_available: boolean;
}

const categories = [
  { id: 'drink', label: 'Drinks', icon: Coffee },
  { id: 'ice_cream', label: 'Ice Cream', icon: IceCream },
  { id: 'sandwich', label: 'Sandwiches', icon: Sandwich },
  { id: 'snack', label: 'Snacks', icon: Pizza },
  { id: 'other', label: 'Other', icon: Cookie },
];

const getCategoryIcon = (category: string) => {
  // Handle both singular and plural forms just in case
  const normalizedCategory = category.endsWith('s') && category !== 'snacks' ? category.slice(0, -1) : category;
  const found = categories.find(c => c.id === category || c.id === normalizedCategory);
  return found ? found.icon : Cookie;
};

export default function SnackMenuManagementPage() {
  const t = useTranslations('admin');
  const [items, setItems] = useState<SnackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SnackItem | null>(null);
  const [formData, setFormData] = useState<Partial<SnackItem>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/snack/items');
      setItems(response.data.data || response.data.items || []);
    } catch (error: any) {
      toast.error('Failed to fetch snack menu');
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
      category: 'snacks',
      is_available: true,
    });
    setShowModal(true);
  };

  const openEditModal = (item: SnackItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      if (editingItem) {
        await api.put(`/snack/admin/items/${editingItem.id}`, formData);
        toast.success('Item updated successfully');
      } else {
        await api.post('/snack/admin/items', formData);
        toast.success('Item created successfully');
      }
      fetchItems();
      setShowModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await api.delete(`/snack/admin/items/${id}`);
      toast.success('Item deleted');
      fetchItems();
    } catch (error: any) {
      toast.error('Failed to delete item');
    }
  };

  const toggleAvailability = async (item: SnackItem) => {
    try {
      await api.put(`/snack/admin/items/${item.id}`, {
        is_available: !item.is_available,
      });
      fetchItems();
      toast.success(`Item ${item.is_available ? 'hidden' : 'shown'}`);
    } catch (error) {
      toast.error('Failed to update availability');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedItems = categories.reduce((acc, cat) => {
    acc[cat.id] = filteredItems.filter(item => item.category === cat.id);
    return acc;
  }, {} as Record<string, SnackItem[]>);

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
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Cookie className="w-6 h-6 text-white" />
            </div>
            Snack Bar Menu
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage snack bar items and pricing
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex gap-2">
          <Button variant="outline" onClick={fetchItems} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Item
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
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Items</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{items.length}</p>
        </div>
        {categories.slice(0, 4).map(cat => {
          const Icon = cat.icon;
          return (
            <div key={cat.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Icon className="w-4 h-4" />
                {cat.label}
              </div>
              <p className="text-2xl font-bold text-amber-600">
                {items.filter(i => i.category === cat.id).length}
              </p>
            </div>
          );
        })}
      </motion.div>

      {/* Items by Category */}
      <motion.div variants={fadeInUp} className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Cookie className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-500 dark:text-slate-400">No items found</p>
              <Button onClick={openCreateModal} className="mt-4">
                Add your first item
              </Button>
            </CardContent>
          </Card>
        ) : (
          categories.map(category => {
            const categoryItems = groupedItems[category.id];
            if (!categoryItems || categoryItems.length === 0) return null;

            const Icon = category.icon;
            return (
              <Card key={category.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-amber-600" />
                    {category.label}
                    <span className="text-sm font-normal text-slate-500">
                      ({categoryItems.length} items)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence>
                      {categoryItems.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: index * 0.03 }}
                          className={`relative bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 ${
                            !item.is_available ? 'opacity-60' : ''
                          }`}
                        >
                          {/* Image */}
                          <div className="relative h-32 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 rounded-lg mb-3 overflow-hidden">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <Icon className="w-8 h-8 text-slate-400" />
                              </div>
                            )}
                            {!item.is_available && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                                  Unavailable
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-slate-900 dark:text-white line-clamp-1">
                              {item.name}
                            </h4>
                            <span className="text-lg font-bold text-amber-600 whitespace-nowrap ml-2">
                              {formatCurrency(item.price)}
                            </span>
                          </div>

                          {item.description && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                              {item.description}
                            </p>
                          )}

                          {/* Actions */}
                          <div className="flex gap-1">
                            <button
                              onClick={() => toggleAvailability(item)}
                              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs transition-colors ${
                                item.is_available
                                  ? 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-300'
                                  : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30'
                              }`}
                            >
                              {item.is_available ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button
                              onClick={() => openEditModal(item)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            );
          })
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
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editingItem ? 'Edit Item' : 'Add New Item'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Name (English) *
                    </label>
                    <Input
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Fresh Lemonade"
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

                {/* Description */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Description (English)
                    </label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe the item..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500"
                      rows={2}
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
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500"
                      rows={2}
                      dir="rtl"
                    />
                  </div>
                </div>

                {/* Price & Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Price *
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
                      Category *
                    </label>
                    <select
                      value={formData.category || 'snacks'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Image URL */}
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

                {/* Availability */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_available ?? true}
                    onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Available for sale</span>
                </label>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-6 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingItem ? 'Update Item' : 'Create Item'}
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
