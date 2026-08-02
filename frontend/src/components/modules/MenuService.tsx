'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loader2, AlertCircle, Sparkles, Star, ShoppingCart, Plus, Minus, Search, X, Flame, Leaf, Wheat } from 'lucide-react';
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
import { CustomizationSelector } from '@/components/customization/CustomizationSelector';
import { ModuleHero, GlassSearch, CategoryPills, GlassCard, FloatingActionButton } from './';
import { isOnline, catalogItemsStore, catalogCategoriesStore } from '@/lib/offline/offline-storage';

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
  // Stock availability — populated by API when track_inventory is enabled
  is_available?: boolean;
  available_stock?: number | null;
  track_inventory?: boolean;
}

export function MenuService({ module }: MenuServiceProps) {
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

  // Customization modal state
  const [selectedItemForCustomization, setSelectedItemForCustomization] = useState<MenuItemData | null>(null);
  const [checkingCustomizations, setCheckingCustomizations] = useState(false);

  const isOutOfStock = (item: MenuItemData): boolean => {
    if (item.is_available === false) return true;
    if (item.track_inventory && item.available_stock !== null && item.available_stock !== undefined && item.available_stock <= 0) return true;
    return false;
  };

  const addToCart = useCallback((item: MenuItemData) => {
    if (isOutOfStock(item)) {
      toast.error(`${translateContent(item, 'name')} is currently unavailable`);
      return;
    }
    const cartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      moduleId: module.id,
      moduleSlug: module.slug,
      moduleName: module.name,
      imageUrl: item.image_url || item.image,
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
  }, [addItem, module, translateContent, tCommon]);

  // When user clicks an item, check whether it has any customization groups
  // attached. If it does, open the selector; otherwise (including on a
  // failed lookup) add it straight to the cart — there is no legacy
  // modifier system to fall back to anymore.
  const handleItemClick = useCallback(async (item: MenuItemData) => {
    setCheckingCustomizations(true);
    try {
      const response = await api.get(`/customizations/for-entity/catalog_item/${item.id}`);
      const customizationGroups = response.data || [];
      if (customizationGroups.length > 0) {
        setSelectedItemForCustomization(item);
      } else {
        addToCart(item);
      }
    } catch (error) {
      console.warn('Customization lookup failed, adding item without customizations', error);
      addToCart(item);
    } finally {
      setCheckingCustomizations(false);
    }
  }, [addToCart]);

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
        imageUrl: selectedItemForCustomization.image_url || selectedItemForCustomization.image,
        selectedModifiers: customizationDetails,
        modifierTotal: data.totalPriceAdjustment,
      });
    }
    
    toast.success(`${translatedName} added to cart`);
    setSelectedItemForCustomization(null);
  }, [selectedItemForCustomization, translateContent, addItem, module]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['catalog', module.slug],
    queryFn: async () => {
      if (isOnline()) {
        try {
          const [itemsRes, catsRes] = await Promise.all([
            api.get(`/${module.slug}/items`),
            api.get(`/${module.slug}/categories`),
          ]);
          const items = itemsRes.data?.data || itemsRes.data || [];
          const categories = catsRes.data?.data || catsRes.data || [];
          if (items.length) await catalogItemsStore.putMany(items);
          if (categories.length) await catalogCategoriesStore.putMany(categories);
          return { data: { success: true, data: { items, categories } } };
        } catch (err) {
          console.warn('Online catalog fetch failed, falling back to cache');
        }
      }

      // Offline or online failed — try cache
      const cachedItems = await catalogItemsStore.getAll();
      const cachedCategories = await catalogCategoriesStore.getAll();

      if (cachedItems.length > 0) {
        return {
          data: {
            success: true,
            data: {
              items: cachedItems,
              categories: cachedCategories,
            },
          },
        };
      }

      throw new Error('Catalog not available offline');
    },
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
      {/* Hero Section - New glassmorphic component */}
      <ModuleHero
        title={module.name}
        description={module.description}
        headerColor={headerColor}
        accentColor={accentColor}
        badgeText={typeof module.settings?.badge_text === 'string' ? module.settings.badge_text : 'Fresh & Delicious'}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-6 relative z-10">
        {/* Search Bar - New glassmorphic component */}
        <GlassSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={`Search ${module.name} menu...`}
          className="mb-8"
        />

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

        {/* Categories - New glassmorphic component */}
        <div className="mb-10">
          <CategoryPills
            categories={[
              { id: null, name: 'All', count: items.length },
              ...categories.map((cat: MenuCategoryItem) => ({
                id: cat.id,
                name: translateContent(cat, 'name'),
                count: items.filter((item: MenuItemData) => item.category_id === cat.id).length,
              })),
            ]}
            selectedId={selectedCategory}
            onSelect={setSelectedCategory}
            accentColor={accentColor}
          />
        </div>

        {/* Items Grid - New glassmorphic cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item: MenuItemData) => {
            const outOfStock = isOutOfStock(item);
            return (
            <GlassCard
              key={item.id}
              imageUrl={item.image_url}
              isFeatured={item.is_featured}
              accentColor={outOfStock ? '#94a3b8' : accentColor}
              onClick={() => !outOfStock && handleItemClick(item)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <h3 className={`text-xl font-bold truncate ${outOfStock ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                    {translateContent(item, 'name')}
                  </h3>
                  {outOfStock && (
                    <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      Sold out
                    </span>
                  )}
                </div>
                <span className={`text-lg font-bold ml-2 flex-shrink-0 ${outOfStock ? 'text-slate-400 dark:text-slate-500 line-through' : ''}`} style={outOfStock ? {} : { color: accentColor }}>
                  {formatCurrency(item.price, currency)}
                </span>
              </div>
              <p className={`mb-4 line-clamp-2 ${outOfStock ? 'text-slate-400 dark:text-slate-600' : 'text-slate-600 dark:text-slate-400'}`}>
                {translateContent(item, 'description')}
              </p>
              {!outOfStock && item.track_inventory && item.available_stock !== null && item.available_stock !== undefined && item.available_stock <= 5 && item.available_stock > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2">
                  Only {item.available_stock} left
                </p>
              )}
              
              <div className="flex items-center justify-between mt-4">
                {outOfStock ? (
                  <div className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 rounded-xl font-semibold flex items-center justify-center gap-2 cursor-not-allowed">
                    <ShoppingCart className="w-5 h-5" />
                    Unavailable
                  </div>
                ) : getItemQuantity(item.id) > 0 ? (
                  <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                      className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-medium w-4 text-center">{getItemQuantity(item.id)}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                      className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                    disabled={checkingCustomizations}
                    className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {checkingCustomizations ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ShoppingCart className="w-5 h-5" />
                    )}
                    {'Add to Cart'}
                  </button>
                )}
              </div>
            </GlassCard>
            );
          })}
        </div>
      </main>

      {/* Floating Cart Button - New glassmorphic component */}
      <FloatingActionButton
        count={cartCount}
        onClick={() => router.push(`/${module.slug}/cart`)}
        accentColor={accentColor}
        position="bottom-center"
        label={formatCurrency(cartTotal, currency)}
      />

      {/* Unified Customization Selector (New System) */}
      {selectedItemForCustomization && (
        <CustomizationSelector
          entityType="catalog_item"
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
