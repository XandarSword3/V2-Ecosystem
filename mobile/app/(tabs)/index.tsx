/**
 * Home Screen
 * Fetches real data from backend API - mirrors website functionality
 */

import React from 'react';
import { View, Text, ScrollView, ImageBackground, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../src/store/auth';
import { bookingsApi, modulesApi } from '../../src/api/client';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { UtensilsCrossed, Waves, BedDouble, Calendar, Bell, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';
import { API_BASE_URL } from '../../src/config/env';

// Default hero image if none from API
const DEFAULT_HERO = 'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=2070&auto=format&fit=crop';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();

  // Fetch user's bookings
  const { 
    data: bookingsData, 
    isLoading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings 
  } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingsApi.getMyBookings(),
    enabled: !!user,
  });

  // Fetch available modules
  const { 
    data: modulesData, 
    isLoading: modulesLoading,
    error: modulesError,
    refetch: refetchModules 
  } = useQuery({
    queryKey: ['modules'],
    queryFn: () => modulesApi.getModules(),
  });

  const bookings = bookingsData?.data || [];
  const modules = modulesData?.data || [];

  // Build quick actions from available modules
  const getQuickActions = () => {
    const actions: Array<{
      label: string;
      icon: any;
      route: string;
      color: string;
      iconColor: string;
    }> = [];

    // Check if restaurant module exists
    const hasRestaurant = modules.some(m => m.type === 'restaurant' && m.isActive);
    if (hasRestaurant) {
      actions.push({
        label: 'Dining',
        icon: UtensilsCrossed,
        route: '/(tabs)/restaurant',
        color: 'bg-orange-100 dark:bg-orange-900/20',
        iconColor: '#f97316'
      });
    }

    // Check if pool module exists
    const hasPool = modules.some(m => m.type === 'pool' && m.isActive);
    if (hasPool) {
      actions.push({
        label: 'Pool',
        icon: Waves,
        route: '/(tabs)/pool',
        color: 'bg-blue-100 dark:bg-blue-900/20',
        iconColor: '#3b82f6'
      });
    }

    // Check if chalets module exists
    const hasChalets = modules.some(m => m.type === 'chalets' && m.isActive);
    if (hasChalets) {
      actions.push({
        label: 'Chalets',
        icon: BedDouble,
        route: '/(tabs)/chalets',
        color: 'bg-purple-100 dark:bg-purple-900/20',
        iconColor: '#a855f7'
      });
    }

    // Always show My Stay
    actions.push({
      label: 'My Stay',
      icon: Calendar,
      route: '/(tabs)/account',
      color: 'bg-emerald-100 dark:bg-emerald-900/20',
      iconColor: '#10b981'
    });

    return actions;
  };

  const quickActions = getQuickActions();

  // Get upcoming bookings
  const upcomingBookings = bookings
    .filter(b => b.status !== 'cancelled' && b.status !== 'checked_out')
    .slice(0, 3);

  const isLoading = bookingsLoading || modulesLoading;
  const hasError = bookingsError || modulesError;

  const handleRefresh = () => {
    refetchBookings();
    refetchModules();
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <ImageBackground
          source={{ uri: DEFAULT_HERO }}
          className="h-80 w-full justify-end"
          resizeMode="cover"
        >
          <View className="absolute inset-0 bg-black/30" />
          <View className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          
          <SafeAreaView edges={['top']} className="flex-1 justify-between p-6">
            <View className="flex-row justify-between items-center">
              <View className="bg-background/20 rounded-full px-4 py-1">
                <Text className="text-white font-medium text-xs tracking-wider uppercase">
                  V2 Resort & Spa
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/account')}
                className="bg-background/20 p-2 rounded-full"
              >
                <Bell size={20} color="white" />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-white/80 text-lg font-medium mb-1">
                Welcome back,
              </Text>
              <Text className="text-white text-4xl font-bold tracking-tight">
                {user?.firstName ?? 'Guest'}
              </Text>
            </View>
          </SafeAreaView>
        </ImageBackground>

        {/* Content Section */}
        <View className="px-6 -mt-6">
          {/* Error State */}
          {hasError && (
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 mb-4">
              <CardContent className="p-4 flex-row items-center">
                <AlertCircle size={20} color="#ef4444" />
                <Text className="text-red-600 dark:text-red-400 ml-2 flex-1">
                  Failed to load data. Check your connection.
                </Text>
                <TouchableOpacity onPress={handleRefresh}>
                  <RefreshCw size={20} color="#ef4444" />
                </TouchableOpacity>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card className="bg-card dark:bg-card border-border shadow-lg mb-8">
            <CardContent className="p-4 flex-row flex-wrap justify-between">
              {isLoading ? (
                <View className="w-full items-center py-8">
                  <ActivityIndicator size="large" color="#0ea5e9" />
                  <Text className="text-muted-foreground mt-2">Loading...</Text>
                </View>
              ) : quickActions.length > 0 ? (
                quickActions.map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => router.push(action.route as any)}
                    activeOpacity={0.7}
                    style={{ width: '45%' }}
                    className="items-center justify-center p-4 mb-4 rounded-xl bg-muted/50"
                  >
                    <View className={`p-4 rounded-full mb-3 ${action.color}`}>
                      <action.icon size={28} color={action.iconColor} />
                    </View>
                    <Text className="font-medium text-foreground text-center">
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View className="w-full items-center py-4">
                  <Text className="text-muted-foreground">No modules available</Text>
                </View>
              )}
            </CardContent>
          </Card>

          {/* Bookings Section */}
          <View className="flex-row justify-between items-end mb-4">
            <Text className="text-xl font-bold text-foreground">
              {user ? 'Your Bookings' : 'Getting Started'}
            </Text>
            {user && bookings.length > 0 && (
              <Link href="/(tabs)/account" asChild>
                <TouchableOpacity className="flex-row items-center">
                  <Text className="text-primary mr-1">View All</Text>
                  <ArrowRight size={16} color="#0ea5e9" />
                </TouchableOpacity>
              </Link>
            )}
          </View>

          {/* Bookings List or Login Prompt */}
          {!user ? (
            <Card className="mb-4 bg-primary/5 border-primary/20">
              <CardContent className="p-4 items-center">
                <Text className="text-lg font-semibold text-foreground mb-2">
                  Sign in to see your bookings
                </Text>
                <Text className="text-muted-foreground text-center mb-4">
                  Access your reservations, order history, and loyalty points
                </Text>
                <Button onPress={() => router.push('/(auth)/login')} className="w-full">
                  <Text className="text-white font-semibold">Sign In</Text>
                </Button>
              </CardContent>
            </Card>
          ) : bookingsLoading ? (
            <Card className="mb-4">
              <CardContent className="p-8 items-center">
                <ActivityIndicator size="small" color="#0ea5e9" />
              </CardContent>
            </Card>
          ) : upcomingBookings.length > 0 ? (
            upcomingBookings.map((booking) => (
              <Card key={booking.id} className="mb-4 bg-card border-l-4 border-l-primary border-y-0 border-r-0 rounded-r-lg">
                <CardContent className="p-4 flex-row items-center">
                  <View className="bg-primary/10 p-3 rounded-lg mr-4">
                    {booking.type === 'chalet' ? (
                      <BedDouble size={24} color="#0ea5e9" />
                    ) : booking.type === 'pool' ? (
                      <Waves size={24} color="#0ea5e9" />
                    ) : (
                      <Calendar size={24} color="#0ea5e9" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground capitalize">
                      {booking.type} Booking
                    </Text>
                    <Text className="text-muted-foreground">
                      {booking.bookingNumber} • {new Date(booking.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className={`text-xs font-bold px-2 py-1 rounded ${
                      booking.status === 'confirmed' 
                        ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                        : 'text-primary bg-primary/10'
                    }`}>
                      {booking.status.toUpperCase()}
                    </Text>
                  </View>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="mb-4 bg-muted/30">
              <CardContent className="p-6 items-center">
                <Calendar size={40} color="#94a3b8" />
                <Text className="text-lg font-semibold text-foreground mt-3 mb-1">
                  No upcoming bookings
                </Text>
                <Text className="text-muted-foreground text-center">
                  Explore our amenities and make a reservation
                </Text>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <Text className="text-center text-muted-foreground text-xs mb-8 mt-4">
            V2 Resort Mobile
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
