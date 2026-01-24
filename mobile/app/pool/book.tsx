/**
 * Pool Booking Screen
 * Book a specific time slot
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { poolApi } from '../../src/api/client';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { ChevronLeft, Calendar, User } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

export default function PoolBookingScreen() {
    const { slotId, date } = useLocalSearchParams();
    const router = useRouter();
    const [guests, setGuests] = useState('1');

    const bookMutation = useMutation({
        mutationFn: (data: any) => poolApi.book(data),
        onSuccess: (data) => {
            Alert.alert('Booking Confirmed', 'Your pool session has been booked!', [
                { text: 'View Ticket', onPress: () => router.push('/(tabs)/pool') } // Ideally go to ticket screen
            ]);
        },
        onError: (err: any) => {
            Alert.alert('Error', err.response?.data?.error || 'Failed to book session');
        }
    });

    const handleBook = () => {
        bookMutation.mutate({
            date: date,
            slotId: slotId,
            guests: parseInt(guests)
        });
    };

    return (
        <View className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="bg-background pt-12 pb-4 px-4 border-b border-border flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={24} color="#0f172a" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-foreground">Confirm Pool Session</Text>
            </View>

            <ScrollView className="flex-1 p-6">
                <Card className="p-6 mb-6">
                    <View className="flex-row items-center mb-4">
                        <Calendar size={20} color="#0ea5e9" />
                        <Text className="text-lg ml-2 font-medium bg-muted/30 px-2 py-1 rounded">
                            {date ? new Date(date as string).toDateString() : 'Selected Date'}
                        </Text>
                    </View>
                    <Text className="text-muted-foreground">
                        Premium Pool Access
                    </Text>
                </Card>

                <View className="mb-6">
                    <Text className="text-base font-semibold mb-2">Number of Guests</Text>
                    <View className="flex-row items-center">
                        <User size={20} color="#64748b" className="mr-2" />
                        <View className="flex-1">
                            <Input
                                keyboardType="numeric"
                                value={guests}
                                onChangeText={setGuests}
                                placeholder="1"
                            />
                        </View>
                    </View>
                </View>

            </ScrollView>

            <View className="p-6 border-t border-border">
                <Button
                    title="Confirm Booking"
                    onPress={handleBook}
                    isLoading={bookMutation.isPending}
                />
            </View>
        </View>
    );
}
