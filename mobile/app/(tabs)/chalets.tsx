import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Car, SprayCan, Utensils, Wifi, Key, AlertCircle } from 'lucide-react-native';

const SERVICES = [
    { id: 'HK', title: 'Housekeeping', icon: SprayCan, desc: 'Request room cleaning or amenities' },
    { id: 'IRD', title: 'In-Room Dining', icon: Utensils, desc: 'Order food to your room' },
    { id: 'T', title: 'Transport', icon: Car, desc: 'Valet or Shuttle service' },
    { id: 'W', title: 'Wi-Fi Access', icon: Wifi, desc: 'Connection details' },
    { id: 'K', title: 'Digital Key', icon: Key, desc: 'Unlock your door' },
];

export default function ServicesScreen() {
    return (
        <View className="flex-1 bg-background">
            <View className="px-6 py-4 bg-background border-b border-border">
                <Text className="text-2xl font-bold text-foreground">Guest Services</Text>
                <Text className="text-muted-foreground">How can we help you today?</Text>
            </View>
            
            <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 32 }}>
                
                {/* Status Card */}
                <Card className="bg-primary/10 border-primary/20 mb-8">
                    <CardContent className="p-4 flex-row items-start">
                        <AlertCircle className="text-primary mr-3 mt-1" size={24} color="#4F46E5" />
                        <View className="flex-1">
                            <Text className="font-bold text-foreground mb-1">Chalet 404</Text>
                            <Text className="text-muted-foreground text-sm">
                                Your checkout is tomorrow at 11:00 AM.
                            </Text>
                            <TouchableOpacity className="mt-2">
                                <Text className="text-primary font-bold">Request Late Checkout</Text>
                            </TouchableOpacity>
                        </View>
                    </CardContent>
                </Card>

                <View className="flex-row flex-wrap justify-between">
                    {SERVICES.map((s) => (
                        <TouchableOpacity 
                            key={s.id} 
                            className="w-[48%] mb-4 active:opacity-70"
                        >
                            <Card className="h-40 justify-center items-center p-4 bg-card hover:bg-muted/50">
                                <View className="p-3 bg-muted rounded-full mb-3">
                                    <s.icon size={24} className="text-foreground" color="#333" />
                                </View>
                                <Text className="font-bold text-foreground text-center mb-1">{s.title}</Text>
                                <Text className="text-xs text-muted-foreground text-center line-clamp-2" numberOfLines={2}>
                                    {s.desc}
                                </Text>
                            </Card>
                        </TouchableOpacity>
                    ))}
                </View>

                <View className="mt-4">
                    <Text className="text-lg font-bold mb-3 text-foreground">Need something else?</Text>
                    <Button variant="outline" className="mb-3">
                        <Text>Chat with Concierge</Text>
                    </Button>
                    <Button variant="destructive" className="bg-red-50 border-red-200">
                        <Text className="text-red-600">Report an Issue</Text>
                    </Button>
                </View>

            </ScrollView>
        </View>
    );
}
