/**
 * Restaurant Menu Screen
 * Browse menu categories and items, add to cart
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Search, 
  ShoppingCart,
  Plus,
  Minus,
  Clock,
  Star,
  Filter,
  Leaf,
  AlertCircle
} from 'lucide-react-native';
import { restaurantApi } from '../../src/api/client';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string | null;
  available: boolean;
  preparationTime: number;
  dietaryFlags: string[];
  allergens: string[];
  popular: boolean;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  itemCount: number;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

export default function RestaurantMenuScreen() {
  const router = useRouter();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMenuData = useCallback(async () => {
    try {
      setError(null);
      const [categoriesRes, menuRes] = await Promise.all([
        restaurantApi.getCategories(),
        restaurantApi.getMenu(selectedCategory || undefined)
      ]);
      
      if (categoriesRes.success && categoriesRes.data) {
        setCategories(categoriesRes.data);
      }
      
      if (menuRes.success && menuRes.data) {
        setMenuItems(menuRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load menu');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchMenuData();
  }, [fetchMenuData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMenuData();
    setRefreshing(false);
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) {
        return prev.map(c => 
          c.menuItem.id === item.id 
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(c => 
          c.menuItem.id === itemId 
            ? { ...c, quantity: c.quantity - 1 }
            : c
        );
      }
      return prev.filter(c => c.menuItem.id !== itemId);
    });
  };

  const getCartQuantity = (itemId: string) => {
    return cart.find(c => c.menuItem.id === itemId)?.quantity || 0;
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const renderCategoryChip = (category: Category) => (
    <TouchableOpacity
      key={category.id}
      onPress={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
      className={`px-4 py-2 rounded-full mr-2 ${
        selectedCategory === category.id 
          ? 'bg-primary' 
          : 'bg-muted border border-border'
      }`}
    >
      <Text className={`font-medium ${
        selectedCategory === category.id ? 'text-white' : 'text-foreground'
      }`}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );

  const renderMenuItem = ({ item }: { item: MenuItem }) => {
    const quantity = getCartQuantity(item.id);
    
    return (
      <Card className={`mb-3 ${!item.available ? 'opacity-60' : ''}`}>
        <CardContent className="p-4">
          <View className="flex-row">
            {item.imageUrl && (
              <Image 
                source={{ uri: item.imageUrl }} 
                className="w-24 h-24 rounded-lg mr-4"
                resizeMode="cover"
              />
            )}
            <View className="flex-1">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <View className="flex-row items-center flex-wrap">
                    <Text className="text-foreground font-semibold text-lg">{item.name}</Text>
                    {item.popular && (
                      <View className="bg-yellow-100 px-2 py-0.5 rounded-full ml-2">
                        <Text className="text-yellow-700 text-xs font-medium">Popular</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-muted-foreground text-sm mt-1" numberOfLines={2}>
                    {item.description}
                  </Text>
                </View>
                <Text className="text-foreground font-bold text-lg">${item.price.toFixed(2)}</Text>
              </View>
              
              {/* Dietary flags */}
              {item.dietaryFlags.length > 0 && (
                <View className="flex-row flex-wrap mt-2">
                  {item.dietaryFlags.map((flag, i) => (
                    <View key={i} className="flex-row items-center bg-green-100 px-2 py-0.5 rounded-full mr-2 mb-1">
                      <Leaf size={12} color="#16A34A" />
                      <Text className="text-green-700 text-xs ml-1">{flag}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              {/* Allergens */}
              {item.allergens.length > 0 && (
                <View className="flex-row items-center mt-1">
                  <AlertCircle size={12} color="#EF4444" />
                  <Text className="text-red-500 text-xs ml-1">
                    Contains: {item.allergens.join(', ')}
                  </Text>
                </View>
              )}
              
              {/* Prep time and add to cart */}
              <View className="flex-row items-center justify-between mt-3">
                <View className="flex-row items-center">
                  <Clock size={14} color="#6B7280" />
                  <Text className="text-muted-foreground text-xs ml-1">{item.preparationTime} min</Text>
                </View>
                
                {item.available ? (
                  quantity > 0 ? (
                    <View className="flex-row items-center bg-muted rounded-lg">
                      <TouchableOpacity 
                        onPress={() => removeFromCart(item.id)}
                        className="p-2"
                      >
                        <Minus size={18} color="#4F46E5" />
                      </TouchableOpacity>
                      <Text className="text-foreground font-bold px-3">{quantity}</Text>
                      <TouchableOpacity 
                        onPress={() => addToCart(item)}
                        className="p-2"
                      >
                        <Plus size={18} color="#4F46E5" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      onPress={() => addToCart(item)}
                      className="bg-primary px-4 py-2 rounded-lg flex-row items-center"
                    >
                      <Plus size={16} color="#fff" />
                      <Text className="text-white font-medium ml-1">Add</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <Text className="text-red-500 font-medium">Unavailable</Text>
                )}
              </View>
            </View>
          </View>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Loading menu...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft size={24} color="#333" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-foreground ml-2">Restaurant</Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push('/restaurant/cart')}
            className="relative p-2"
          >
            <ShoppingCart size={24} color="#333" />
            {totalItems > 0 && (
              <View className="absolute -top-1 -right-1 bg-primary w-5 h-5 rounded-full items-center justify-center">
                <Text className="text-white text-xs font-bold">{totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="px-4 py-3">
          <Input
            placeholder="Search menu..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Search size={20} color="#6B7280" />}
          />
        </View>

        {/* Categories */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="px-4 pb-3"
          contentContainerStyle={{ paddingRight: 16 }}
        >
          <TouchableOpacity
            onPress={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full mr-2 ${
              !selectedCategory 
                ? 'bg-primary' 
                : 'bg-muted border border-border'
            }`}
          >
            <Text className={`font-medium ${
              !selectedCategory ? 'text-white' : 'text-foreground'
            }`}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map(renderCategoryChip)}
        </ScrollView>

        {error && (
          <View className="mx-4 mb-4 bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
            <Text className="text-destructive text-center text-sm">{error}</Text>
          </View>
        )}

        {/* Menu Items */}
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderMenuItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center py-12">
              <Search size={48} color="#9CA3AF" />
              <Text className="text-muted-foreground mt-4 text-center">
                No menu items found
              </Text>
            </View>
          }
        />

        {/* Cart Footer */}
        {totalItems > 0 && (
          <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-border p-4">
            <TouchableOpacity 
              onPress={() => router.push('/restaurant/cart')}
              className="bg-primary rounded-lg p-4 flex-row items-center justify-between"
            >
              <View className="flex-row items-center">
                <View className="bg-white/20 w-8 h-8 rounded-full items-center justify-center">
                  <Text className="text-white font-bold">{totalItems}</Text>
                </View>
                <Text className="text-white font-semibold ml-3">View Cart</Text>
              </View>
              <Text className="text-white font-bold text-lg">${totalPrice.toFixed(2)}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
