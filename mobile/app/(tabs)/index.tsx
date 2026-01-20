import React from 'react';
import { View, Text, ScrollView, ImageBackground, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { UtensilsCrossed, Waves, Sparkles, Calendar, Bell, ArrowRight } from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';

// Using a placeholder image for the resort feel
const HERO_IMAGE = { uri: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=2070&auto=format&fit=crop' };

export default function HomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();

  const QUICK_ACTIONS = [
    { 
      label: 'Dining', 
      icon: UtensilsCrossed, 
      route: '/(tabs)/restaurant',
      color: 'bg-orange-100 dark:bg-orange-900/20',
      iconColor: '#f97316'
    },
    { 
      label: 'Pool & Spa', 
      icon: Waves, 
      route: '/(tabs)/pool',
      color: 'bg-blue-100 dark:bg-blue-900/20',
      iconColor: '#3b82f6'
    },
    { 
      label: 'Services', 
      icon: Sparkles, 
      route: '/(tabs)/chalets', // Redirecting to chalets/services for now
      color: 'bg-purple-100 dark:bg-purple-900/20',
      iconColor: '#a855f7'
    },
    { 
      label: 'My Stay', 
      icon: Calendar, 
      route: '/(tabs)/account',
      color: 'bg-emerald-100 dark:bg-emerald-900/20',
      iconColor: '#10b981'
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <ImageBackground
          source={HERO_IMAGE}
          className="h-80 w-full justify-end"
          resizeMode="cover"
        >
          {/* Solid Gradient Overlay for Text Readability */}
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

        {/* Content Section - overlaps with negative margin if needed, or just follows */}
        <View className="px-6 -mt-6">
          <Card className="bg-card dark:bg-card border-border shadow-lg mb-8">
            <CardContent className="p-4 flex-row flex-wrap justify-between">
              {QUICK_ACTIONS.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => router.push(action.route as any)}
                  className="w-[45%] items-center justify-center p-4 mb-4 rounded-xl bg-muted/50 active:scale-95 transition-transform"
                >
                  <View className={`p-4 rounded-full mb-3 ${action.color}`}>
                    <action.icon size={28} color={action.iconColor} />
                  </View>
                  <Text className="font-medium text-foreground text-center">
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </CardContent>
          </Card>

          <View className="flex-row justify-between items-end mb-4">
            <Text className="text-xl font-bold text-foreground">
              Today's Schedule
            </Text>
            <Link href="/(tabs)/chalets" asChild>
              <TouchableOpacity className="flex-row items-center">
                <Text className="text-primary mr-1">View All</Text>
                <ArrowRight size={16} color="#4F46E5" className="text-primary"/>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Featured / Up Next */}
          <Card className="mb-4 bg-card border-l-4 border-l-primary border-y-0 border-r-0 rounded-r-lg">
            <CardContent className="p-4 flex-row items-center">
              <View className="bg-primary/10 p-3 rounded-lg mr-4">
                <Calendar size={24} color="#4F46E5" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground">
                  Check-in
                </Text>
                <Text className="text-muted-foreground">
                  Chalet 404 • 3:00 PM
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                  TODAY
                </Text>
              </View>
            </CardContent>
          </Card>

          <Card className="mb-8 overflow-hidden">
             <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=2070&auto=format&fit=crop' }}
                className="h-32 w-full justify-end"
                resizeMode="cover"
             >
                <View className="absolute inset-0 bg-black/40" />
                <View className="p-4">
                    <Text className="text-white font-bold text-lg">Special Offer</Text>
                    <Text className="text-white/90 text-sm">20% off Spa Treatments</Text>
                </View>
             </ImageBackground>
             <CardContent className="p-4">
                <Text className="text-muted-foreground text-sm mb-4">
                    Relax and rejuvenate with our signature massage therapies. Valid until Sunday.
                </Text>
                <Button variant="outline" onPress={() => router.push('/(tabs)/pool')} className="w-full">
                    <Text>Book Now</Text>
                </Button>
             </CardContent>
          </Card>
        
        {/* Helper text for demo */}
        <Text className="text-center text-muted-foreground text-xs mb-8">
            V2 Resort Mobile v0.1.0
        </Text>

        </View>
      </ScrollView>
    </View>
  );
}
