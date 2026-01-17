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
  Home,
  Search,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Users,
  Bed,
  Bath,
  Wifi,
  Car,
  X,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Star,
  MapPin,
  DollarSign,
  Check,
} from 'lucide-react';

interface Chalet {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  base_price: number;
  weekend_price?: number;
  capacity: number;
  bedroom_count: number;
  bathroom_count: number;
  image_url?: string;
  images?: string[];
  is_active: boolean;
  is_featured?: boolean;
  amenities?: string[];
}

const amenityOptions = [
  { id: 'wifi', label: 'WiFi', icon: Wifi },
  { id: 'parking', label: 'Parking', icon: Car },
  { id: 'pool_access', label: 'Pool Access', icon: Bath },
  { id: 'bbq', label: 'BBQ Area', icon: Home },
  { id: 'kitchen', label: 'Full Kitchen', icon: Home },
  { id: 'ac', label: 'Air Conditioning', icon: Home },
  { id: 'tv', label: 'Smart TV', icon: Home },
  { id: 'balcony', label: 'Balcony', icon: Home },
];

export default function ChaletsManagementPage() {
  const t = useTranslations('admin');
  const [chalets, setChalets] = useState<Chalet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingChalet, setEditingChalet] = useState<Chalet | null>(null);
  const [formData, setFormData] = useState<Partial<Chalet>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchChalets();
  }, []);

  const fetchChalets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/chalets');
      setChalets(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch chalets');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingChalet(null);
    setFormData({
      name: '',
      name_ar: '',
      description: '',
      description_ar: '',
      base_price: 0,
      capacity: 4,
      bedroom_count: 2,
      bathroom_count: 1,
      is_active: true,
      is_featured: false,
      amenities: [],
    });
    setShowModal(true);
  };

  const openEditModal = (chalet: Chalet) => {
    setEditingChalet(chalet);
    setFormData({ ...chalet });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.base_price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      if (editingChalet) {
        await api.put(`/chalets/admin/chalets/${editingChalet.id}`, formData);
        toast.success('Chalet updated successfully');
      } else {
        await api.post('/chalets/admin/chalets', formData);
        toast.success('Chalet created successfully');
      }
      fetchChalets();
      setShowModal(false);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to save chalet');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this chalet? This will also delete all associated bookings.')) return;

    try {
      await api.delete(`/chalets/admin/chalets/${id}`);
      toast.success('Chalet deleted');
      fetchChalets();
    } catch (error) {
      toast.error('Failed to delete chalet');
    }
  };

  const toggleAvailability = async (chalet: Chalet) => {
    try {
      await api.put(`/chalets/admin/chalets/${chalet.id}`, {
        is_active: !chalet.is_active,
      });
      fetchChalets();
      toast.success(`Chalet ${chalet.is_active ? 'hidden' : 'shown'}`);
    } catch (error) {
      toast.error('Failed to update availability');
    }
  };

  const toggleAmenity = (amenityId: string) => {
    const current = formData.amenities || [];
    if (current.includes(amenityId)) {
      setFormData({ ...formData, amenities: current.filter(a => a !== amenityId) });
    } else {
      setFormData({ ...formData, amenities: [...current, amenityId] });
    }
  };

  const filteredChalets = chalets.filter(chalet =>
    chalet.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Home className="w-6 h-6 text-white" />
            </div>
            Chalets Management
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage chalets, pricing, and availability
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex gap-2">
          <Button variant="outline" onClick={fetchChalets} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Chalet
          </Button>
        </motion.div>
      </div>

      {/* Search */}
      <motion.div variants={fadeInUp}>
        <Card>
          <CardContent className="p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search chalets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Chalets</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{chalets.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Available</p>
          <p className="text-2xl font-bold text-emerald-600">
            {chalets.filter(c => c.is_active).length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Featured</p>
          <p className="text-2xl font-bold text-amber-600">
            {chalets.filter(c => c.is_featured).length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Capacity</p>
          <p className="text-2xl font-bold text-blue-600">
            {chalets.reduce((acc, c) => acc + (c.capacity || 0), 0)} guests
          </p>
        </div>
      </motion.div>

      {/* Chalets Grid */}
      <motion.div variants={fadeInUp}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredChalets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Home className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-500 dark:text-slate-400">No chalets found</p>
              <Button onClick={openCreateModal} className="mt-4">
                Add your first chalet
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredChalets.map((chalet, index) => (
                <motion.div
                  key={chalet.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={`overflow-hidden ${!chalet.is_active ? 'opacity-60' : ''}`}>
                    {/* Image */}
                    <div className="relative h-48 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
                      {chalet.image_url ? (
                        <img
                          src={chalet.image_url}
                          alt={chalet.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="w-12 h-12 text-slate-400" />
                        </div>
                      )}
                      {/* Badges */}
                      <div className="absolute top-3 right-3 flex gap-2">
                        {chalet.is_featured && (
                          <span className="px-2 py-1 bg-amber-500 text-white text-xs rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Featured
                          </span>
                        )}
                        {!chalet.is_active && (
                          <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                            Unavailable
                          </span>
                        )}
                      </div>
                      {/* Price Badge */}
                      <div className="absolute bottom-3 left-3 px-3 py-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg">
                        <span className="text-lg font-bold text-blue-600">
                          {formatCurrency(chalet.base_price)}
                        </span>
                        <span className="text-sm text-slate-500">/night</span>
                      </div>
                    </div>

                    <CardContent className="p-4">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        {chalet.name}
                      </h3>

                      {/* Details */}
                      <div className="flex flex-wrap gap-3 mb-3 text-sm text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {chalet.capacity} guests
                        </span>
                        <span className="flex items-center gap-1">
                          <Bed className="w-4 h-4" />
                          {chalet.bedroom_count} beds
                        </span>
                        <span className="flex items-center gap-1">
                          <Bath className="w-4 h-4" />
                          {chalet.bathroom_count} baths
                        </span>
                      </div>

                      {/* Amenities */}
                      {chalet.amenities && chalet.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {chalet.amenities.slice(0, 4).map(amenity => (
                            <span
                              key={amenity}
                              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-400"
                            >
                              {amenity.replace(/_/g, ' ')}
                            </span>
                          ))}
                          {chalet.amenities.length > 4 && (
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-400">
                              +{chalet.amenities.length - 4} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleAvailability(chalet)}
                          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm transition-colors ${
                            chalet.is_active
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                              : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30'
                          }`}
                        >
                          {chalet.is_active ? (
                            <>
                              <EyeOff className="w-4 h-4" />
                              Hide
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" />
                              Show
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(chalet)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(chalet.id)}
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
                  {editingChalet ? 'Edit Chalet' : 'Add New Chalet'}
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
                      placeholder="e.g., Sunset Villa"
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
                      placeholder="Describe the chalet..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Price/Night *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.base_price || ''}
                        onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) })}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Capacity (Max Guests)
                    </label>
                    <Input
                      type="number"
                      value={formData.capacity || ''}
                      onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Bedrooms
                    </label>
                    <Input
                      type="number"
                      value={formData.bedroom_count || ''}
                      onChange={(e) => setFormData({ ...formData, bedroom_count: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Bathrooms
                    </label>
                    <Input
                      type="number"
                      value={formData.bathroom_count || ''}
                      onChange={(e) => setFormData({ ...formData, bathroom_count: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Weekend Price
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.weekend_price || ''}
                      onChange={(e) => setFormData({ ...formData, weekend_price: parseFloat(e.target.value) })}
                    />
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
                </div>

                {/* Amenities */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Amenities
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {amenityOptions.map(amenity => {
                      const isSelected = formData.amenities?.includes(amenity.id);
                      const Icon = amenity.icon;
                      return (
                        <button
                          key={amenity.id}
                          type="button"
                          onClick={() => toggleAmenity(amenity.id)}
                          className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{amenity.label}</span>
                          {isSelected && <Check className="w-4 h-4 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active ?? true}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Available for booking</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_featured ?? false}
                      onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-500" />
                      Featured
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
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingChalet ? 'Update Chalet' : 'Create Chalet'}
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
