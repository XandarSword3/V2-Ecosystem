'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { formatCurrency } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  DollarSign,
  X,
  Save,
  ChevronDown,
  RefreshCw,
  Eye,
  EyeOff,
  Flame,
  Leaf,
  ChefHat,
  Layers,
  Check,
  Package,
  Upload,
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
  is_spicy: boolean;
  preparation_time?: number;
  allergens?: string[];
  recipe?: RecipeItem[];
  customization_group_ids?: string[];
}

interface RecipeItem {
  ingredient_id: string;
  ingredient_name?: string;
  quantity: number;
  unit: string;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock_quantity: number;
  cost_per_unit: number;
}

interface CustomizationGroup {
  id: string;
  name: string;
  description?: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  options: CustomizationOption[];
}

interface CustomizationOption {
  id: string;
  name: string;
  // Depending on which backend route the UI is wired to, the price delta may come
  // either as `price_modifier` or as `price_adjustment`.
  price_modifier?: number;
  price_adjustment?: number;
}

const getCustomizationOptionPrice = (opt: CustomizationOption): number =>
  opt.price_modifier ?? opt.price_adjustment ?? 0;

interface Category {
  id: string;
  name: string;
  name_ar?: string;
  display_order: number;
}

export default function DynamicMenuPage() {
  const params = useParams();
  const router = useRouter();
  const { modules } = useSiteSettings();
  const t = useTranslations('admin');
  
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const propertySlug = (params?.property as string) || '';
  const currentModule = modules.find(m => m.slug === slug);

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [customizationGroups, setCustomizationGroups] = useState<CustomizationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState<Partial<MenuItem>>({});
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [groupSearch, setGroupSearch] = useState('');

  useEffect(() => {
    if (currentModule) {
      fetchData();
    }
  }, [currentModule]);

  const fetchData = async () => {
    if (!currentModule) return;
    try {
      setLoading(true);
      const [menuRes, catRes, ingredientsRes, groupsRes] = await Promise.all([
        api.get(`/${slug}/items`, { params: { moduleId: currentModule.id } }),
        api.get(`/${slug}/categories`, { params: { moduleId: currentModule.id } }),
        api.get('/inventory/items', { params: { moduleId: currentModule.id } }).catch((e) => {
          console.warn('[Menu Page] Inventory items fetch failed:', e.message);
          return { data: { data: [] } };
        }),
        api.get(`/${slug}/modifiers`, { params: { moduleId: currentModule.id } }).catch((e) => {
          console.warn('[Menu Page] Modifiers fetch failed:', e.message);
          return { data: { data: [] } };
        }),
      ]);
      setItems(menuRes.data.data || []);
      setCategories(catRes.data.data || []);
      setIngredients(ingredientsRes.data.data || []);
      setCustomizationGroups(groupsRes.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch menu data');
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
    setRecipeItems([]);
    setSelectedGroups([]);
    setActiveTab('details');
    setShowModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setRecipeItems(item.recipe || []);
    setSelectedGroups(item.customization_group_ids || []);
    setActiveTab('details');
    setShowModal(true);
  };

  // Recipe management
  const addRecipeItem = () => {
    if (ingredients.length === 0) return;
    setRecipeItems([
      ...recipeItems,
      { ingredient_id: ingredients[0].id, quantity: 1, unit: ingredients[0].unit }
    ]);
  };

  const updateRecipeItem = (index: number, field: keyof RecipeItem, value: string | number) => {
    const updated = [...recipeItems];
    if (field === 'ingredient_id') {
      const ingredient = ingredients.find(i => i.id === value);
      updated[index] = { ...updated[index], [field]: value as string, unit: ingredient?.unit || '' };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setRecipeItems(updated);
  };

  const removeRecipeItem = (index: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== index));
  };

  // Customization group management
  const toggleCustomizationGroup = (groupId: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.category_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!currentModule) return;

    try {
      setSaving(true);
      const payload = { 
        ...formData, 
        module_id: currentModule.id,
        recipe: recipeItems.length > 0 ? recipeItems : undefined,
        customization_group_ids: selectedGroups.length > 0 ? selectedGroups : undefined,
      };
      
      if (editingItem) {
        await api.put(`/${slug}/admin/items/${editingItem.id}`, payload);
        toast.success('Menu item updated successfully');
      } else {
        await api.post(`/${slug}/admin/items`, payload);
        toast.success('Menu item created successfully');
      }
      fetchData();
      setShowModal(false);
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(errorMessage || 'Failed to save menu item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
      await api.delete(`/${slug}/admin/items/${id}`);
      toast.success('Menu item deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete menu item');
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await api.put(`/${slug}/admin/items/${item.id}`, {
        is_available: !item.is_available,
      });
      fetchData();
      toast.success(`Item ${item.is_available ? 'hidden' : 'shown'}`);
    } catch (error) {
      toast.error('Failed to update availability');
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

  if (!currentModule) return null;

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
            {currentModule.name} Menu
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage menu items for {currentModule.name}
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex gap-2">
          <Button variant="outline" onClick={() => fetchData()} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/${slug}/menu/import`)}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import Menu
          </Button>
          <Button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white"
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
                  placeholder="Search menu items..."
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
                  <option value="all">All Categories</option>
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
              <p className="text-slate-500 dark:text-slate-400">No menu items found</p>
              <Button onClick={openCreateModal} className="mt-4">
                Add your first item
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
                            Featured
                          </span>
                        )}
                        {!item.is_available && (
                          <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                            Hidden
                          </span>
                        )}
                      </div>
                      {/* Icons */}
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        {item.is_vegetarian && (
                          <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <Leaf className="w-3 h-3 text-white" />
                          </span>
                        )}
                        {item.is_spicy && (
                          <span className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
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
                        <p className="text-lg font-bold text-orange-600">
                          {formatCurrency(item.price)}
                        </p>
                      </div>

                      {item.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                          {item.description}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleAvailability(item)}
                          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm transition-colors ${
                            item.is_available
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                              : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-900/30'
                          }`}
                        >
                          {item.is_available ? (
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
                          onClick={() => openEditModal(item)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
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
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center z-10">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="px-6 pt-4 border-b border-slate-200 dark:border-slate-700">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="details" className="flex items-center gap-2">
                      <UtensilsCrossed className="w-4 h-4" />
                      Basic Details
                    </TabsTrigger>
                    <TabsTrigger value="recipe" className="flex items-center gap-2">
                      <ChefHat className="w-4 h-4" />
                      Recipe
                    </TabsTrigger>
                    <TabsTrigger value="customizations" className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Customizations
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Basic Details Tab */}
                <TabsContent value="details" className="p-6 space-y-6">
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
                </TabsContent>

                {/* Recipe Tab */}
                <TabsContent value="recipe" className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white">Recipe & Ingredients</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Define ingredients and quantities for inventory tracking
                      </p>
                    </div>
                    <Button
                      onClick={addRecipeItem}
                      disabled={ingredients.length === 0}
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Ingredient
                    </Button>
                  </div>

                  {ingredients.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <Package className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                      <p className="text-slate-500 dark:text-slate-400">No ingredients available</p>
                      <p className="text-sm text-slate-400 dark:text-slate-500">
                        Add ingredients in Inventory management first
                      </p>
                    </div>
                  ) : recipeItems.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <ChefHat className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                      <p className="text-slate-500 dark:text-slate-400">No recipe defined</p>
                      <p className="text-sm text-slate-400 dark:text-slate-500">
                        Click &quot;Add Ingredient&quot; to start building the recipe
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recipeItems.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg"
                        >
                          <select
                            value={item.ingredient_id}
                            onChange={(e) => updateRecipeItem(index, 'ingredient_id', e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                          >
                            {ingredients.map(ing => (
                              <option key={ing.id} value={ing.id}>{ing.name}</option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateRecipeItem(index, 'quantity', parseFloat(e.target.value))}
                            className="w-24"
                            placeholder="Qty"
                          />
                          <span className="text-sm text-slate-500 dark:text-slate-400 w-16">
                            {item.unit || ingredients.find(i => i.id === item.ingredient_id)?.unit || 'unit'}
                          </span>
                          <button
                            onClick={() => removeRecipeItem(index)}
                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {recipeItems.length > 0 && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>Estimated Cost:</strong>{' '}
                        {formatCurrency(
                          recipeItems.reduce((sum, item) => {
                            const ing = ingredients.find(i => i.id === item.ingredient_id);
                            return sum + (ing?.cost_per_unit || 0) * item.quantity;
                          }, 0)
                        )}
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Customizations Tab */}
                <TabsContent value="customizations" className="p-6 space-y-4">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">Customization Groups</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Select which modifier groups apply to this item. Customers will see these options when ordering.
                    </p>
                  </div>

                  {customizationGroups.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <Layers className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                      <p className="text-slate-500 dark:text-slate-400">No customization groups available</p>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Create modifier groups first in{' '}
                        <a href={`/${propertySlug}/${currentModule?.slug}/admin/settings/customizations`} className="text-orange-500 hover:underline">
                          Settings → Customizations
                        </a>
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Search bar for groups */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search groups…"
                          value={groupSearch}
                          onChange={e => setGroupSearch(e.target.value)}
                          className="w-full px-3 py-2 pl-9 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-orange-500"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      </div>

                      <div className="space-y-3">
                        {customizationGroups
                          .filter(g => !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase()))
                          .map(group => {
                            const isSelected = selectedGroups.includes(group.id);
                            return (
                              <div
                                key={group.id}
                                onClick={() => toggleCustomizationGroup(group.id)}
                                className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h5 className="font-medium text-slate-900 dark:text-white">
                                        {group.name}
                                      </h5>
                                      {group.is_required && (
                                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-full font-medium">
                                          Required
                                        </span>
                                      )}
                                      {(group.min_selections != null || group.max_selections != null) && (
                                        <span className="text-xs text-slate-400">
                                          {group.min_selections != null ? `min ${group.min_selections}` : ''}
                                          {group.min_selections != null && group.max_selections != null ? ' · ' : ''}
                                          {group.max_selections != null ? `max ${group.max_selections}` : ''}
                                        </span>
                                      )}
                                    </div>
                                    {group.description && (
                                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
                                        {group.description}
                                      </p>
                                    )}
                                    {/* Option tags with modifier type */}
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {group.options.slice(0, 6).map(opt => {
                                        const type = (opt as any).modifier_type || (opt as any).type;
                                        const price = getCustomizationOptionPrice(opt);
                                        const typeStyle =
                                          type === 'remove' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                                          type === 'swap'   ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                                                             'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
                                        return (
                                          <span key={opt.id} className={`px-2 py-0.5 text-xs rounded-full font-medium ${typeStyle}`}>
                                            {type === 'remove' ? '−' : type === 'swap' ? '⇄' : '+'}
                                            {' '}{opt.name}
                                            {price !== 0 && (
                                              <span className="ml-1 opacity-75">
                                                {price > 0 ? '+' : ''}{formatCurrency(price)}
                                              </span>
                                            )}
                                          </span>
                                        );
                                      })}
                                      {group.options.length > 6 && (
                                        <span className="px-2 py-0.5 text-xs text-slate-400 dark:text-slate-500">
                                          +{group.options.length - 6} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                                    isSelected
                                      ? 'border-orange-500 bg-orange-500'
                                      : 'border-slate-300 dark:border-slate-600'
                                  }`}>
                                    {isSelected && <Check className="w-4 h-4 text-white" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        {customizationGroups.filter(g => !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase())).length === 0 && (
                          <p className="text-center text-sm text-slate-400 py-4">No groups match "{groupSearch}"</p>
                        )}
                      </div>
                    </>
                  )}

                  {selectedGroups.length > 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      ✓ {selectedGroups.length} group{selectedGroups.length !== 1 ? 's' : ''} assigned to this item
                    </p>
                  )}
                </TabsContent>
              </Tabs>

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
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 text-white"
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
