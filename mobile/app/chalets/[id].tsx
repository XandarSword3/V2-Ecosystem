/**
 * Chalet Details Screen
 */
import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { chaletsApi } from '../../src/api/client';
import { Button } from '../../src/components/ui/Button';
import { API_BASE_URL } from '../../src/config/env';
import {
    BedDouble, Users, Bath, Wifi, Car, Coffee,
    MapPin, Clock, Calendar, ChevronLeft, Share2, Heart
} from 'lucide-react-native';

const getImageUrl = (path?: string) => {
    if (!path) return 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800';
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}${path}`;
};

const getAmenityIcon = (amenity: string) => {
    const lower = amenity.toLowerCase();
    if (lower.includes('wifi') || lower.includes('internet')) return Wifi;
    if (lower.includes('parking') || lower.includes('car')) return Car;
    if (lower.includes('coffee') || lower.includes('kitchen')) return Coffee;
    if (lower.includes('bed')) return BedDouble;
    if (lower.includes('bath')) return Bath;
    return Clock; // Default
};

export default function ChaletDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const { data: chaletData, isLoading, error } = useQuery({
        queryKey: ['chalet', id],
        queryFn: () => chaletsApi.getChalet(id as string),
        enabled: !!id,
    });

    const chalet = chaletData?.data;

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" color="#0ea5e9" />
            </View>
        );
    }

    if (error || !chalet) {
        return (
            <View className="flex-1 items-center justify-center bg-background p-6">
                <Text className="text-destructive text-lg font-semibold mb-2">Error loading details</Text>
                <Button title="Go Back" onPress={() => router.back()} variant="outline" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView className="flex-1 mb-20">
                {/* Header Image */}
                <View className="relative h-72">
                    <Image
                        source={{ uri: getImageUrl(chalet.images?.[0]) }}
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
                        <View className="flex-row gap-2">
                            <TouchableOpacity className="w-10 h-10 bg-black/30 rounded-full items-center justify-center">
                                <Share2 size={20} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity className="w-10 h-10 bg-black/30 rounded-full items-center justify-center">
                                <Heart size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View className="p-6 -mt-6 bg-background rounded-t-3xl">
                    {/* Title Section */}
                    <View className="flex-row justify-between items-start mb-4">
                        <View className="flex-1 mr-4">
                            <Text className="text-2xl font-bold text-foreground mb-1">{chalet.name}</Text>
                            <View className="flex-row items-center">
                                <MapPin size={16} color="#64748b" />
                                <Text className="text-muted-foreground ml-1">Premium Zone</Text>
                            </View>
                        </View>
                        <View className="items-end">
                            <Text className="text-2xl font-bold text-primary">${chalet.basePrice}</Text>
                            <Text className="text-muted-foreground text-xs">per night</Text>
                        </View>
                    </View>

                    {/* Quick Stats */}
                    <View className="flex-row justify-between bg-muted/30 p-4 rounded-2xl mb-6">
                        <View className="items-center">
                            <Users size={20} color="#64748b" />
                            <Text className="text-xs text-muted-foreground mt-1">{chalet.maxGuests} Guests</Text>
                        </View>
                        <View className="w-[1px] bg-border" />
                        <View className="items-center">
                            <BedDouble size={20} color="#64748b" />
                            <Text className="text-xs text-muted-foreground mt-1">{chalet.bedrooms} Bedrooms</Text>
                        </View>
                        <View className="w-[1px] bg-border" />
                        <View className="items-center">
                            <Bath size={20} color="#64748b" />
                            <Text className="text-xs text-muted-foreground mt-1">{chalet.bathrooms} Baths</Text>
                        </View>
                    </View>

                    {/* Description */}
                    <Text className="text-lg font-semibold text-foreground mb-2">About this stay</Text>
                    <Text className="text-muted-foreground leading-6 mb-6">
                        {chalet.description || "Experience luxury living in our premium chalets. Perfect for families looking for a relaxing getaway with all modern amenities."}
                    </Text>

                    {/* Amenities */}
                    <Text className="text-lg font-semibold text-foreground mb-3">Amenities</Text>
                    <View className="flex-row flex-wrap gap-3 mb-6">
                        {chalet.amenities?.map((amenity, index) => {
                            const Icon = getAmenityIcon(amenity);
                            return (
                                <View key={index} className="flex-row items-center bg-muted/50 px-3 py-2 rounded-xl">
                                    <Icon size={16} color="#64748b" />
                                    <Text className="text-foreground ml-2 capitalize">{amenity}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-6 shadow-lg">
                <View className="flex-row items-center justify-between gap-4">
                    <View>
                        <Text className="text-muted-foreground text-xs">Total Price</Text>
                        <Text className="text-xl font-bold text-foreground">${chalet.basePrice} <Text className="text-sm font-normal text-muted-foreground">/ night</Text></Text>
                    </View>
                    <Button
                        className="flex-1 h-12"
                        onPress={() => router.push(`/chalets/book/${id}`)}
                        disabled={!chalet.isAvailable}
                    >
                        <Text className="text-white font-semibold text-lg">
                            {chalet.isAvailable ? 'Check Availability' : 'Sold Out'}
                        </Text>
                    </Button>
                </View>
            </View>
        </View>
    );
}
