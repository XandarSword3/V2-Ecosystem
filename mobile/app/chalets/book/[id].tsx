/**
 * Chalet Booking Screen
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { chaletsApi } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, Calendar, Users, Info } from 'lucide-react-native';

export default function ChaletBookingScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    // Form State
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [guests, setGuests] = useState('2');
    const [notes, setNotes] = useState('');

    // Fetch Chalet Info
    const { data: chaletData } = useQuery({
        queryKey: ['chalet', id],
        queryFn: () => chaletsApi.getChalet(id as string),
    });

    // Calculate Price Query
    const { data: quoteData, isLoading: isQuoteLoading } = useQuery({
        queryKey: ['chaleta-quote', id, checkIn, checkOut],
        queryFn: () => chaletsApi.getAvailability(id as string, checkIn, checkOut),
        enabled: !!(checkIn && checkOut && checkIn.length === 10 && checkOut.length === 10),
    });

    const chalet = chaletData?.data;

    // Booking Mutation
    const bookMutation = useMutation({
        mutationFn: (data: any) => chaletsApi.createBooking(data),
        onSuccess: (data) => {
            Alert.alert('Success', 'Your booking request has been submitted!', [
                { text: 'OK', onPress: () => router.push('/(tabs)/account') }
            ]);
        },
        onError: (err: any) => {
            Alert.alert('Error', err.response?.data?.error || 'Failed to book chalet');
        }
    });

    const handleBook = () => {
        if (!checkIn || !checkOut) {
            Alert.alert('Missing Dates', 'Please enter check-in and check-out dates (YYYY-MM-DD).');
            return;
        }

        bookMutation.mutate({
            chaletId: id,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            numberOfGuests: parseInt(guests),
            customerName: "Guest User", // Should come from Auth Store
            customerEmail: "guest@example.com", // Should come from Auth Store
            specialRequests: notes
        });
    };

    if (!chalet) return <View className="flex-1 bg-background" />;

    return (
        <View className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="bg-background pt-12 pb-4 px-4 border-b border-border flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={24} color="#0f172a" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-foreground">Confirm Booking</Text>
            </View>

            <ScrollView className="flex-1 p-6">
                {/* Chalet Summary */}
                <Card className="mb-6 p-4 bg-muted/30">
                    <Text className="text-lg font-bold text-foreground mb-1">{chalet.name}</Text>
                    <Text className="text-primary font-semibold">${chalet.basePrice} / night</Text>
                </Card>

                {/* Date Selection (Simple Inputs for MVP) */}
                <Text className="text-base font-semibold mb-3">Select Dates</Text>
                <View className="flex-row gap-4 mb-4">
                    <View className="flex-1">
                        <Input
                            label="Check-In"
                            placeholder="YYYY-MM-DD"
                            value={checkIn}
                            onChangeText={setCheckIn}
                        />
                    </View>
                    <View className="flex-1">
                        <Input
                            label="Check-Out"
                            placeholder="YYYY-MM-DD"
                            value={checkOut}
                            onChangeText={setCheckOut}
                        />
                    </View>
                </View>

                {/* Guest Count */}
                <View className="mb-6">
                    <Input
                        label="Number of Guests"
                        keyboardType="numeric"
                        value={guests}
                        onChangeText={setGuests}
                    />
                    <Text className="text-xs text-muted-foreground mt-1">Max {chalet.maxGuests} guests</Text>
                </View>

                {/* Price Quote */}
                {quoteData?.data && (
                    <View className="bg-primary/5 p-4 rounded-xl mb-6 border border-primary/20">
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-foreground">Total Nights</Text>
                            <Text className="font-bold">{quoteData.data.nights}</Text>
                        </View>
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-foreground">Total Price</Text>
                            <Text className="font-bold text-primary text-lg">${quoteData.data.totalPrice}</Text>
                        </View>
                        {!quoteData.data.isAvailable && (
                            <View className="flex-row items-center mt-2 bg-red-100 p-2 rounded">
                                <Info size={16} color="#ef4444" />
                                <Text className="text-red-600 ml-2 font-medium">Not available for these dates</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Notes */}
                <Input
                    label="Special Requests"
                    placeholder="Any allergies or requirements?"
                    multiline
                    numberOfLines={3}
                    value={notes}
                    onChangeText={setNotes}
                />

            </ScrollView>

            {/* Footer */}
            <View className="p-6 border-t border-border bg-background">
                <Button
                    onPress={handleBook}
                    isLoading={bookMutation.isPending}
                    disabled={quoteData && !quoteData.data?.isAvailable}
                    title="Confirm & Pay"
                />
            </View>
        </View>
    );
}
