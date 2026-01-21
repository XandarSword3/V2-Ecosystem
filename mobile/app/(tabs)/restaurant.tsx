/**
 * Restaurant/Dining Screen
 * Fetches real menu data from backend API - mirrors website functionality
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { restaurantApi, modulesApi } from '../../src/api/client';
import { API_BASE_URL } from '../../src/config/env';
import { Search, Star, Clock, AlertCircle, UtensilsCrossed, RefreshCw } from 'lucide-react-native';

// Helper to get full image URL
const getImageUrl = (path?: string | null) => {
  if (!path) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400';
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
};

export default function RestaurantScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch restaurant modules
  const {
    data: modulesData,
    isLoading: modulesLoading,
  } = useQuery({
    queryKey: ['restaurant-modules'],
    queryFn: () => modulesApi.getModules('restaurant'),
  });

  // Get first restaurant module ID
  const restaurantModule = modulesData?.data?.[0];

  // Fetch menu items
  const {
    data: menuData,
    isLoading: menuLoading,
    error: menuError,
    refetch: refetchMenu,
    isRefetching,
  } = useQuery({
    queryKey: ['restaurant-menu', restaurantModule?.id],
    queryFn: () => restaurantApi.getMenu(activeCategory !== 'All' ? activeCategory : undefined),
    enabled: true, // Always fetch, backend handles module filtering
  });

  // Fetch categories
  const {
    data: categoriesData,
  } = useQuery({
    queryKey: ['restaurant-categories'],
    queryFn: () => restaurantApi.getCategories(),
  });

  // Handle both array response and object response with items property
  // Backend /restaurant/menu returns { data: { categories, items, menuByCategory } }
  const rawData = menuData?.data;
  const menuItems: any[] = Array.isArray(rawData) ? rawData : ((rawData as any)?.items || []);
  const categories: any[] = categoriesData?.data || (rawData as any)?.categories || [];
  const categoryNames = ['All', ...categories.map((c: any) => c.name)];

  // Filter items by search and category
  const filteredItems = menuItems.filter((item: any) => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const isLoading = modulesLoading || menuLoading;

  const handleItemPress = (itemId: string) => {
    router.push(`/restaurant/item/${itemId}` as any);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 py-4 bg-background border-b border-border">
        <Text className="text-2xl font-bold text-foreground mb-4">Dining & Bars</Text>
        <View className="relative">
          <View className="absolute left-3 top-3 z-10">
            <Search size={20} color="#9CA3AF" />
          </View>
          <Input
            placeholder="Search menu items..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="pl-10 bg-muted/50 border-0"
          />
        </View>
      </View>

      {/* Categories */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12 }}
          className="flex-grow-0"
        >
          {categoryNames.length > 0 ? (
            categoryNames.map((cat, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setActiveCategory(cat)}
                className={`mr-3 px-5 py-2 rounded-full border ${
                  activeCategory === cat
                    ? 'bg-primary border-primary'
                    : 'bg-transparent border-muted'
                }`}
              >
                <Text
                  className={`font-medium ${
                    activeCategory === cat ? 'text-white' : 'text-muted-foreground'
                  }`}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            // Default categories if API returns none
            ['All', 'Breakfast', 'Lunch', 'Dinner', 'Drinks'].map((cat, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setActiveCategory(cat)}
                className={`mr-3 px-5 py-2 rounded-full border ${
                  activeCategory === cat
                    ? 'bg-primary border-primary'
                    : 'bg-transparent border-muted'
                }`}
              >
                <Text
                  className={`font-medium ${
                    activeCategory === cat ? 'text-white' : 'text-muted-foreground'
                  }`}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* Menu Items */}
      <ScrollView
        className="flex-1 px-6 pt-2"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchMenu} />
        }
      >
        {/* Error State */}
        {menuError && (
          <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 mb-4">
            <CardContent className="p-4 flex-row items-center">
              <AlertCircle size={20} color="#ef4444" />
              <Text className="text-red-600 dark:text-red-400 ml-2 flex-1">
                Failed to load menu. Pull down to retry.
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#0ea5e9" />
            <Text className="text-muted-foreground mt-3">Loading menu...</Text>
          </View>
        ) : filteredItems.length > 0 ? (
          <>
            <Text className="text-lg font-semibold mb-4 text-foreground">
              {activeCategory === 'All' ? 'All Items' : activeCategory} ({filteredItems.length})
            </Text>

            {filteredItems.map((item: any) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.9}
                onPress={() => handleItemPress(item.id)}
                className="mb-4"
              >
                <Card className="overflow-hidden border-0 shadow-sm bg-card">
                  <View className="flex-row">
                    {/* Image */}
                    <Image
                      source={{ uri: getImageUrl(item.imageUrl) }}
                      className="w-28 h-28"
                      resizeMode="cover"
                    />
                    {/* Content */}
                    <CardContent className="flex-1 p-3 justify-between">
                      <View>
                        <View className="flex-row justify-between items-start">
                          <Text className="text-base font-bold text-foreground flex-1" numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.popular && (
                            <View className="bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded ml-2">
                              <Text className="text-xs font-medium text-orange-600 dark:text-orange-400">
                                Popular
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-sm text-muted-foreground mt-1" numberOfLines={2}>
                          {item.description || 'Delicious dish prepared fresh'}
                        </Text>
                      </View>
                      <View className="flex-row justify-between items-center mt-2">
                        <Text className="text-lg font-bold text-primary">
                          ${item.price.toFixed(2)}
                        </Text>
                        <View className="flex-row items-center">
                          <Clock size={12} color="#6B7280" />
                          <Text className="text-xs text-muted-foreground ml-1">
                            {item.preparationTime || 15} min
                          </Text>
                        </View>
                      </View>
                      {/* Dietary Flags */}
                      {item.dietaryFlags && item.dietaryFlags.length > 0 && (
                        <View className="flex-row flex-wrap mt-1">
                          {item.dietaryFlags.slice(0, 3).map((flag: string, i: number) => (
                            <Text
                              key={i}
                              className="text-xs text-green-600 dark:text-green-400 mr-2"
                            >
                              {flag}
                            </Text>
                          ))}
                        </View>
                      )}
                    </CardContent>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <View className="items-center py-12">
            <UtensilsCrossed size={48} color="#94a3b8" />
            <Text className="text-lg font-semibold text-foreground mt-4">
              {searchQuery ? 'No items found' : 'Menu is empty'}
            </Text>
            <Text className="text-muted-foreground text-center mt-2">
              {searchQuery
                ? 'Try a different search term'
                : 'Check back later for our delicious offerings'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                onPress={() => refetchMenu()}
                className="flex-row items-center mt-4"
              >
                <RefreshCw size={16} color="#0ea5e9" />
                <Text className="text-primary ml-2">Refresh</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
