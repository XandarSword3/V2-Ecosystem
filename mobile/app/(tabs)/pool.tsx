/**
 * Pool Screen
 * Fetches real pool data from backend API - mirrors website functionality
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { poolApi, modulesApi } from '../../src/api/client';
import { API_BASE_URL } from '../../src/config/env';
import { Waves, ThermometerSun, Umbrella, Clock, Users, AlertCircle, Calendar, RefreshCw } from 'lucide-react-native';

// Helper to get full image URL
const getImageUrl = (path?: string) => {
  if (!path) return 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800';
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
};

export default function PoolScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch pool modules
  const {
    data: modulesData,
  } = useQuery({
    queryKey: ['pool-modules'],
    queryFn: () => modulesApi.getModules('pool'),
  });

  const poolModule = modulesData?.data?.[0];

  // Fetch pool areas
  const {
    data: areasData,
    isLoading: areasLoading,
    error: areasError,
    refetch: refetchAreas,
    isRefetching: areasRefetching,
  } = useQuery({
    queryKey: ['pool-areas'],
    queryFn: () => poolApi.getAreas(),
  });

  // Fetch pool info
  const {
    data: infoData,
    isLoading: infoLoading,
  } = useQuery({
    queryKey: ['pool-info'],
    queryFn: () => poolApi.getInfo(),
  });

  // Fetch availability for selected date
  const {
    data: availabilityData,
    isLoading: availabilityLoading,
  } = useQuery({
    queryKey: ['pool-availability', selectedDate],
    queryFn: () => poolApi.getAvailability(selectedDate),
    enabled: !!selectedDate,
  });

  const poolAreas = areasData?.data || [];
  const poolInfo = infoData?.data;
  const availability = availabilityData?.data || [];

  const isLoading = areasLoading || infoLoading;

  const handleBookSlot = (slotId: string) => {
    router.push(`/pool/book?slotId=${slotId}&date=${selectedDate}` as any);
  };

  const getOccupancyColor = (current: number, max: number) => {
    const ratio = current / max;
    if (ratio < 0.5) return 'text-green-600 dark:text-green-400';
    if (ratio < 0.8) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getOccupancyLabel = (current: number, max: number) => {
    const ratio = current / max;
    if (ratio < 0.5) return 'Low';
    if (ratio < 0.8) return 'Moderate';
    return 'High';
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={areasRefetching} onRefresh={refetchAreas} />
        }
      >
        {/* Header */}
        <View className="p-6 pb-2">
          <Text className="text-2xl font-bold text-foreground mb-2">Pools & Wellness</Text>
          <Text className="text-muted-foreground">
            {poolInfo?.description || 'Relax by the water or book a session.'}
          </Text>
        </View>

        {/* Quick Stats */}
        <View className="px-6 mb-6 flex-row">
          <View className="flex-1 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mr-2 items-center">
            <ThermometerSun size={24} color="#3b82f6" />
            <Text className="font-bold text-blue-700 dark:text-blue-300 mt-2">28°C</Text>
            <Text className="text-xs text-blue-600 dark:text-blue-400">Water Avg</Text>
          </View>
          <View className="flex-1 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl ml-2 items-center">
            <Umbrella size={24} color="#f97316" />
            <Text className="font-bold text-orange-700 dark:text-orange-300 mt-2">UV High</Text>
            <Text className="text-xs text-orange-600 dark:text-orange-400">Wear SPF</Text>
          </View>
        </View>

        {/* Error State */}
        {areasError && (
          <View className="px-6 mb-4">
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200">
              <CardContent className="p-4 flex-row items-center">
                <AlertCircle size={20} color="#ef4444" />
                <Text className="text-red-600 dark:text-red-400 ml-2 flex-1">
                  Failed to load pool areas.
                </Text>
                <TouchableOpacity onPress={() => refetchAreas()}>
                  <RefreshCw size={20} color="#ef4444" />
                </TouchableOpacity>
              </CardContent>
            </Card>
          </View>
        )}

        {/* Pool Areas */}
        <View className="px-6 mb-4">
          <Text className="text-lg font-semibold mb-3 text-foreground">Pool Areas</Text>

          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#0ea5e9" />
              <Text className="text-muted-foreground mt-3">Loading pool areas...</Text>
            </View>
          ) : poolAreas.length > 0 ? (
            poolAreas.map((pool) => (
              <Card key={pool.id} className="mb-4 overflow-hidden border-0 shadow-sm bg-card">
                <Image
                  source={{ uri: getImageUrl(pool.image) }}
                  className="h-40 w-full"
                  resizeMode="cover"
                />
                <View className="absolute top-3 left-3 right-3 flex-row justify-between">
                  <View className={`px-2 py-1 rounded ${
                    pool.isOpen 
                      ? 'bg-green-500/90' 
                      : 'bg-red-500/90'
                  }`}>
                    <Text className="text-xs font-bold text-white">
                      {pool.isOpen ? 'Open' : 'Closed'}
                    </Text>
                  </View>
                </View>
                <CardContent className="p-4">
                  <Text className="text-lg font-bold text-foreground mb-1">{pool.name}</Text>
                  {pool.description && (
                    <Text className="text-sm text-muted-foreground mb-2" numberOfLines={2}>
                      {pool.description}
                    </Text>
                  )}
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Users size={16} color="#6B7280" />
                      <Text className={`ml-1 text-sm font-medium ${getOccupancyColor(pool.currentOccupancy, pool.capacity)}`}>
                        {getOccupancyLabel(pool.currentOccupancy, pool.capacity)} ({pool.currentOccupancy}/{pool.capacity})
                      </Text>
                    </View>
                    <Button
                      size="sm"
                      variant={pool.isOpen ? 'primary' : 'outline'}
                      disabled={!pool.isOpen}
                      onPress={() => router.push(`/pool/area/${pool.id}` as any)}
                    >
                      <Text className={pool.isOpen ? 'text-white' : 'text-muted-foreground'}>
                        {pool.isOpen ? 'View Details' : 'Closed'}
                      </Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-muted/30">
              <CardContent className="p-6 items-center">
                <Waves size={40} color="#94a3b8" />
                <Text className="text-lg font-semibold text-foreground mt-3 mb-1">
                  No pool areas available
                </Text>
                <Text className="text-muted-foreground text-center">
                  Check back later for pool information
                </Text>
              </CardContent>
            </Card>
          )}
        </View>

        {/* Available Sessions */}
        {availability.length > 0 && (
          <View className="px-6 mb-4">
            <Text className="text-lg font-semibold mb-3 text-foreground">Available Sessions</Text>
            {availability.map((slot) => (
              <Card key={slot.id} className="mb-3 bg-card">
                <CardContent className="p-4 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Clock size={20} color="#6B7280" />
                    <View className="ml-3">
                      <Text className="font-semibold text-foreground">
                        {slot.startTime} - {slot.endTime}
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        {slot.spotsAvailable} spots left • ${slot.price.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <Button
                    size="sm"
                    disabled={!slot.available}
                    onPress={() => handleBookSlot(slot.id)}
                  >
                    <Text className="text-white">Book</Text>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        {/* Cabana Promo */}
        <View className="px-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 items-center text-center">
              <Text className="text-lg font-bold text-primary mb-2">Private Cabana?</Text>
              <Text className="text-center text-muted-foreground mb-4">
                Book a private cabana with dedicated service for the ultimate day.
              </Text>
              <Button className="w-full" onPress={() => router.push('/pool/cabanas' as any)}>
                <Text className="text-white font-semibold">Check Availability</Text>
              </Button>
            </CardContent>
          </Card>
        </View>

        {/* Pool Rules */}
        {poolInfo?.rules && poolInfo.rules.length > 0 && (
          <View className="px-6 mt-6">
            <Text className="text-lg font-semibold mb-3 text-foreground">Pool Rules</Text>
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                {poolInfo.rules.map((rule, index) => (
                  <Text key={index} className="text-sm text-muted-foreground mb-1">
                    • {rule}
                  </Text>
                ))}
              </CardContent>
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
