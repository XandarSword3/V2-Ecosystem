'use client';

import { useQuery } from '@tanstack/react-query';
import { restaurantApi, api } from '@/lib/api';
import { Loader2, AlertCircle, Sparkles, Star, UtensilsCrossed, ShoppingCart, Plus, Minus, Search, X, Flame, Leaf, Wheat } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useCartStore } from '@/stores/cartStore';
import { useContentTranslation } from '@/lib/translate';
import { motion, AnimatePresence } from 'framer-motion';
import { Module } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ModifierSelectionModal, type SelectedModifier } from '@/components/restaurant/ModifierSelectionModal';
import { CustomizationSelector } from '@/components/customization/CustomizationSelector';

interface MenuServiceProps {
  module: Module;
}

interface MenuCategoryItem {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
}

interface MenuItemData {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  description?: string;
  price: number;
  category_id: string;
  image_url?: string;
  image?: string;
  discount_price?: number;
  is_featured?: boolean;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
}

export function MenuService({ module }: MenuServiceProps) {
  const t = useTranslations('restaurant');
  const tCommon = useTranslations('common');
  const { translateContent } = useContentTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [dietaryFilters, setDietaryFilters] = useState<{
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
  }>({ vegetarian: false, vegan: false, glutenFree: false });
  const currency = useSettingsStore((s) => s.currency);
  const router = useRouter();

  // Use the cart store
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const allItems = useCartStore((s) => s.items);

  const isSnackBar = module.slug === 'snack-bar';

  // Modifier/Customization modal state
  const [selectedItemForModifiers, setSelectedItemForModifiers] = useState<MenuItemData | null>(null);
  const [selectedItemForCustomization, setSelectedItemForCustomization] = useState<MenuItemData | null>(null);
  const [checkingCustomizations, setCheckingCustomizations] = useState(false);

  // When user clicks an item for the first time, check for customizations/modifiers
  const handleItemClick = useCallback(async (item: MenuItemData) => {
    setCheckingCustomizations(true);
    try {
      const response = await api.get(`/customizations/for-entity/menu_item/${item.id}`);
      const customizationGroups = response.data || [];
      if (customizationGroups.length > 0) {
        setSelectedItemForCustomization(item);
      } else {
        setSelectedItemForModifiers(item);
      }
    } catch (error) {
      // No customizations found, try legacy modifier modal
      setSelectedItemForModifiers(item);
    } finally {
      setCheckingCustomizations(false);
    }
  }, []);

  // Handle customization confirm (new system)
  const handleCustomizationConfirm = useCallback((data: {
    selections: any[];
    totalPriceAdjustment: number;
    lineTotal: number;
    quantity: number;
  }) => {
    if (!selectedItemForCustomization) return;
    
    const translatedName = translateContent(selectedItemForCustomization, 'name');
    const basePrice = Number(selectedItemForCustomization.price);
    
    const mapCustomizationType = (type: string): 'add' | 'remove' | 'swap' => {
      switch (type) {
        case 'remove': return 'remove';
        case 'swap':
        case 'replace':
        case 'upgrade': return 'swap';
        default: return 'add';
      }
    };
    
    const customizationDetails = data.selections.map((s: any) => ({
      optionId: s.optionId,
      optionName: s.optionName,
      groupId: s.groupId,
      groupName: s.groupName,
      modifierType: mapCustomizationType(s.customizationType),
      priceAdjustment: s.priceAdjustment || s.totalPrice || 0,
      quantity: s.quantity,
    }));
    
    for (let i = 0; i < data.quantity; i++) {
      addItem({
        id: selectedItemForCustomization.id,
        name: translatedName,
        price: basePrice,
        quantity: 1,
        moduleId: module.id,
        moduleSlug: module.slug,
        moduleName: module.name,
        type: isSnackBar ? 'snack' : 'restaurant',
        imageUrl: selectedItemForCustomization.image_url || selectedItemForCustomization.image,
        selectedModifiers: customizationDetails,
        modifierTotal: data.totalPriceAdjustment,
      });
    }
    
    toast.success(`${translatedName} added to cart`);
    setSelectedItemForCustomization(null);
  }, [selectedItemForCustomization, translateContent, addItem, module, isSnackBar]);

  // Handle modifier modal add to cart (legacy system)
  const handleModifierAddToCart = useCallback((item: {
    id: string;
    name: string;
    price: number;
    category?: string;
    imageUrl?: string;
    selectedModifiers?: SelectedModifier[];
    modifierTotal?: number;
    specialInstructions?: string;
  }) => {
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      moduleId: module.id,
      moduleSlug: module.slug,
      moduleName: module.name,
      type: isSnackBar ? 'snack' : 'restaurant',
      imageUrl: item.imageUrl,
      selectedModifiers: item.selectedModifiers,
      modifierTotal: item.modifierTotal,
      specialInstructions: item.specialInstructions,
    });
    toast.success(`${item.name} added to cart`);
  }, [addItem, module, isSnackBar]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['menu', module.id],
    queryFn: () => restaurantApi.getMenu(module.id),
  });

  const categories: MenuCategoryItem[] = data?.data?.data?.categories || [];
  const items: MenuItemData[] = data?.data?.data?.items || [];

  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedCategory) {
      result = result.filter((item: MenuItemData) => item.category_id === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item: MenuItemData) =>
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      );
    }
    // Dietary filters
    if (dietaryFilters.vegetarian) {
      result = result.filter((item: MenuItemData) => item.is_vegetarian);
    }
    if (dietaryFilters.vegan) {
      result = result.filter((item: MenuItemData) => item.is_vegan);
    }
    if (dietaryFilters.glutenFree) {
      result = result.filter((item: MenuItemData) => item.is_gluten_free);
    }
    // Featured filter
    if (showFeaturedOnly) {
      result = result.filter((item: MenuItemData) => item.is_featured);
    }
    return result;
  }, [items, selectedCategory, searchQuery, dietaryFilters, showFeaturedOnly]);

  const featuredItems = useMemo(() => 
    items.filter((item: MenuItemData) => item.is_featured).slice(0, 3),
    [items]
  );
  const hasDietaryItems = useMemo(() => 
    items.some((item: MenuItemData) => item.is_vegetarian || item.is_vegan || item.is_gluten_free),
    [items]
  );

  // Cart totals for floating bar
  const cartTotal = allItems
    .filter((i) => i.moduleId === module.id)
    .reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = allItems
    .filter((i) => i.moduleId === module.id)
    .reduce((sum, i) => sum + i.quantity, 0);

  const addToCart = (item: MenuItemData) => {
    const cartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      moduleId: module.id,
      moduleSlug: module.slug,
      moduleName: module.name,
      type: isSnackBar ? 'snack' : 'restaurant',
      // Ensure image is mapped correctly if it's 'image_url' in API response
      imageUrl: item.image_url || item.image 
    };

    addItem(cartItem);

    // Pass item name for the translation string; fallback to a simple English string
    const translatedName = translateContent(item, 'name');
    const msg = tCommon('addedToCart', { name: translatedName });
    if (typeof msg === 'string' && msg.includes('MISSING_MESSAGE')) {
      toast.success(`${translatedName} added to cart`);
    } else {
      toast.success(msg);
    }
  };

  const removeFromCart = (itemId: string) => {
    removeItem(itemId);
  };

  const getItemQuantity = (itemId: string) => {
    // Find item with same ID and Module ID
    const item = allItems.find((i) => i.id === itemId && i.moduleId === module.id);
    return item?.quantity || 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p>{tCommon('error')}</p>
        </div>
      </div>
    );
  }

  // Get module-specific colors or use defaults
  const headerColor = module.settings?.header_color || '#0ea5e9';
  const accentColor = module.settings?.accent_color || '#6366f1';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Hero Section */}
      <div 
        className="relative overflow-hidden pt-24 pb-20"
        style={{ background: `linear-gradient(to right, ${headerColor}, ${accentColor})` }}
      >
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-white" />
              <span className="text-white/90 text-sm font-medium">{module.description || t('authenticLebanese')}</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
              {module.name}
            </h1>
          </motion.div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-6 relative z-10">
        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${module.name} menu...`}
              className="w-full pl-12 pr-10 py-3 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Featured Dishes Section */}
        {featuredItems.length > 0 && !selectedCategory && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="w-6 h-6 text-orange-500" />
                <span className="bg-gradient-to-r from-orange-500 via-red-500 to-amber-500 bg-clip-text text-transparent">
                  Featured Dishes
                </span>
              </h2>
              <button
                onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
                className={`text-sm font-medium px-5 py-2.5 rounded-full transition-all ${
                  showFeaturedOnly
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                    : 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-700 border border-orange-200 dark:border-slate-600'
                }`}
              >
                {showFeaturedOnly ? 'Show All' : 'View Featured'}
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredItems.map((item) => (
                <motion.div
                  key={item.id}
                  whileHover={{ y: -4 }}
                  className="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-700 rounded-2xl shadow-lg overflow-hidden border border-orange-200/50 dark:border-slate-600/50 cursor-pointer"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> Featured
                  </div>
                  {item.image_url && (
                    <div className="h-40 overflow-hidden">
                      <img src={item.image_url} alt={translateContent(item, 'name')} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 dark:text-white">{translateContent(item, 'name')}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1 mt-1">
                      {translateContent(item, 'description')}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-orange-600">{formatCurrency(item.price, currency)}</span>
                      <div className="bg-orange-500 text-white rounded-full p-2">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Dietary Filters */}
        {hasDietaryItems && (
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            <button
              onClick={() => setDietaryFilters(prev => ({ ...prev, vegetarian: !prev.vegetarian }))}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                dietaryFilters.vegetarian
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 text-green-600 dark:text-green-400 border border-green-200 dark:border-slate-600'
              }`}
            >
              <Leaf className="w-4 h-4" /> Vegetarian
            </button>
            <button
              onClick={() => setDietaryFilters(prev => ({ ...prev, vegan: !prev.vegan }))}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                dietaryFilters.vegan
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-slate-600'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Vegan
            </button>
            <button
              onClick={() => setDietaryFilters(prev => ({ ...prev, glutenFree: !prev.glutenFree }))}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                dietaryFilters.glutenFree
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-slate-600'
              }`}
            >
              <Wheat className="w-4 h-4" /> Gluten-Free
            </button>
          </div>
        )}

        {/* Categories */}
        <div className="flex flex-wrap gap-3 justify-center mb-10">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-6 py-3 rounded-full font-semibold transition-all ${
              !selectedCategory 
                ? 'text-white shadow-lg' 
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
            style={!selectedCategory ? { backgroundColor: headerColor } : {}}
          >
            All
          </button>
          {categories.map((cat: MenuCategoryItem) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-6 py-3 rounded-full font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'text-white shadow-lg' 
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
              }`}
              style={selectedCategory === cat.id ? { backgroundColor: headerColor } : {}}
            >
              {translateContent(cat, 'name')}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item: MenuItemData) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden"
            >
              {item.image_url && (
                <div className="h-48 overflow-hidden">
                  <img 
                    src={item.image_url} 
                    alt={translateContent(item, 'name')}
                    className="w-full h-full object-cover transition-transform hover:scale-110 duration-500"
                  />
                </div>
              )}
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {translateContent(item, 'name')}
                  </h3>
                  <span className="text-lg font-bold text-primary-600">
                    {formatCurrency(item.price, currency)}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                  {translateContent(item, 'description')}
                </p>
                
                <div className="flex items-center justify-between mt-4">
                  {getItemQuantity(item.id) > 0 ? (
                    <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-medium w-4 text-center">{getItemQuantity(item.id)}</span>
                      <button 
                        onClick={() => addToCart(item)}
                        className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleItemClick(item)}
                      disabled={checkingCustomizations}
                      className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {checkingCustomizations ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <ShoppingCart className="w-5 h-5" />
                      )}
                      {t('addToCart')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Floating Cart Bar */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4"
          >
            <div className="max-w-lg mx-auto">
              <button
                onClick={() => router.push(`/${module.slug}/cart`)}
                className="w-full flex items-center justify-between px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl shadow-2xl shadow-primary-600/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center">
                    <span className="font-bold text-sm">{cartCount}</span>
                  </div>
                  <span className="font-semibold">View Cart</span>
                </div>
                <span className="font-bold text-lg">{formatCurrency(cartTotal, currency)}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modifier Selection Modal (Legacy) */}
      {selectedItemForModifiers && (
        <ModifierSelectionModal
          isOpen={!!selectedItemForModifiers}
          onClose={() => setSelectedItemForModifiers(null)}
          menuItem={{
            id: selectedItemForModifiers.id,
            name: selectedItemForModifiers.name,
            name_ar: selectedItemForModifiers.name_ar,
            description: selectedItemForModifiers.description,
            price: Number(selectedItemForModifiers.price),
            image_url: selectedItemForModifiers.image_url || selectedItemForModifiers.image,
            category: undefined,
          }}
          onAddToCart={handleModifierAddToCart}
        />
      )}

      {/* Unified Customization Selector (New System) */}
      {selectedItemForCustomization && (
        <CustomizationSelector
          entityType="menu_item"
          entityId={selectedItemForCustomization.id}
          entity={{
            name: selectedItemForCustomization.name,
            nameAr: selectedItemForCustomization.name_ar,
            description: selectedItemForCustomization.description,
            basePrice: Number(selectedItemForCustomization.price),
            imageUrl: selectedItemForCustomization.image_url || selectedItemForCustomization.image,
          }}
          isOpen={!!selectedItemForCustomization}
          onClose={() => setSelectedItemForCustomization(null)}
          onConfirm={handleCustomizationConfirm}
          title={translateContent(selectedItemForCustomization, 'name')}
        />
      )}
    </div>
  );
}
