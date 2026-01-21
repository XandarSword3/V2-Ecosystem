/**
 * Chalets Screen
 * Fetches real chalet data from backend API - mirrors website functionality
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { chaletsApi, modulesApi } from '../../src/api/client';
import { useAuthStore } from '../../src/store/auth';
import { API_BASE_URL } from '../../src/config/env';
import { 
  BedDouble, Users, Bath, Wifi, Car, Coffee, 
  AlertCircle, RefreshCw, Star, Check, Calendar 
} from 'lucide-react-native';

// Helper to get full image URL
const getImageUrl = (path?: string) => {
  if (!path) return 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800';
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
};

// Amenity icon mapping
const getAmenityIcon = (amenity: string) => {
  const lower = amenity.toLowerCase();
  if (lower.includes('wifi') || lower.includes('internet')) return Wifi;
  if (lower.includes('parking') || lower.includes('car')) return Car;
  if (lower.includes('coffee') || lower.includes('kitchen')) return Coffee;
  if (lower.includes('bed')) return BedDouble;
  if (lower.includes('bath')) return Bath;
  return Check;
};

export default function ChaletsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  // Fetch chalets modules
  const {
    data: modulesData,
  } = useQuery({
    queryKey: ['chalets-modules'],
    queryFn: () => modulesApi.getModules('chalets'),
  });

  const chaletsModule = modulesData?.data?.[0];

  // Fetch chalets
  const {
    data: chaletsData,
    isLoading: chaletsLoading,
    error: chaletsError,
    refetch: refetchChalets,
    isRefetching,
  } = useQuery({
    queryKey: ['chalets', chaletsModule?.id],
    queryFn: () => chaletsApi.getChalets(chaletsModule?.id),
  });

  // Fetch user's bookings if logged in
  const {
    data: bookingsData,
    isLoading: bookingsLoading,
  } = useQuery({
    queryKey: ['my-chalet-bookings'],
    queryFn: () => chaletsApi.getMyBookings(),
    enabled: !!user,
  });

  const chalets = chaletsData?.data || [];
  const myBookings = bookingsData?.data || [];

  // Get active booking (currently checked in)
  const activeBooking = myBookings.find(b => 
    b.status === 'confirmed' || b.status === 'checked_in'
  );

  const handleChaletPress = (chaletId: string) => {
    router.push(`/chalets/${chaletId}` as any);
  };

  const handleBookPress = (chaletId: string) => {
    router.push(`/chalets/book/${chaletId}` as any);
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchChalets} />
        }
      >
        {/* Header */}
        <View className="px-6 py-4 bg-background border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Chalets</Text>
          <Text className="text-muted-foreground">Find your perfect getaway</Text>
        </View>

        {/* Active Booking Banner */}
        {activeBooking && (
          <View className="px-6 mt-4">
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="p-4 flex-row items-start">
                <View className="bg-primary/20 p-2 rounded-lg mr-3">
                  <BedDouble size={24} color="#0ea5e9" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-foreground">Current Stay</Text>
                  <Text className="text-muted-foreground text-sm">
                    {activeBooking.chalet.name}
                  </Text>
                  <Text className="text-muted-foreground text-sm">
                    Check-out: {new Date(activeBooking.checkOutDate).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push(`/chalets/booking/${activeBooking.id}` as any)}
                >
                  <Text className="text-primary font-semibold">View</Text>
                </TouchableOpacity>
              </CardContent>
            </Card>
          </View>
        )}

        {/* Error State */}
        {chaletsError && (
          <View className="px-6 mt-4">
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200">
              <CardContent className="p-4 flex-row items-center">
                <AlertCircle size={20} color="#ef4444" />
                <Text className="text-red-600 dark:text-red-400 ml-2 flex-1">
                  Failed to load chalets.
                </Text>
                <TouchableOpacity onPress={() => refetchChalets()}>
                  <RefreshCw size={20} color="#ef4444" />
                </TouchableOpacity>
              </CardContent>
            </Card>
          </View>
        )}

        {/* Chalets List */}
        <View className="px-6 mt-4">
          <Text className="text-lg font-semibold mb-3 text-foreground">
            Available Chalets
          </Text>

          {chaletsLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#0ea5e9" />
              <Text className="text-muted-foreground mt-3">Loading chalets...</Text>
            </View>
          ) : chalets.length > 0 ? (
            chalets.map((chalet) => (
              <TouchableOpacity
                key={chalet.id}
                activeOpacity={0.9}
                onPress={() => handleChaletPress(chalet.id)}
              >
                <Card className="mb-4 overflow-hidden border-0 shadow-sm bg-card">
                  {/* Chalet Image */}
                  <Image
                    source={{ uri: getImageUrl(chalet.images?.[0]) }}
                    className="h-48 w-full"
                    resizeMode="cover"
                  />
                  
                  {/* Availability Badge */}
                  <View className="absolute top-3 right-3">
                    <View className={`px-2 py-1 rounded ${
                      chalet.isAvailable 
                        ? 'bg-green-500/90' 
                        : 'bg-red-500/90'
                    }`}>
                      <Text className="text-xs font-bold text-white">
                        {chalet.isAvailable ? 'Available' : 'Booked'}
                      </Text>
                    </View>
                  </View>

                  <CardContent className="p-4">
                    {/* Title & Price */}
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1">
                        <Text className="text-lg font-bold text-foreground">
                          {chalet.name}
                        </Text>
                        {chalet.description && (
                          <Text className="text-sm text-muted-foreground mt-1" numberOfLines={2}>
                            {chalet.description}
                          </Text>
                        )}
                      </View>
                      <View className="items-end ml-3">
                        <Text className="text-lg font-bold text-primary">
                          ${chalet.basePrice}
                        </Text>
                        <Text className="text-xs text-muted-foreground">/night</Text>
                      </View>
                    </View>

                    {/* Features */}
                    <View className="flex-row flex-wrap mt-2 mb-3">
                      <View className="flex-row items-center mr-4 mb-1">
                        <Users size={14} color="#6B7280" />
                        <Text className="text-sm text-muted-foreground ml-1">
                          Up to {chalet.maxGuests} guests
                        </Text>
                      </View>
                      <View className="flex-row items-center mr-4 mb-1">
                        <BedDouble size={14} color="#6B7280" />
                        <Text className="text-sm text-muted-foreground ml-1">
                          {chalet.bedrooms} bedroom{chalet.bedrooms !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View className="flex-row items-center mb-1">
                        <Bath size={14} color="#6B7280" />
                        <Text className="text-sm text-muted-foreground ml-1">
                          {chalet.bathrooms} bath{chalet.bathrooms !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Amenities */}
                    {chalet.amenities && chalet.amenities.length > 0 && (
                      <View className="flex-row flex-wrap mb-3">
                        {chalet.amenities.slice(0, 4).map((amenity, index) => {
                          const IconComponent = getAmenityIcon(amenity);
                          return (
                            <View 
                              key={index} 
                              className="flex-row items-center bg-muted/50 rounded-full px-2 py-1 mr-2 mb-1"
                            >
                              <IconComponent size={12} color="#6B7280" />
                              <Text className="text-xs text-muted-foreground ml-1">
                                {amenity}
                              </Text>
                            </View>
                          );
                        })}
                        {chalet.amenities.length > 4 && (
                          <View className="bg-muted/50 rounded-full px-2 py-1">
                            <Text className="text-xs text-muted-foreground">
                              +{chalet.amenities.length - 4} more
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Book Button */}
                    <Button
                      className="w-full"
                      disabled={!chalet.isAvailable}
                      onPress={() => handleBookPress(chalet.id)}
                    >
                      <Calendar size={16} color="white" />
                      <Text className="text-white font-semibold ml-2">
                        {chalet.isAvailable ? 'Check Availability' : 'Not Available'}
                      </Text>
                    </Button>
                  </CardContent>
                </Card>
              </TouchableOpacity>
            ))
          ) : (
            <Card className="bg-muted/30">
              <CardContent className="p-6 items-center">
                <BedDouble size={48} color="#94a3b8" />
                <Text className="text-lg font-semibold text-foreground mt-4">
                  No chalets available
                </Text>
                <Text className="text-muted-foreground text-center mt-2">
                  Check back later for available accommodations
                </Text>
                <TouchableOpacity
                  onPress={() => refetchChalets()}
                  className="flex-row items-center mt-4"
                >
                  <RefreshCw size={16} color="#0ea5e9" />
                  <Text className="text-primary ml-2">Refresh</Text>
                </TouchableOpacity>
              </CardContent>
            </Card>
          )}
        </View>

        {/* My Bookings Section */}
        {user && myBookings.length > 0 && (
          <View className="px-6 mt-6">
            <Text className="text-lg font-semibold mb-3 text-foreground">
              Your Reservations
            </Text>
            {myBookings.slice(0, 3).map((booking) => (
              <TouchableOpacity
                key={booking.id}
                onPress={() => router.push(`/chalets/booking/${booking.id}` as any)}
              >
                <Card className="mb-3 bg-card">
                  <CardContent className="p-4 flex-row items-center">
                    <Image
                      source={{ uri: getImageUrl(booking.chalet.images?.[0]) }}
                      className="w-16 h-16 rounded-lg"
                      resizeMode="cover"
                    />
                    <View className="flex-1 ml-3">
                      <Text className="font-semibold text-foreground">
                        {booking.chalet.name}
                      </Text>
                      <Text className="text-sm text-muted-foreground">
                        {new Date(booking.checkInDate).toLocaleDateString()} - {new Date(booking.checkOutDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <View className={`px-2 py-1 rounded ${
                      booking.status === 'confirmed' ? 'bg-green-100 dark:bg-green-900/30' :
                      booking.status === 'checked_in' ? 'bg-blue-100 dark:bg-blue-900/30' :
                      'bg-muted'
                    }`}>
                      <Text className={`text-xs font-medium ${
                        booking.status === 'confirmed' ? 'text-green-700 dark:text-green-400' :
                        booking.status === 'checked_in' ? 'text-blue-700 dark:text-blue-400' :
                        'text-muted-foreground'
                      }`}>
                        {booking.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </CardContent>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
