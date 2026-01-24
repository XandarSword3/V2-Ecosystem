/**
 * Pool Area Details Screen
 */
import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { poolApi } from '@/api/client'; // Assuming getArea(id) exists or we filter from getAreas
import { Button } from '@/components/ui/Button';
import { API_BASE_URL } from '@/config/env';
import { ChevronLeft, Users, Droplets } from 'lucide-react-native';

const getImageUrl = (path?: string) => {
    if (!path) return 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800';
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}${path}`;
};

export default function PoolAreaScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    // Optimization: In a real app we might have a specific endpoint, 
    // here we reuse getAreas and find the one we like for simplicity/MVP
    const { data: areasData } = useQuery({
        queryKey: ['pool-areas'],
        queryFn: () => poolApi.getAreas(),
    });

    const area = areasData?.data?.find((a: any) => a.id === id);

    if (!area) return <View className="bg-background flex-1" />;

    return (
        <View className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView className="flex-1 mb-20">
                <Image
                    source={{ uri: getImageUrl(area.image) }}
                    className="w-full h-64"
                    resizeMode="cover"
                />
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="absolute top-12 left-4 w-10 h-10 bg-black/30 rounded-full items-center justify-center"
                >
                    <ChevronLeft size={24} color="white" />
                </TouchableOpacity>

                <View className="p-6">
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-2xl font-bold text-foreground flex-1">{area.name}</Text>
                        {area.isOpen ? (
                            <View className="bg-green-100 px-3 py-1 rounded-full">
                                <Text className="text-green-700 font-bold text-xs">OPEN</Text>
                            </View>
                        ) : (
                            <View className="bg-red-100 px-3 py-1 rounded-full">
                                <Text className="text-red-700 font-bold text-xs">CLOSED</Text>
                            </View>
                        )}
                    </View>

                    <Text className="text-muted-foreground leading-6 mb-6">
                        {area.description || 'Enjoy our premium pool facilities.'}
                    </Text>

                    <View className="flex-row gap-4 mb-6">
                        <View className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl flex-1 items-center">
                            <Users size={24} color="#3b82f6" />
                            <Text className="text-blue-700 dark:text-blue-300 font-bold mt-2">{area.capacity}</Text>
                            <Text className="text-blue-600 dark:text-blue-400 text-xs">Max Capacity</Text>
                        </View>
                        <View className="bg-cyan-50 dark:bg-cyan-900/10 p-4 rounded-xl flex-1 items-center">
                            <Droplets size={24} color="#06b6d4" />
                            <Text className="text-cyan-700 dark:text-cyan-300 font-bold mt-2">{area.currentOccupancy}</Text>
                            <Text className="text-cyan-600 dark:text-cyan-400 text-xs">Current Guests</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View className="p-6 border-t border-border absolute bottom-0 left-0 right-0 bg-background">
                <Button
                    title="Book Session"
                    onPress={() => router.push(`/pool/book?areaId=${area.id}&date=${new Date().toISOString().split('T')[0]}`)}
                    disabled={!area.isOpen}
                />
            </View>
        </View>
    );
}
