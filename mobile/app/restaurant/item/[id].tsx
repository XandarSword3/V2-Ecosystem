/**
 * Restaurant Item Details Screen
 * View item details, options, and add to cart
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { restaurantApi } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { API_BASE_URL } from '@/config/env';
import { ChevronLeft, Plus, Minus, Clock, Flame, Info } from 'lucide-react-native';

const getImageUrl = (path?: string) => {
    if (!path) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800';
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}${path}`;
};

export default function ItemDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');

    // We need to fetch the item details. 
    // Since the API doesn't have a direct "get item" endpoint (it uses getMenu),
    // we'll fetch the menu and find the item, or assume we passed data (but deep linking needs fetch).
    // Ideally, the backend should hava a GET /restaurant/items/:id.
    // For now, we'll refetch the menu (cached) and find it.

    const { data: menuData, isLoading } = useQuery({
        queryKey: ['restaurant-menu-all'],
        queryFn: () => restaurantApi.getMenu(), // Fetch all to find the item
    });

    const rawData = menuData?.data;
    const menuItems: any[] = Array.isArray(rawData) ? rawData : ((rawData as any)?.items || []);
    const item = menuItems.find((i: any) => i.id === id);

    const addToCartMutation = useMutation({
        mutationFn: (data: any) => restaurantApi.addToCart(data),
        onSuccess: () => {
            Alert.alert('Added to Cart', `${item.name} has been added to your cart.`, [
                { text: 'Keep Browsing', onPress: () => router.back() },
                { text: 'View Cart', onPress: () => router.push('/restaurant/cart') }
            ]);
        },
        onError: (err: any) => {
            Alert.alert('Error', 'Failed to add item to cart');
        }
    });

    const handleAddToCart = () => {
        addToCartMutation.mutate({
            menuItemId: id,
            quantity,
            specialInstructions: notes
        });
    };

    const increment = () => setQuantity(q => q + 1);
    const decrement = () => setQuantity(q => (q > 1 ? q - 1 : 1));

    if (isLoading) {
        return <View className="flex-1 bg-background" />;
    }

    if (!item) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <Text className="text-foreground">Item not found</Text>
                <Button title="Go Back" onPress={() => router.back()} variant="outline" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView className="flex-1 mb-24">
                {/* Header Image */}
                <View className="relative h-80">
                    <Image
                        source={{ uri: getImageUrl(item.imageUrl) }}
                        className="w-full h-full"
                        resizeMode="cover"
                    />
                    <View className="absolute top-0 left-0 right-0 p-4 pt-12 flex-row justify-between">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 bg-black/30 rounded-full items-center justify-center"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="p-6 -mt-8 bg-background rounded-t-3xl min-h-screen">
                    <View className="flex-row justify-between items-start mb-2">
                        <Text className="text-2xl font-bold text-foreground flex-1 mr-4">{item.name}</Text>
                        <Text className="text-2xl font-bold text-primary">${item.price.toFixed(2)}</Text>
                    </View>

                    {/* Tags */}
                    <View className="flex-row flex-wrap gap-2 mb-6">
                        <View className="flex-row items-center bg-muted/50 px-2 py-1 rounded-md">
                            <Clock size={14} color="#64748b" />
                            <Text className="text-muted-foreground text-xs ml-1">{item.preparationTime || 15} min</Text>
                        </View>
                        {item.spicyLevel > 0 && (
                            <View className="flex-row items-center bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-md">
                                <Flame size={14} color="#ef4444" />
                                <Text className="text-red-700 dark:text-red-400 text-xs ml-1">Spicy</Text>
                            </View>
                        )}
                        {item.popular && (
                            <View className="flex-row items-center bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-md">
                                <Text className="text-orange-700 dark:text-orange-400 text-xs font-medium">Popular</Text>
                            </View>
                        )}
                    </View>

                    <Text className="text-muted-foreground text-lg mb-6 leading-6">
                        {item.description || "A delicious choice from our chef's special menu."}
                    </Text>

                    {/* Special Instructions */}
                    <Text className="font-semibold text-foreground mb-2">Special Instructions</Text>
                    <Input
                        placeholder="E.g., No onions, sauce on side..."
                        multiline
                        numberOfLines={3}
                        value={notes}
                        onChangeText={setNotes}
                        className="mb-6"
                    />

                    {/* Allergens Info */}
                    {item.allergens && item.allergens.length > 0 && (
                        <View className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl flex-row items-start mb-6">
                            <Info size={16} color="#3b82f6" className="mt-0.5" />
                            <View className="ml-2">
                                <Text className="text-blue-700 dark:text-blue-300 font-medium text-xs">Contains allergens:</Text>
                                <Text className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                                    {item.allergens.join(', ')}
                                </Text>
                            </View>
                        </View>
                    )}

                </View>
            </ScrollView>

            {/* Sticky Bottom Bar */}
            <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-8 shadow-lg">
                <View className="flex-row items-center gap-4">
                    {/* Quantity Selector */}
                    <View className="flex-row items-center bg-muted rounded-xl h-14 px-4">
                        <TouchableOpacity onPress={decrement} className="p-2">
                            <Minus size={20} color={quantity > 1 ? "#0f172a" : "#94a3b8"} />
                        </TouchableOpacity>
                        <Text className="text-xl font-bold text-foreground mx-4 w-6 text-center">{quantity}</Text>
                        <TouchableOpacity onPress={increment} className="p-2">
                            <Plus size={20} color="#0f172a" />
                        </TouchableOpacity>
                    </View>

                    {/* Add Button */}
                    <Button
                        className="flex-1 h-14"
                        onPress={handleAddToCart}
                        isLoading={addToCartMutation.isPending}
                    >
                        <Text className="text-white font-bold text-lg">
                            Add ${(item.price * quantity).toFixed(2)}
                        </Text>
                    </Button>
                </View>
            </View>
        </View>
    );
}
