import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { chaletsApi, paymentApi } from '../api/client';

interface ChaletBookingScreenProps {
  chaletId: string;
}

export default function ChaletBookingScreen({ chaletId }: ChaletBookingScreenProps) {
  const [checkInDate, setCheckInDate] = useState(new Date());
  const [checkOutDate, setCheckOutDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [showPicker, setShowPicker] = useState<'checkIn' | 'checkOut' | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [numberOfGuests, setNumberOfGuests] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [basePrice, setBasePrice] = useState(0);
  const [availabilityPrice, setAvailabilityPrice] = useState<number | null>(null);
  const [addOns, setAddOns] = useState<Array<{ id: string; name: string; price: number; selectedQty: number }>>([]);

  useEffect(() => {
    chaletsApi.getChalet(chaletId)
      .then((res) => {
        setBasePrice(res.data?.basePrice || 0);
      })
      .catch(() => undefined);

    chaletsApi.getAddOns()
      .then((res) => {
        const rows = (res.data || []).map((a) => ({
          id: a.id,
          name: a.name,
          price: a.price,
          selectedQty: 0,
        }));
        setAddOns(rows);
      })
      .catch(() => setAddOns([]));
  }, [chaletId]);

  useEffect(() => {
    const checkIn = checkInDate.toISOString().slice(0, 10);
    const checkOut = checkOutDate.toISOString().slice(0, 10);
    if (checkOut <= checkIn) return;
    chaletsApi.getAvailability(chaletId, checkIn, checkOut)
      .then((res) => setAvailabilityPrice(res.data?.totalPrice ?? null))
      .catch(() => setAvailabilityPrice(null));
  }, [chaletId, checkInDate, checkOutDate]);

  const nights = useMemo(() => {
    const diff = checkOutDate.getTime() - checkInDate.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [checkInDate, checkOutDate]);

  const selectedAddOnTotal = useMemo(
    () => addOns.reduce((sum, a) => sum + a.price * a.selectedQty, 0),
    [addOns]
  );
  const estimatedTotal = (availabilityPrice ?? basePrice * nights) + selectedAddOnTotal;

  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(null);
    if (!date || !showPicker) return;
    if (showPicker === 'checkIn') setCheckInDate(date);
    if (showPicker === 'checkOut') setCheckOutDate(date);
  };

  const submit = async () => {
    const checkIn = checkInDate.toISOString().slice(0, 10);
    const checkOut = checkOutDate.toISOString().slice(0, 10);
    const guests = Number(numberOfGuests || '1');
    if (!customerName.trim() || !customerEmail.trim()) {
      Alert.alert('Missing details', 'Name and email are required.');
      return;
    }
    if (checkOut <= checkIn) {
      Alert.alert('Invalid dates', 'Check-out must be later than check-in.');
      return;
    }
    if (!Number.isFinite(guests) || guests < 1) {
      Alert.alert('Invalid guests', 'Number of guests must be at least 1.');
      return;
    }

    setIsSubmitting(true);
    try {
      const bookingRes = await chaletsApi.createBooking({
        chaletId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfGuests: guests,
        customerName,
        customerEmail,
        addOns: addOns
          .filter((a) => a.selectedQty > 0)
          .map((a) => ({ addOnId: a.id, quantity: a.selectedQty })),
      });

      // Payment intent step for card flow readiness.
      await paymentApi.createIntent({
        amount: Math.round(estimatedTotal * 100),
        bookingId: bookingRes.data?.id,
      });

      Alert.alert('Booking created', 'Booking and payment intent were created successfully.');
    } catch {
      Alert.alert('Booking failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>Chalet Booking</Text>
      <TouchableOpacity onPress={() => setShowPicker('checkIn')} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10 }}>
        <Text style={{ color: '#64748B', marginBottom: 4 }}>Check-in date</Text>
        <Text style={{ fontWeight: '600' }}>{checkInDate.toISOString().slice(0, 10)}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setShowPicker('checkOut')} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10 }}>
        <Text style={{ color: '#64748B', marginBottom: 4 }}>Check-out date</Text>
        <Text style={{ fontWeight: '600' }}>{checkOutDate.toISOString().slice(0, 10)}</Text>
      </TouchableOpacity>
      {!!showPicker && (
        <DateTimePicker
          mode="date"
          value={showPicker === 'checkIn' ? checkInDate : checkOutDate}
          onChange={onDateChange}
          minimumDate={new Date()}
        />
      )}
      <TextInput placeholder="Your name" value={customerName} onChangeText={setCustomerName} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10 }} />
      <TextInput placeholder="Your email" value={customerEmail} onChangeText={setCustomerEmail} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10 }} />
      <TextInput
        placeholder="Guests"
        value={numberOfGuests}
        onChangeText={setNumberOfGuests}
        keyboardType="number-pad"
        style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10 }}
      />
      <View style={{ gap: 8, marginTop: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: '700' }}>Add-ons</Text>
        {addOns.map((addOn) => (
          <View key={addOn.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10 }}>
            <View>
              <Text style={{ fontWeight: '600' }}>{addOn.name}</Text>
              <Text style={{ color: '#64748B' }}>${addOn.price}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => setAddOns((prev) => prev.map((row) => row.id === addOn.id ? { ...row, selectedQty: Math.max(0, row.selectedQty - 1) } : row))}>
                <Text style={{ fontSize: 22 }}>-</Text>
              </TouchableOpacity>
              <Text style={{ minWidth: 20, textAlign: 'center' }}>{addOn.selectedQty}</Text>
              <TouchableOpacity onPress={() => setAddOns((prev) => prev.map((row) => row.id === addOn.id ? { ...row, selectedQty: row.selectedQty + 1 } : row))}>
                <Text style={{ fontSize: 22 }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
      <View style={{ backgroundColor: '#EEF2FF', borderRadius: 8, padding: 10, gap: 4 }}>
        <Text style={{ fontWeight: '700' }}>Price estimate</Text>
        <Text>Nights: {nights}</Text>
        <Text>Stay: ${(availabilityPrice ?? basePrice * nights).toFixed(2)}</Text>
        <Text>Add-ons: ${selectedAddOnTotal.toFixed(2)}</Text>
        <Text style={{ fontWeight: '700' }}>Total: ${estimatedTotal.toFixed(2)}</Text>
      </View>
      <TouchableOpacity disabled={isSubmitting} onPress={submit} style={{ backgroundColor: isSubmitting ? '#94A3B8' : '#4F46E5', padding: 12, borderRadius: 8 }}>
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
          {isSubmitting ? 'Processing...' : 'Book and start payment'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
