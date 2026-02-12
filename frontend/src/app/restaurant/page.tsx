'use client';

import { useQuery } from '@tanstack/react-query';
import { restaurantApi } from '@/lib/api';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
import { useContentTranslation } from '@/lib/translate';
import { motion, AnimatePresence } from 'framer-motion';

import { normalizeMenuItem, containerVariants, type MenuItem } from './components/types';
import { RestaurantHero } from './components/RestaurantHero';
import { FeaturedDishes } from './components/FeaturedDishes';
import { CategoryFilters } from './components/CategoryFilters';
import { MenuItemCard } from './components/MenuItemCard';
import { FloatingCartBar } from './components/FloatingCartBar';
import { RestaurantLoading, RestaurantError, RestaurantEmptyState } from './components/RestaurantStates';
import { RestaurantModals } from './components/RestaurantModals';
import { useMenuActions } from './components/useMenuActions';

export default function RestaurantMenuPage() {
  const t = useTranslations('restaurant');
  const tCommon = useTranslations('common');
  const { settings, modules } = useSiteSettings();
  const restaurantModule = modules.find(m => m.slug === 'restaurant');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [dietaryFilters, setDietaryFilters] = useState<{
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
  }>({ vegetarian: false, vegan: false, glutenFree: false });
  const currency = useSettingsStore((s) => s.currency);
  const { translateContent, isRTL } = useContentTranslation();

  const {
    cartTotal, cartCount, removeFromRestaurant,
    selectedItemForModifiers, setSelectedItemForModifiers,
    selectedItemForCustomization, setSelectedItemForCustomization,
    handleItemClick, handleCustomizationConfirm, addToCart,
    getItemQuantity,
  } = useMenuActions(translateContent, t);

  // FIX Iter-2: Removed enabled guard — query fires immediately without moduleId,
  // then refetches when modules load (queryKey includes moduleId so React Query handles it)
  const { data, isLoading, error } = useQuery({
    queryKey: ['restaurant-menu', restaurantModule?.id],
    queryFn: () => restaurantApi.getMenu(restaurantModule?.id),
  });

  // Normalize menu items from API (snake_case → camelCase)
  const rawItems = data?.data?.data?.items || [];
  const menuItems: MenuItem[] = rawItems.map(normalizeMenuItem);
  const categories = data?.data?.data?.categories || [];

  // Filter items by category
  let filteredItems = selectedCategory
    ? menuItems.filter((item) => item.category.id === selectedCategory)
    : menuItems;

  // Apply dietary filters
  if (dietaryFilters.vegetarian) {
    filteredItems = filteredItems.filter((item) => item.isVegetarian);
  }
  if (dietaryFilters.vegan) {
    filteredItems = filteredItems.filter((item) => item.isVegan);
  }
  if (dietaryFilters.glutenFree) {
    filteredItems = filteredItems.filter((item) => item.isGlutenFree);
  }

  if (showFeaturedOnly) {
    filteredItems = filteredItems.filter((item) => item.isFeatured);
  }

  const featuredItems = menuItems.filter((item) => item.isFeatured).slice(0, 3);
  const hasDietaryItems = menuItems.some((item) => item.isVegetarian || item.isVegan || item.isGlutenFree);

  const toggleDietaryFilter = (filter: 'vegetarian' | 'vegan' | 'glutenFree') => {
    setDietaryFilters((prev) => ({ ...prev, [filter]: !prev[filter] }));
  };

  if (isLoading) return <RestaurantLoading t={t} />;

  if (error) return <RestaurantError tCommon={tCommon} />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <RestaurantHero
        restaurantName={settings.restaurantName}
        menuItemCount={menuItems.length}
        categoryCount={categories.length}
        t={t}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-6 relative z-10">
        {/* Featured Dishes Section */}
        {featuredItems.length > 0 && !selectedCategory && (
          <FeaturedDishes
            items={featuredItems}
            currency={currency}
            showFeaturedOnly={showFeaturedOnly}
            onToggleFeatured={() => setShowFeaturedOnly(!showFeaturedOnly)}
            onItemClick={handleItemClick}
            translateContent={translateContent}
            t={t}
          />
        )}

        <CategoryFilters
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          dietaryFilters={dietaryFilters}
          onToggleDietary={toggleDietaryFilter}
          hasDietaryItems={hasDietaryItems}
          translateContent={translateContent}
          t={t}
          tCommon={tCommon}
        />

        {/* Menu Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory || 'all'}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                currency={currency}
                quantity={getItemQuantity(item.id)}
                onAdd={handleItemClick}
                onRemove={(id) => removeFromRestaurant(id)}
                translateContent={translateContent}
                t={t}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredItems.length === 0 && <RestaurantEmptyState t={t} tCommon={tCommon} />}
      </main>

      <FloatingCartBar
        cartCount={cartCount}
        cartTotal={cartTotal}
        currency={currency}
        t={t}
      />

      <RestaurantModals
        selectedItemForModifiers={selectedItemForModifiers}
        setSelectedItemForModifiers={setSelectedItemForModifiers}
        selectedItemForCustomization={selectedItemForCustomization}
        setSelectedItemForCustomization={setSelectedItemForCustomization}
        handleCustomizationConfirm={handleCustomizationConfirm}
        addToCart={addToCart}
        translateContent={translateContent}
      />
    </div>
  );
}
