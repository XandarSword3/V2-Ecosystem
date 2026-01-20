import React, { useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ImageBackground } from 'react-native';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { Search, MapPin, Star, Clock } from 'lucide-react-native';

const CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Bar', 'Room Service'];

const RESTAURANTS = [
  {
    id: 1,
    name: 'The Azure Grill',
    cuisine: 'Mediterranean',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1544148103-0773bf10d330?q=80&w=2070&auto=format&fit=crop',
    status: 'Open Now',
    time: '7:00 AM - 11:00 PM'
  },
  {
    id: 2,
    name: 'Sakura Sushi',
    cuisine: 'Japanese',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1579027989536-b7b1f875659b?q=80&w=2070&auto=format&fit=crop',
    status: 'Opens at 5:00 PM',
    time: '5:00 PM - 10:00 PM'
  },
  {
    id: 3,
    name: 'Poolside Bar',
    cuisine: 'Drinks & Snacks',
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1572331165267-854da2dc7252?q=80&w=1770&auto=format&fit=crop',
    status: 'Open Now',
    time: '10:00 AM - 8:00 PM'
  }
];

export default function RestaurantScreen() {
  const [activeCategory, setActiveCategory] = useState('All');

  return (
    <View className="flex-1 bg-background">
      <View className="px-6 py-4 bg-background border-b border-border">
        <Text className="text-2xl font-bold text-foreground mb-4">Dining & Bars</Text>
        <View className="relative">
             <View className="absolute left-3 top-3 z-10">
                 <Search size={20} className="text-muted-foreground" color="#9CA3AF"/>
             </View>
             <Input 
                placeholder="Search restaurants or dishes..." 
                className="pl-10 bg-muted/50 border-0"
             />
        </View>
      </View>
      
      <View>
        <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12 }}
            className="flex-grow-0"
        >
            {CATEGORIES.map((cat, index) => (
                <TouchableOpacity 
                    key={index}
                    onPress={() => setActiveCategory(cat)}
                    className={`mr-3 px-5 py-2 rounded-full border ${
                        activeCategory === cat 
                        ? 'bg-primary border-primary' 
                        : 'bg-transparent border-muted hover:bg-muted'
                    }`}
                >
                    <Text className={`font-medium ${
                        activeCategory === cat ? 'text-white' : 'text-muted-foreground'
                    }`}>
                        {cat}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      <ScrollView className="flex-1 px-6 pt-2" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-lg font-semibold mb-4 text-foreground">Featured Venues</Text>
        
        {RESTAURANTS.map((restaurant) => (
            <TouchableOpacity key={restaurant.id} activeOpacity={0.9} className="mb-6">
                <Card className="overflow-hidden border-0 shadow-sm bg-card hover:scale-[1.02] transition-transform">
                    <ImageBackground 
                        source={{ uri: restaurant.image }}
                        className="h-48 w-full justify-between p-4"
                        resizeMode="cover"
                    >
                        <View className="absolute inset-0 bg-black/20" />
                        <View className="flex-row justify-between w-full">
                            <View className="bg-white/90 px-2 py-1 rounded backdrop-blur-sm">
                                <Text className="text-xs font-bold text-black uppercase tracking-wide">
                                    {restaurant.cuisine}
                                </Text>
                            </View>
                            <View className="bg-white/90 px-2 py-1 rounded backdrop-blur-sm flex-row items-center">
                                <Star size={12} fill="#F59E0B" color="#F59E0B" />
                                <Text className="text-xs font-bold text-black ml-1">{restaurant.rating}</Text>
                            </View>
                        </View>
                    </ImageBackground>
                    <CardContent className="p-4">
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-lg font-bold text-foreground">{restaurant.name}</Text>
                            <View className={`px-2 py-1 rounded ${
                                restaurant.status === 'Open Now' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
                            }`}>
                                <Text className={`text-xs font-medium ${
                                    restaurant.status === 'Open Now' ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'
                                }`}>
                                    {restaurant.status}
                                </Text>
                            </View>
                        </View>
                        <View className="flex-row items-center text-muted-foreground">
                            <Clock size={14} color="#6B7280" className="mr-1"/>
                            <Text className="text-sm text-muted-foreground">{restaurant.time}</Text>
                            <Text className="mx-2 text-muted-foreground">•</Text>
                             <MapPin size={14} color="#6B7280" className="mr-1"/>
                            <Text className="text-sm text-muted-foreground">Main Building</Text>
                        </View>
                    </CardContent>
                </Card>
            </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}