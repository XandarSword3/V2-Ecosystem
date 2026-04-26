/**
 * Chalet Booking Screen
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useStripe } from '@stripe/stripe-react-native';
import { chaletsApi, paymentApi } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { ChevronLeft, Calendar, Users, Info } from 'lucide-react-native';
import { useAuthStore } from '@/store/auth';

export default function ChaletBookingScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuthStore();
    const { initPaymentSheet, presentPaymentSheet } = useStripe();

    // Form State
    const [checkInDate, setCheckInDate] = useState(() => new Date());
    const [checkOutDate, setCheckOutDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
    });
    const [activePicker, setActivePicker] = useState<'checkIn' | 'checkOut' | null>(null);
    const [guests, setGuests] = useState('2');
    const [notes, setNotes] = useState('');
    const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
    const [isPaying, setIsPaying] = useState(false);

    const checkIn = checkInDate.toISOString().slice(0, 10);
    const checkOut = checkOutDate.toISOString().slice(0, 10);

    // Fetch Chalet Info
    const { data: chaletData } = useQuery({
        queryKey: ['chalet', id],
        queryFn: () => chaletsApi.getChalet(id as string),
    });

    // Calculate Price Query
    const { data: quoteData, isLoading: isQuoteLoading } = useQuery({
        queryKey: ['chaleta-quote', id, checkIn, checkOut],
        queryFn: () => chaletsApi.getAvailability(id as string, checkIn, checkOut),
        enabled: !!id,
    });

    const { data: addOnsData } = useQuery({
        queryKey: ['chalet-addons'],
        queryFn: () => chaletsApi.getAddOns(),
    });

    const chalet = chaletData?.data;
    const addOns = addOnsData?.data || [];

    const addOnTotal = useMemo(
        () =>
            addOns.reduce((sum, addOn) => {
                const qty = selectedAddOns[addOn.id] || 0;
                return sum + qty * addOn.price;
            }, 0),
        [addOns, selectedAddOns]
    );

    const estimatedTotal = (quoteData?.data?.totalPrice || 0) + addOnTotal;

    // Booking Mutation
    const bookMutation = useMutation({
        mutationFn: (data: any) => chaletsApi.createBooking(data),
        onError: (err: any) => {
            Alert.alert('Error', err.response?.data?.error || 'Failed to book chalet');
        }
    });

    const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
        if (!selected || !activePicker) return;
        if (Platform.OS !== 'ios') setActivePicker(null);
        if (activePicker === 'checkIn') setCheckInDate(selected);
        if (activePicker === 'checkOut') setCheckOutDate(selected);
    };

    const updateAddOnQty = (addOnId: string, delta: number) => {
        setSelectedAddOns((prev) => {
            const current = prev[addOnId] || 0;
            const next = Math.max(0, current + delta);
            return { ...prev, [addOnId]: next };
        });
    };

    const handleBook = async () => {
        if (checkOut <= checkIn) {
            Alert.alert('Invalid Dates', 'Check-out must be after check-in.');
            return;
        }
        const guestCount = parseInt(guests, 10);
        if (!guestCount || guestCount < 1) {
            Alert.alert('Invalid Guests', 'Please enter a valid guest count.');
            return;
        }

        setIsPaying(true);
        try {
            const bookingResponse = await bookMutation.mutateAsync({
            chaletId: id,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            numberOfGuests: guestCount,
            customerName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'Guest User',
            customerEmail: user?.email || 'guest@example.com',
            specialRequests: notes,
            addOns: Object.entries(selectedAddOns)
                .filter(([, qty]) => qty > 0)
                .map(([addOnId, quantity]) => ({ addOnId, quantity })),
        });

            const paymentIntent = await paymentApi.createIntent({
                amount: Math.round(estimatedTotal * 100),
                bookingId: bookingResponse?.data?.id,
            });

            if (!paymentIntent.success || !paymentIntent.data?.clientSecret) {
                throw new Error('Failed to initialize payment');
            }

            if (Platform.OS === 'web') {
                await paymentApi.confirm(paymentIntent.data.paymentIntentId);
            } else {
                const init = await initPaymentSheet({
                    paymentIntentClientSecret: paymentIntent.data.clientSecret,
                    merchantDisplayName: 'V2 Resort',
                    allowsDelayedPaymentMethods: true,
                });
                if (init.error) throw new Error(init.error.message);

                const present = await presentPaymentSheet();
                if (present.error) throw new Error(present.error.message);

                await paymentApi.confirm(paymentIntent.data.paymentIntentId);
            }

            Alert.alert('Success', 'Booking confirmed and payment completed.', [
                { text: 'OK', onPress: () => router.push('/(tabs)/account') }
            ]);
        } catch (err: any) {
            Alert.alert('Payment Error', err?.message || 'Could not complete payment.');
        } finally {
            setIsPaying(false);
        }
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

                {/* Date Selection */}
                <Text className="text-base font-semibold mb-3">Select Dates</Text>
                <View className="flex-row gap-4 mb-4">
                    <TouchableOpacity className="flex-1 border border-border rounded-xl px-3 py-3" onPress={() => setActivePicker('checkIn')}>
                        <Text className="text-xs text-muted-foreground mb-1">Check-In</Text>
                        <Text className="text-foreground font-semibold">{checkIn}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-1 border border-border rounded-xl px-3 py-3" onPress={() => setActivePicker('checkOut')}>
                        <Text className="text-xs text-muted-foreground mb-1">Check-Out</Text>
                        <Text className="text-foreground font-semibold">{checkOut}</Text>
                    </TouchableOpacity>
                </View>
                {!!activePicker && (
                    <DateTimePicker
                        mode="date"
                        value={activePicker === 'checkIn' ? checkInDate : checkOutDate}
                        onChange={onDateChange}
                        minimumDate={new Date()}
                    />
                )}

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

                <Text className="text-base font-semibold mb-2">Add-ons</Text>
                <View className="mb-6">
                    {addOns.length === 0 ? (
                        <Text className="text-muted-foreground">No add-ons available.</Text>
                    ) : (
                        addOns.map((addOn) => {
                            const qty = selectedAddOns[addOn.id] || 0;
                            return (
                                <View key={addOn.id} className="flex-row items-center justify-between border border-border rounded-xl px-3 py-3 mb-2">
                                    <View className="flex-1 mr-3">
                                        <Text className="text-foreground font-semibold">{addOn.name}</Text>
                                        <Text className="text-muted-foreground text-xs">${addOn.price.toFixed(2)}</Text>
                                    </View>
                                    <View className="flex-row items-center">
                                        <TouchableOpacity onPress={() => updateAddOnQty(addOn.id, -1)} className="w-8 h-8 items-center justify-center rounded-full bg-muted">
                                            <Text className="text-lg">-</Text>
                                        </TouchableOpacity>
                                        <Text className="mx-3 min-w-4 text-center">{qty}</Text>
                                        <TouchableOpacity onPress={() => updateAddOnQty(addOn.id, 1)} className="w-8 h-8 items-center justify-center rounded-full bg-muted">
                                            <Text className="text-lg">+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

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
                <View className="flex-row justify-between mb-3">
                    <Text className="text-muted-foreground">Estimated Total</Text>
                    <Text className="text-foreground font-bold">${estimatedTotal.toFixed(2)}</Text>
                </View>
                <Button
                    onPress={handleBook}
                    isLoading={bookMutation.isPending || isPaying}
                    disabled={quoteData && !quoteData.data?.isAvailable}
                    title="Confirm & Pay (Stripe)"
                />
            </View>
        </View>
    );
}
