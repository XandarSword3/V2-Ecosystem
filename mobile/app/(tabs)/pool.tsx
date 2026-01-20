import React from 'react';
import { View, Text, ScrollView, ImageBackground, TouchableOpacity } from 'react-native';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Waves, Umbrella, ThermometerSun, Clock } from 'lucide-react-native';

const POOL_AREAS = [
    {
        id: 1,
        name: 'Infinity Main Pool',
        status: 'Open',
        temp: '28°C',
        occupancy: 'Moderate',
        image: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?q=80&w=2070&auto=format&fit=crop'
    },
    {
        id: 2,
        name: 'Adults Only Quiet Pool',
        status: 'Open',
        temp: '26°C',
        occupancy: 'Low',
        image: 'https://images.unsplash.com/photo-1572331165267-854da2dc7252?q=80&w=1770&auto=format&fit=crop'
    },
    {
        id: 3,
        name: 'Kids Splash Zone',
        status: 'Closing Soon',
        temp: '29°C',
        occupancy: 'High',
        image: 'https://images.unsplash.com/photo-1519092672323-5e927c6da996?q=80&w=2070&auto=format&fit=crop' // Generic beach
    }
];

export default function PoolScreen() {
  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        
        <View className="p-6 pb-2">
            <Text className="text-2xl font-bold text-foreground mb-2">Pools & Wellness</Text>
            <Text className="text-muted-foreground">Relax by the water or book a treatment.</Text>
        </View>

        {/* Quick Stats or Weather (Simplified) */}
        <View className="px-6 mb-6 flex-row">
            <View className="flex-1 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mr-2 items-center">
                <ThermometerSun className="text-blue-500 mb-2" size={24} color="#3b82f6"/>
                <Text className="font-bold text-blue-700 dark:text-blue-300">28°C</Text>
                <Text className="text-xs text-blue-600 dark:text-blue-400">Water Avg</Text>
            </View>
            <View className="flex-1 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl ml-2 items-center">
                <Umbrella className="text-orange-500 mb-2" size={24} color="#f97316"/>
                <Text className="font-bold text-orange-700 dark:text-orange-300">UV High</Text>
                <Text className="text-xs text-orange-600 dark:text-orange-400">Wear SPF</Text>
            </View>
        </View>

        <View className="px-6 mb-4">
            <Text className="text-lg font-semibold mb-3 text-foreground">Pool Areas</Text>
            {POOL_AREAS.map(pool => (
                <Card key={pool.id} className="mb-4 overflow-hidden border-0 shadow-sm bg-card">
                    <ImageBackground
                        source={{ uri: pool.image }}
                        className="h-40 w-full justify-between p-3"
                        imageStyle={{ borderRadius: 12 }}
                    >
                         <View className="absolute inset-0 bg-black/20 rounded-xl" />
                         <View className="flex-row justify-between">
                            <View className="bg-white/90 px-2 py-1 rounded backdrop-blur-sm">
                                <Text className="text-xs font-bold text-black">{pool.status}</Text>
                            </View>
                         </View>
                         <View>
                            <Text className="text-white font-bold text-xl shadow-sm">{pool.name}</Text>
                            <View className="flex-row items-center mt-1">
                                <Waves size={14} color="white" className="mr-1"/>
                                <Text className="text-white/90 text-sm font-medium">{pool.temp} • {pool.occupancy}</Text>
                            </View>
                         </View>
                    </ImageBackground>
                    <CardContent className="p-3 flex-row justify-between items-center">
                        <View className="flex-row items-center text-muted-foreground">
                            <Clock size={16} color="#6B7280" className="mr-1"/>
                            <Text className="text-sm">08:00 AM - 08:00 PM</Text>
                        </View>
                        <Button size="sm" variant="outline">
                            <Text>Details</Text>
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </View>

        <View className="px-6">
            <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 items-center text-center">
                    <Text className="text-lg font-bold text-primary mb-2">Private Cabana?</Text>
                    <Text className="text-center text-muted-foreground mb-4">
                        Book a private cabana with dedicated service for the ultimate day.
                    </Text>
                    <Button className="w-full">
                        <Text>Check Availability</Text>
                    </Button>
                </CardContent>
            </Card>
        </View>

      </ScrollView>
    </View>
  );
}
